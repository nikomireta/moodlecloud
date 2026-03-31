package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func scanSitePlanChange(row interface {
	Scan(dest ...interface{}) error
}, change *SitePlanChange) error {
	var siteID uuid.NullUUID
	if err := row.Scan(
		&change.ID,
		&siteID,
		&change.SiteName,
		&change.SiteSubdomain,
		&change.OwnerUserID,
		&change.FromPlanCode,
		&change.ToPlanCode,
		&change.Status,
		&change.AppliedAt,
		&change.CreatedAt,
	); err != nil {
		return err
	}
	if siteID.Valid {
		change.SiteID = &siteID.UUID
	} else {
		change.SiteID = nil
	}
	return nil
}

func (s *Store) UpdateSitePlan(ctx context.Context, params UpdateSitePlanParams, targetPlan Plan, capacity HostCapacityPolicy) (Site, *SiteUsageSnapshot, error) {
	targetCode := strings.TrimSpace(params.PlanCode)
	if targetCode != "" && targetCode != strings.TrimSpace(targetPlan.Code) {
		return Site{}, nil, fmt.Errorf("target plan mismatch: %s != %s", targetCode, targetPlan.Code)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Site{}, nil, fmt.Errorf("begin update site plan tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, int64(2026031701)); err != nil {
		return Site{}, nil, fmt.Errorf("lock host capacity policy: %w", err)
	}

	currentSite, err := getSiteForUpdate(ctx, tx, params.OwnerUserID, params.SiteID)
	if err != nil {
		return Site{}, nil, err
	}

	if err := validateHostCapacityChange(ctx, tx, currentSite, targetPlan, capacity); err != nil {
		return Site{}, nil, err
	}

	updatedSite, err := updateSitePlanRow(ctx, tx, params.OwnerUserID, params.SiteID, targetPlan)
	if err != nil {
		return Site{}, nil, err
	}

	usage, err := reclassifySiteUsageSnapshot(ctx, tx, updatedSite)
	if err != nil {
		return Site{}, nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return Site{}, nil, fmt.Errorf("commit update site plan tx: %w", err)
	}
	return updatedSite, usage, nil
}

func (s *Store) CreateSitePlanChange(ctx context.Context, params CreateSitePlanChangeParams) (SitePlanChange, error) {
	now := time.Now().UTC()
	change := SitePlanChange{
		ID:            uuid.New(),
		SiteID:        params.SiteID,
		SiteName:      strings.TrimSpace(params.SiteName),
		SiteSubdomain: strings.ToLower(strings.TrimSpace(params.SiteSubdomain)),
		OwnerUserID:   params.OwnerUserID,
		FromPlanCode:  strings.TrimSpace(params.FromPlanCode),
		ToPlanCode:    strings.TrimSpace(params.ToPlanCode),
		Status:        strings.TrimSpace(params.Status),
		AppliedAt:     params.AppliedAt,
		CreatedAt:     now,
	}
	if change.Status == "" {
		change.Status = "applied"
	}
	if change.AppliedAt.IsZero() {
		change.AppliedAt = now
	}

	if err := scanSitePlanChange(s.pool.QueryRow(ctx, `
		INSERT INTO site_plan_changes (
			id, site_id, site_name, site_subdomain, owner_user_id, from_plan_code, to_plan_code, status, applied_at, created_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, site_id, site_name, site_subdomain, owner_user_id, from_plan_code, to_plan_code, status, applied_at, created_at
	`, change.ID, change.SiteID, change.SiteName, change.SiteSubdomain, change.OwnerUserID, change.FromPlanCode, change.ToPlanCode, change.Status, change.AppliedAt, change.CreatedAt), &change); err != nil {
		return SitePlanChange{}, fmt.Errorf("create site plan change: %w", err)
	}

	return change, nil
}

func (s *Store) ListSitePlanChangesForOwner(ctx context.Context, ownerUserID, siteID uuid.UUID) ([]SitePlanChange, error) {
	if _, err := s.GetSiteByIDForOwner(ctx, ownerUserID, siteID); err != nil {
		return nil, err
	}

	rows, err := s.pool.Query(ctx, `
		SELECT
			id, site_id, site_name, site_subdomain, owner_user_id, from_plan_code, to_plan_code, status, applied_at, created_at
		FROM site_plan_changes
		WHERE owner_user_id = $1 AND site_id = $2
		ORDER BY applied_at DESC, created_at DESC
		LIMIT 20
	`, ownerUserID, siteID)
	if err != nil {
		return nil, fmt.Errorf("list site plan changes: %w", err)
	}
	defer rows.Close()

	items := make([]SitePlanChange, 0)
	for rows.Next() {
		var item SitePlanChange
		if err := scanSitePlanChange(rows, &item); err != nil {
			return nil, fmt.Errorf("scan site plan change: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return items, nil
}

func (s *Store) ListSitePlanChangesByOwner(ctx context.Context, ownerUserID uuid.UUID) ([]SitePlanChange, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT
			id, site_id, site_name, site_subdomain, owner_user_id, from_plan_code, to_plan_code, status, applied_at, created_at
		FROM site_plan_changes
		WHERE owner_user_id = $1
		ORDER BY applied_at DESC, created_at DESC
		LIMIT 100
	`, ownerUserID)
	if err != nil {
		return nil, fmt.Errorf("list site plan changes by owner: %w", err)
	}
	defer rows.Close()

	items := make([]SitePlanChange, 0)
	for rows.Next() {
		var item SitePlanChange
		if err := scanSitePlanChange(rows, &item); err != nil {
			return nil, fmt.Errorf("scan site plan change by owner: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return items, nil
}

func getSiteForUpdate(ctx context.Context, tx pgx.Tx, ownerUserID, siteID uuid.UUID) (Site, error) {
	var site Site
	err := tx.QueryRow(ctx, `
		SELECT
			id, owner_user_id, name, subdomain, plan_code, region, status, site_url, admin_url,
			admin_name, admin_email, moodle_username, provisioning_step, last_error,
			users_active_limit, storage_bytes_limit, web_cpu_millicores, web_memory_mib,
			cron_cpu_millicores, cron_memory_mib, activated_at, created_at, updated_at
		FROM sites
		WHERE owner_user_id = $1 AND id = $2
		FOR UPDATE
	`, ownerUserID, siteID).Scan(
		&site.ID, &site.OwnerUserID, &site.Name, &site.Subdomain, &site.PlanCode, &site.Region, &site.Status, &site.SiteURL, &site.AdminURL,
		&site.AdminName, &site.AdminEmail, &site.MoodleUsername, &site.ProvisioningStep, &site.LastError,
		&site.UsersActiveLimit, &site.StorageBytesLimit, &site.WebCPUMillicores, &site.WebMemoryMiB,
		&site.CronCPUMillicores, &site.CronMemoryMiB, &site.ActivatedAt, &site.CreatedAt, &site.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Site{}, ErrNotFound
		}
		return Site{}, fmt.Errorf("get site for update: %w", err)
	}
	return site, nil
}

func updateSitePlanRow(ctx context.Context, tx pgx.Tx, ownerUserID, siteID uuid.UUID, targetPlan Plan) (Site, error) {
	var site Site
	err := tx.QueryRow(ctx, `
		UPDATE sites
		SET
			plan_code = $3,
			users_active_limit = $4,
			storage_bytes_limit = $5,
			web_cpu_millicores = $6,
			web_memory_mib = $7,
			cron_cpu_millicores = $8,
			cron_memory_mib = $9,
			updated_at = NOW()
		WHERE owner_user_id = $1 AND id = $2
		RETURNING
			id, owner_user_id, name, subdomain, plan_code, region, status, site_url, admin_url,
			admin_name, admin_email, moodle_username, provisioning_step, last_error,
			users_active_limit, storage_bytes_limit, web_cpu_millicores, web_memory_mib,
			cron_cpu_millicores, cron_memory_mib, activated_at, created_at, updated_at
	`, ownerUserID, siteID, targetPlan.Code, targetPlan.UsersActiveLimit, targetPlan.StorageBytesLimit, targetPlan.WebCPUMillicores, targetPlan.WebMemoryMiB, targetPlan.CronCPUMillicores, targetPlan.CronMemoryMiB).Scan(
		&site.ID, &site.OwnerUserID, &site.Name, &site.Subdomain, &site.PlanCode, &site.Region, &site.Status, &site.SiteURL, &site.AdminURL,
		&site.AdminName, &site.AdminEmail, &site.MoodleUsername, &site.ProvisioningStep, &site.LastError,
		&site.UsersActiveLimit, &site.StorageBytesLimit, &site.WebCPUMillicores, &site.WebMemoryMiB,
		&site.CronCPUMillicores, &site.CronMemoryMiB, &site.ActivatedAt, &site.CreatedAt, &site.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Site{}, ErrNotFound
		}
		return Site{}, fmt.Errorf("update site plan: %w", err)
	}
	return site, nil
}

func reclassifySiteUsageSnapshot(ctx context.Context, tx pgx.Tx, site Site) (*SiteUsageSnapshot, error) {
	var usage SiteUsageSnapshot
	err := tx.QueryRow(ctx, `
		SELECT
			site_id, users_active_count, files_bytes_used, database_bytes_used, storage_bytes_used,
			warning_level, over_limit, last_error, measured_at, created_at, updated_at
		FROM site_usage_snapshots
		WHERE site_id = $1
		FOR UPDATE
	`, site.ID).Scan(
		&usage.SiteID,
		&usage.UsersActiveCount,
		&usage.FilesBytesUsed,
		&usage.DatabaseBytesUsed,
		&usage.StorageBytesUsed,
		&usage.WarningLevel,
		&usage.OverLimit,
		&usage.LastError,
		&usage.MeasuredAt,
		&usage.CreatedAt,
		&usage.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("get usage snapshot for reclassify: %w", err)
	}

	usage.WarningLevel, usage.OverLimit = classifyUsageLevelForSite(site.UsersActiveLimit, site.StorageBytesLimit, usage.UsersActiveCount, usage.StorageBytesUsed)
	if err := tx.QueryRow(ctx, `
		UPDATE site_usage_snapshots
		SET warning_level = $2, over_limit = $3, updated_at = NOW()
		WHERE site_id = $1
		RETURNING
			site_id, users_active_count, files_bytes_used, database_bytes_used, storage_bytes_used,
			warning_level, over_limit, last_error, measured_at, created_at, updated_at
	`, site.ID, usage.WarningLevel, usage.OverLimit).Scan(
		&usage.SiteID,
		&usage.UsersActiveCount,
		&usage.FilesBytesUsed,
		&usage.DatabaseBytesUsed,
		&usage.StorageBytesUsed,
		&usage.WarningLevel,
		&usage.OverLimit,
		&usage.LastError,
		&usage.MeasuredAt,
		&usage.CreatedAt,
		&usage.UpdatedAt,
	); err != nil {
		return nil, fmt.Errorf("update usage snapshot after site plan change: %w", err)
	}

	return &usage, nil
}

func classifyUsageLevelForSite(usersLimit int, storageLimit int64, usersUsed int, storageUsed int64) (string, bool) {
	maxRatio := 0.0
	if usersLimit > 0 {
		ratio := float64(usersUsed) / float64(usersLimit)
		if ratio > maxRatio {
			maxRatio = ratio
		}
	}
	if storageLimit > 0 {
		ratio := float64(storageUsed) / float64(storageLimit)
		if ratio > maxRatio {
			maxRatio = ratio
		}
	}

	switch {
	case maxRatio >= 1:
		return "over_limit", true
	case maxRatio >= 0.95:
		return "critical", false
	case maxRatio >= 0.80:
		return "warning", false
	default:
		return "normal", false
	}
}
