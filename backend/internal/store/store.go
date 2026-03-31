package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct {
	pool *pgxpool.Pool
}

var (
	ErrNotFound                    = errors.New("not found")
	ErrConflict                    = errors.New("conflict")
	ErrCapacityExceeded            = errors.New("host capacity exceeded")
	ErrSiteAdminAccessTokenExpired = errors.New("site admin access token expired")
	ErrSiteAdminAccessTokenUsed    = errors.New("site admin access token already used")
)

func Open(ctx context.Context, databaseURL string) (*Store, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("open db pool: %w", err)
	}
	return &Store{pool: pool}, nil
}

func (s *Store) Close() {
	s.pool.Close()
}

func (s *Store) Pool() *pgxpool.Pool {
	return s.pool
}

func (s *Store) Ping(ctx context.Context) error {
	return s.pool.Ping(ctx)
}

// --- Sites ---

func (s *Store) ListSitesByOwner(ctx context.Context, ownerUserID uuid.UUID) ([]Site, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT
			s.id, s.owner_user_id, s.name, s.subdomain, s.plan_code, s.region, s.status, s.site_url, s.admin_url,
			s.admin_name, s.admin_email, s.moodle_username, s.provisioning_step, s.last_error,
			s.users_active_limit, s.storage_bytes_limit, s.web_cpu_millicores, s.web_memory_mib,
			s.cron_cpu_millicores, s.cron_memory_mib, s.activated_at, s.created_at, s.updated_at,
			COALESCE(m.health_status, '') as runtime_health,
			COALESCE(m.last_health_error, '') as runtime_last_error,
			COALESCE(u.users_active_count, 0),
			COALESCE(u.files_bytes_used, 0),
			COALESCE(u.database_bytes_used, 0),
			COALESCE(u.storage_bytes_used, 0),
			COALESCE(NULLIF(u.warning_level, ''), 'normal'),
			COALESCE(u.over_limit, FALSE),
			COALESCE(u.last_error, ''),
			u.measured_at,
			COALESCE(u.created_at, s.created_at),
			COALESCE(u.updated_at, s.updated_at)
		FROM sites s
		LEFT JOIN site_runtime_metadata m ON m.site_id = s.id
		LEFT JOIN site_usage_snapshots u ON u.site_id = s.id
		WHERE s.owner_user_id = $1
		ORDER BY s.created_at DESC
	`, ownerUserID)
	if err != nil {
		return nil, fmt.Errorf("list sites by owner: %w", err)
	}
	defer rows.Close()

	sites := make([]Site, 0)
	for rows.Next() {
		var site Site
		var usage SiteUsageSnapshot
		if err := rows.Scan(
			&site.ID, &site.OwnerUserID, &site.Name, &site.Subdomain, &site.PlanCode, &site.Region, &site.Status, &site.SiteURL, &site.AdminURL,
			&site.AdminName, &site.AdminEmail, &site.MoodleUsername, &site.ProvisioningStep, &site.LastError,
			&site.UsersActiveLimit, &site.StorageBytesLimit, &site.WebCPUMillicores, &site.WebMemoryMiB,
			&site.CronCPUMillicores, &site.CronMemoryMiB, &site.ActivatedAt, &site.CreatedAt, &site.UpdatedAt,
			&site.RuntimeHealth, &site.RuntimeLastError,
			&usage.UsersActiveCount, &usage.FilesBytesUsed, &usage.DatabaseBytesUsed, &usage.StorageBytesUsed,
			&usage.WarningLevel, &usage.OverLimit, &usage.LastError, &usage.MeasuredAt, &usage.CreatedAt, &usage.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan site: %w", err)
		}
		usage.SiteID = site.ID
		site.Usage = &usage
		sites = append(sites, site)
	}
	return sites, rows.Err()
}

func (s *Store) IsSubdomainAvailable(ctx context.Context, subdomain string) (bool, error) {
	var count int
	err := s.pool.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*) FROM sites WHERE subdomain = $1)
			+
			(SELECT COUNT(*) FROM site_checkout_orders WHERE subdomain = $1 AND status IN ('pending_payment', 'paid'))
	`, strings.ToLower(strings.TrimSpace(subdomain))).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("count subdomains: %w", err)
	}
	return count == 0, nil
}

func (s *Store) CreateSite(ctx context.Context, params CreateSiteParams, runtimeMode string, plan Plan, capacity HostCapacityPolicy) (Site, ProvisioningJob, []ProvisioningEvent, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Site{}, ProvisioningJob{}, nil, fmt.Errorf("begin create site tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, int64(2026031701)); err != nil {
		return Site{}, ProvisioningJob{}, nil, fmt.Errorf("lock host capacity policy: %w", err)
	}
	if err := validateHostCapacity(ctx, tx, plan, capacity); err != nil {
		return Site{}, ProvisioningJob{}, nil, err
	}

	now := time.Now().UTC()
	site := Site{
		ID:                   uuid.New(),
		OwnerUserID:          params.OwnerUserID,
		Name:                 params.Name,
		Subdomain:            strings.ToLower(strings.TrimSpace(params.Subdomain)),
		PlanCode:             params.PlanCode,
		Region:               params.Region,
		Status:               "pending",
		SiteURL:              strings.TrimSpace(params.SiteURL),
		AdminURL:             strings.TrimSpace(params.AdminURL),
		AdminName:            params.AdminName,
		AdminEmail:           params.AdminEmail,
		MoodleUsername:       "admin",
		ProvisioningStep:     "pending",
		UsersActiveLimit:     plan.UsersActiveLimit,
		StorageBytesLimit:    plan.StorageBytesLimit,
		WebCPUMillicores:     plan.WebCPUMillicores,
		WebMemoryMiB:         plan.WebMemoryMiB,
		CronCPUMillicores:    plan.CronCPUMillicores,
		CronMemoryMiB:        plan.CronMemoryMiB,
		ReportBootstrapToken: strings.TrimSpace(params.ReportBootstrapToken),
		CreatedAt:            now,
		UpdatedAt:            now,
	}
	if site.SiteURL == "" {
		site.SiteURL = fmt.Sprintf("https://%s.moodlepilot.id", site.Subdomain)
	}
	if site.AdminURL == "" {
		site.AdminURL = fmt.Sprintf("%s/admin", strings.TrimRight(site.SiteURL, "/"))
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO sites (
			id, owner_user_id, name, subdomain, plan_code, region, status, site_url, admin_url,
			admin_name, admin_email, moodle_username, provisioning_step, users_active_limit,
			storage_bytes_limit, web_cpu_millicores, web_memory_mib, cron_cpu_millicores,
			cron_memory_mib, report_bootstrap_token, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
	`, site.ID, site.OwnerUserID, site.Name, site.Subdomain, site.PlanCode, site.Region, site.Status, site.SiteURL, site.AdminURL, site.AdminName, site.AdminEmail, site.MoodleUsername, site.ProvisioningStep, site.UsersActiveLimit, site.StorageBytesLimit, site.WebCPUMillicores, site.WebMemoryMiB, site.CronCPUMillicores, site.CronMemoryMiB, site.ReportBootstrapToken, site.CreatedAt, site.UpdatedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return Site{}, ProvisioningJob{}, nil, fmt.Errorf("%w: subdomain sudah digunakan", ErrConflict)
		}
		return Site{}, ProvisioningJob{}, nil, fmt.Errorf("insert site: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO site_usage_snapshots (
			site_id, users_active_count, files_bytes_used, database_bytes_used, storage_bytes_used,
			warning_level, over_limit, last_error, measured_at, created_at, updated_at
		)
		VALUES ($1, 0, 0, 0, 0, 'normal', FALSE, '', NULL, $2, $2)
	`, site.ID, now); err != nil {
		return Site{}, ProvisioningJob{}, nil, fmt.Errorf("insert site usage snapshot: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO site_backup_settings (site_id, enabled, frequency, retention_days, created_at, updated_at)
		VALUES ($1, TRUE, 'daily', 30, $2, $2)
	`, site.ID, now); err != nil {
		return Site{}, ProvisioningJob{}, nil, fmt.Errorf("insert site backup settings: %w", err)
	}

	job := ProvisioningJob{
		ID:          uuid.New(),
		SiteID:      site.ID,
		RuntimeMode: runtimeMode,
		Status:      "pending",
		CurrentStep: "pending",
		Percent:     0,
		LastError:   "",
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO provisioning_jobs (id, site_id, runtime_mode, status, current_step, percent, last_error, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, job.ID, job.SiteID, job.RuntimeMode, job.Status, job.CurrentStep, job.Percent, job.LastError, job.CreatedAt, job.UpdatedAt)
	if err != nil {
		return Site{}, ProvisioningJob{}, nil, fmt.Errorf("insert provisioning job: %w", err)
	}

	events := defaultProvisioningEvents(job.ID, now)
	for _, event := range events {
		_, err = tx.Exec(ctx, `
			INSERT INTO provisioning_events (id, job_id, step_id, title, description, status, position, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		`, event.ID, event.JobID, event.StepID, event.Title, event.Description, event.Status, event.Position, event.CreatedAt, event.UpdatedAt)
		if err != nil {
			return Site{}, ProvisioningJob{}, nil, fmt.Errorf("insert provisioning event: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return Site{}, ProvisioningJob{}, nil, fmt.Errorf("commit create site tx: %w", err)
	}
	return site, job, events, nil
}

func (s *Store) UpsertSiteRuntimeMetadata(ctx context.Context, params UpsertSiteRuntimeMetadataParams) (SiteRuntimeMetadata, error) {
	now := time.Now().UTC()
	metadata := SiteRuntimeMetadata{
		SiteID:               params.SiteID,
		ImageRepository:      strings.TrimSpace(params.ImageRepository),
		ImageTag:             strings.TrimSpace(params.ImageTag),
		WebContainerName:     strings.TrimSpace(params.WebContainerName),
		CronContainerName:    strings.TrimSpace(params.CronContainerName),
		VolumeName:           strings.TrimSpace(params.VolumeName),
		DatabaseName:         strings.TrimSpace(params.DatabaseName),
		DatabaseUser:         strings.TrimSpace(params.DatabaseUser),
		HealthStatus:         strings.TrimSpace(params.HealthStatus),
		LastHealthError:      strings.TrimSpace(params.LastHealthError),
		ReportBootstrapToken: strings.TrimSpace(params.ReportBootstrapToken),
		UpdatedAt:            now,
	}
	if metadata.HealthStatus == "" {
		metadata.HealthStatus = "unknown"
	}

	err := s.pool.QueryRow(ctx, `
		INSERT INTO site_runtime_metadata (
			site_id, image_repository, image_tag, web_container_name, cron_container_name, volume_name,
			database_name, database_user, health_status, last_health_error, report_bootstrap_token, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
		ON CONFLICT (site_id) DO UPDATE SET
			image_repository = EXCLUDED.image_repository,
			image_tag = EXCLUDED.image_tag,
			web_container_name = EXCLUDED.web_container_name,
			cron_container_name = EXCLUDED.cron_container_name,
			volume_name = EXCLUDED.volume_name,
			database_name = EXCLUDED.database_name,
			database_user = EXCLUDED.database_user,
			health_status = EXCLUDED.health_status,
			last_health_error = EXCLUDED.last_health_error,
			report_bootstrap_token = CASE
				WHEN EXCLUDED.report_bootstrap_token <> '' THEN EXCLUDED.report_bootstrap_token
				ELSE site_runtime_metadata.report_bootstrap_token
			END,
			updated_at = EXCLUDED.updated_at
		RETURNING site_id, image_repository, image_tag, web_container_name, cron_container_name, volume_name,
		          database_name, database_user, health_status, last_health_error, report_bootstrap_token, last_health_checked_at, created_at, updated_at
	`, metadata.SiteID, metadata.ImageRepository, metadata.ImageTag, metadata.WebContainerName, metadata.CronContainerName, metadata.VolumeName, metadata.DatabaseName, metadata.DatabaseUser, metadata.HealthStatus, metadata.LastHealthError, metadata.ReportBootstrapToken, now).Scan(
		&metadata.SiteID, &metadata.ImageRepository, &metadata.ImageTag, &metadata.WebContainerName, &metadata.CronContainerName, &metadata.VolumeName,
		&metadata.DatabaseName, &metadata.DatabaseUser, &metadata.HealthStatus, &metadata.LastHealthError, &metadata.ReportBootstrapToken, &metadata.LastHealthCheckedAt, &metadata.CreatedAt, &metadata.UpdatedAt,
	)
	if err != nil {
		return SiteRuntimeMetadata{}, fmt.Errorf("upsert site runtime metadata: %w", err)
	}
	return metadata, nil
}

func (s *Store) GetSiteRuntimeMetadata(ctx context.Context, siteID uuid.UUID) (SiteRuntimeMetadata, error) {
	var metadata SiteRuntimeMetadata
	err := s.pool.QueryRow(ctx, `
		SELECT site_id, image_repository, image_tag, web_container_name, cron_container_name, volume_name,
		       database_name, database_user, health_status, last_health_error, report_bootstrap_token, last_health_checked_at, created_at, updated_at
		FROM site_runtime_metadata
		WHERE site_id = $1
	`, siteID).Scan(
		&metadata.SiteID, &metadata.ImageRepository, &metadata.ImageTag, &metadata.WebContainerName, &metadata.CronContainerName, &metadata.VolumeName,
		&metadata.DatabaseName, &metadata.DatabaseUser, &metadata.HealthStatus, &metadata.LastHealthError, &metadata.ReportBootstrapToken, &metadata.LastHealthCheckedAt, &metadata.CreatedAt, &metadata.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SiteRuntimeMetadata{}, ErrNotFound
		}
		return SiteRuntimeMetadata{}, fmt.Errorf("get site runtime metadata: %w", err)
	}
	return metadata, nil
}

func (s *Store) UpdateSiteRuntimeHealth(ctx context.Context, siteID uuid.UUID, healthStatus, lastHealthError string) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE site_runtime_metadata
		SET health_status = $2, last_health_error = $3, last_health_checked_at = NOW(), updated_at = NOW()
		WHERE site_id = $1
	`, siteID, strings.TrimSpace(healthStatus), strings.TrimSpace(lastHealthError))
	if err != nil {
		return fmt.Errorf("update site runtime health: %w", err)
	}
	return nil
}

func (s *Store) GetProvisioningContextByJobID(ctx context.Context, jobID uuid.UUID) (Site, ProvisioningJob, *SiteRuntimeMetadata, error) {
	var site Site
	var job ProvisioningJob
	err := s.pool.QueryRow(ctx, `
		SELECT
			pj.id, pj.site_id, pj.runtime_mode, pj.status, pj.current_step, pj.percent, pj.last_error, pj.created_at, pj.updated_at,
			s.id, s.owner_user_id, s.name, s.subdomain, s.plan_code, s.region, s.status, s.site_url, s.admin_url,
			s.admin_name, s.admin_email, s.moodle_username, s.provisioning_step, s.last_error,
			s.users_active_limit, s.storage_bytes_limit, s.web_cpu_millicores, s.web_memory_mib,
			s.cron_cpu_millicores, s.cron_memory_mib, s.report_bootstrap_token, s.activated_at, s.created_at, s.updated_at
		FROM provisioning_jobs pj
		JOIN sites s ON s.id = pj.site_id
		WHERE pj.id = $1
	`, jobID).Scan(
		&job.ID, &job.SiteID, &job.RuntimeMode, &job.Status, &job.CurrentStep, &job.Percent, &job.LastError, &job.CreatedAt, &job.UpdatedAt,
		&site.ID, &site.OwnerUserID, &site.Name, &site.Subdomain, &site.PlanCode, &site.Region, &site.Status, &site.SiteURL, &site.AdminURL,
		&site.AdminName, &site.AdminEmail, &site.MoodleUsername, &site.ProvisioningStep, &site.LastError,
		&site.UsersActiveLimit, &site.StorageBytesLimit, &site.WebCPUMillicores, &site.WebMemoryMiB,
		&site.CronCPUMillicores, &site.CronMemoryMiB, &site.ReportBootstrapToken, &site.ActivatedAt, &site.CreatedAt, &site.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Site{}, ProvisioningJob{}, nil, ErrNotFound
		}
		return Site{}, ProvisioningJob{}, nil, fmt.Errorf("get provisioning context: %w", err)
	}

	runtimeMetadata, err := s.GetSiteRuntimeMetadata(ctx, site.ID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return site, job, nil, nil
		}
		return Site{}, ProvisioningJob{}, nil, err
	}
	return site, job, &runtimeMetadata, nil
}

func (s *Store) GetSiteBySubdomainForOwner(ctx context.Context, ownerUserID uuid.UUID, subdomain string) (Site, error) {
	var site Site
	err := s.pool.QueryRow(ctx, `
		SELECT
			s.id, s.owner_user_id, s.name, s.subdomain, s.plan_code, s.region, s.status, s.site_url, s.admin_url,
			s.admin_name, s.admin_email, s.moodle_username, s.provisioning_step, s.last_error,
			s.users_active_limit, s.storage_bytes_limit, s.web_cpu_millicores, s.web_memory_mib,
			s.cron_cpu_millicores, s.cron_memory_mib, s.activated_at, s.created_at, s.updated_at,
			COALESCE(m.health_status, '') as runtime_health,
			COALESCE(m.last_health_error, '') as runtime_last_error
		FROM sites s
		LEFT JOIN site_runtime_metadata m ON m.site_id = s.id
		WHERE s.owner_user_id = $1 AND s.subdomain = $2
	`, ownerUserID, strings.ToLower(strings.TrimSpace(subdomain))).Scan(
		&site.ID, &site.OwnerUserID, &site.Name, &site.Subdomain, &site.PlanCode, &site.Region, &site.Status, &site.SiteURL, &site.AdminURL, &site.AdminName, &site.AdminEmail, &site.MoodleUsername, &site.ProvisioningStep, &site.LastError,
		&site.UsersActiveLimit, &site.StorageBytesLimit, &site.WebCPUMillicores, &site.WebMemoryMiB, &site.CronCPUMillicores, &site.CronMemoryMiB, &site.ActivatedAt, &site.CreatedAt, &site.UpdatedAt,
		&site.RuntimeHealth, &site.RuntimeLastError,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Site{}, ErrNotFound
		}
		return Site{}, fmt.Errorf("get site by subdomain: %w", err)
	}
	return site, nil
}

func (s *Store) GetSiteByIDForOwner(ctx context.Context, ownerUserID, siteID uuid.UUID) (Site, error) {
	var site Site
	err := s.pool.QueryRow(ctx, `
		SELECT
			s.id, s.owner_user_id, s.name, s.subdomain, s.plan_code, s.region, s.status, s.site_url, s.admin_url,
			s.admin_name, s.admin_email, s.moodle_username, s.provisioning_step, s.last_error,
			s.users_active_limit, s.storage_bytes_limit, s.web_cpu_millicores, s.web_memory_mib,
			s.cron_cpu_millicores, s.cron_memory_mib, s.activated_at, s.created_at, s.updated_at,
			COALESCE(m.health_status, '') as runtime_health,
			COALESCE(m.last_health_error, '') as runtime_last_error
		FROM sites s
		LEFT JOIN site_runtime_metadata m ON m.site_id = s.id
		WHERE s.owner_user_id = $1 AND s.id = $2
	`, ownerUserID, siteID).Scan(
		&site.ID, &site.OwnerUserID, &site.Name, &site.Subdomain, &site.PlanCode, &site.Region, &site.Status, &site.SiteURL, &site.AdminURL, &site.AdminName, &site.AdminEmail, &site.MoodleUsername, &site.ProvisioningStep, &site.LastError,
		&site.UsersActiveLimit, &site.StorageBytesLimit, &site.WebCPUMillicores, &site.WebMemoryMiB, &site.CronCPUMillicores, &site.CronMemoryMiB, &site.ActivatedAt, &site.CreatedAt, &site.UpdatedAt,
		&site.RuntimeHealth, &site.RuntimeLastError,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Site{}, ErrNotFound
		}
		return Site{}, fmt.Errorf("get site by id: %w", err)
	}
	return site, nil
}

func (s *Store) GetProvisioningStatusBySiteID(ctx context.Context, ownerUserID, siteID uuid.UUID) (ProvisioningStatus, error) {
	site, err := s.GetSiteByIDForOwner(ctx, ownerUserID, siteID)
	if err != nil {
		return ProvisioningStatus{}, err
	}
	return s.getProvisioningStatusBySiteID(ctx, site.ID, site)
}

func (s *Store) GetProvisioningStatusBySubdomain(ctx context.Context, ownerUserID uuid.UUID, subdomain string) (ProvisioningStatus, error) {
	site, err := s.GetSiteBySubdomainForOwner(ctx, ownerUserID, subdomain)
	if err != nil {
		return ProvisioningStatus{}, err
	}
	return s.getProvisioningStatusBySiteID(ctx, site.ID, site)
}

func (s *Store) getProvisioningStatusBySiteID(ctx context.Context, siteID uuid.UUID, site Site) (ProvisioningStatus, error) {
	var job ProvisioningJob
	err := s.pool.QueryRow(ctx, `
		SELECT id, site_id, runtime_mode, status, current_step, percent, last_error, created_at, updated_at
		FROM provisioning_jobs
		WHERE site_id = $1
	`, siteID).Scan(&job.ID, &job.SiteID, &job.RuntimeMode, &job.Status, &job.CurrentStep, &job.Percent, &job.LastError, &job.CreatedAt, &job.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ProvisioningStatus{}, ErrNotFound
		}
		return ProvisioningStatus{}, fmt.Errorf("get provisioning job: %w", err)
	}

	rows, err := s.pool.Query(ctx, `
		SELECT id, job_id, step_id, title, description, status, position, created_at, updated_at
		FROM provisioning_events
		WHERE job_id = $1
		ORDER BY position ASC
	`, job.ID)
	if err != nil {
		return ProvisioningStatus{}, fmt.Errorf("list provisioning events: %w", err)
	}
	defer rows.Close()

	var events []ProvisioningEvent
	for rows.Next() {
		var event ProvisioningEvent
		if err := rows.Scan(&event.ID, &event.JobID, &event.StepID, &event.Title, &event.Description, &event.Status, &event.Position, &event.CreatedAt, &event.UpdatedAt); err != nil {
			return ProvisioningStatus{}, fmt.Errorf("scan provisioning event: %w", err)
		}
		events = append(events, event)
	}
	if err := rows.Err(); err != nil {
		return ProvisioningStatus{}, err
	}

	var runtimeMetadata *SiteRuntimeMetadata
	metadata, err := s.GetSiteRuntimeMetadata(ctx, site.ID)
	if err != nil {
		if !errors.Is(err, ErrNotFound) {
			return ProvisioningStatus{}, err
		}
	} else {
		runtimeMetadata = &metadata
	}

	return ProvisioningStatus{Site: site, Job: job, Runtime: runtimeMetadata, Events: events}, nil
}

func (s *Store) GetSiteUsageBySiteIDForOwner(ctx context.Context, ownerUserID, siteID uuid.UUID) (SiteUsageSnapshot, error) {
	if _, err := s.GetSiteByIDForOwner(ctx, ownerUserID, siteID); err != nil {
		return SiteUsageSnapshot{}, err
	}

	return s.GetSiteUsageBySiteID(ctx, siteID)
}

func (s *Store) GetSiteUsageBySiteID(ctx context.Context, siteID uuid.UUID) (SiteUsageSnapshot, error) {
	var usage SiteUsageSnapshot
	err := s.pool.QueryRow(ctx, `
		SELECT
			site_id, users_active_count, files_bytes_used, database_bytes_used, storage_bytes_used,
			warning_level, over_limit, last_error, measured_at, created_at, updated_at
		FROM site_usage_snapshots
		WHERE site_id = $1
	`, siteID).Scan(
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
			return SiteUsageSnapshot{}, ErrNotFound
		}
		return SiteUsageSnapshot{}, fmt.Errorf("get site usage snapshot: %w", err)
	}
	return usage, nil
}

func (s *Store) UpsertSiteUsageSnapshot(ctx context.Context, usage SiteUsageSnapshot) (SiteUsageSnapshot, error) {
	now := time.Now().UTC()
	if usage.WarningLevel == "" {
		usage.WarningLevel = "normal"
	}

	err := s.pool.QueryRow(ctx, `
		INSERT INTO site_usage_snapshots (
			site_id, users_active_count, files_bytes_used, database_bytes_used, storage_bytes_used,
			warning_level, over_limit, last_error, measured_at, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
		ON CONFLICT (site_id) DO UPDATE SET
			users_active_count = EXCLUDED.users_active_count,
			files_bytes_used = EXCLUDED.files_bytes_used,
			database_bytes_used = EXCLUDED.database_bytes_used,
			storage_bytes_used = EXCLUDED.storage_bytes_used,
			warning_level = EXCLUDED.warning_level,
			over_limit = EXCLUDED.over_limit,
			last_error = EXCLUDED.last_error,
			measured_at = EXCLUDED.measured_at,
			updated_at = EXCLUDED.updated_at
		RETURNING
			site_id, users_active_count, files_bytes_used, database_bytes_used, storage_bytes_used,
			warning_level, over_limit, last_error, measured_at, created_at, updated_at
	`, usage.SiteID, usage.UsersActiveCount, usage.FilesBytesUsed, usage.DatabaseBytesUsed, usage.StorageBytesUsed, usage.WarningLevel, usage.OverLimit, strings.TrimSpace(usage.LastError), usage.MeasuredAt, now).Scan(
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
		return SiteUsageSnapshot{}, fmt.Errorf("upsert site usage snapshot: %w", err)
	}
	return usage, nil
}

func (s *Store) ListProvisioningContextsForUsageMetering(ctx context.Context) ([]SiteProvisioningContext, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT
			s.id, s.owner_user_id, s.name, s.subdomain, s.plan_code, s.region, s.status, s.site_url, s.admin_url,
			s.admin_name, s.admin_email, s.moodle_username, s.provisioning_step, s.last_error,
			s.users_active_limit, s.storage_bytes_limit, s.web_cpu_millicores, s.web_memory_mib,
			s.cron_cpu_millicores, s.cron_memory_mib, s.activated_at, s.created_at, s.updated_at,
			pj.id, pj.site_id, pj.runtime_mode, pj.status, pj.current_step, pj.percent, pj.last_error, pj.created_at, pj.updated_at,
			srm.site_id, srm.image_repository, srm.image_tag, srm.web_container_name, srm.cron_container_name,
			srm.volume_name, srm.database_name, srm.database_user, srm.health_status, srm.last_health_error,
			srm.last_health_checked_at, srm.created_at, srm.updated_at
		FROM sites s
		JOIN provisioning_jobs pj ON pj.site_id = s.id
		JOIN site_runtime_metadata srm ON srm.site_id = s.id
		WHERE pj.runtime_mode = 'docker_local'
		ORDER BY s.created_at ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("list provisioning contexts for usage metering: %w", err)
	}
	defer rows.Close()

	contexts := make([]SiteProvisioningContext, 0)
	for rows.Next() {
		var item SiteProvisioningContext
		var runtime SiteRuntimeMetadata
		if err := rows.Scan(
			&item.Site.ID, &item.Site.OwnerUserID, &item.Site.Name, &item.Site.Subdomain, &item.Site.PlanCode, &item.Site.Region, &item.Site.Status, &item.Site.SiteURL, &item.Site.AdminURL,
			&item.Site.AdminName, &item.Site.AdminEmail, &item.Site.MoodleUsername, &item.Site.ProvisioningStep, &item.Site.LastError,
			&item.Site.UsersActiveLimit, &item.Site.StorageBytesLimit, &item.Site.WebCPUMillicores, &item.Site.WebMemoryMiB,
			&item.Site.CronCPUMillicores, &item.Site.CronMemoryMiB, &item.Site.ActivatedAt, &item.Site.CreatedAt, &item.Site.UpdatedAt,
			&item.Job.ID, &item.Job.SiteID, &item.Job.RuntimeMode, &item.Job.Status, &item.Job.CurrentStep, &item.Job.Percent, &item.Job.LastError, &item.Job.CreatedAt, &item.Job.UpdatedAt,
			&runtime.SiteID, &runtime.ImageRepository, &runtime.ImageTag, &runtime.WebContainerName, &runtime.CronContainerName,
			&runtime.VolumeName, &runtime.DatabaseName, &runtime.DatabaseUser, &runtime.HealthStatus, &runtime.LastHealthError,
			&runtime.LastHealthCheckedAt, &runtime.CreatedAt, &runtime.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan provisioning context for usage metering: %w", err)
		}
		item.Runtime = &runtime
		contexts = append(contexts, item)
	}
	return contexts, rows.Err()
}

func (s *Store) StartProvisioningStep(ctx context.Context, jobID uuid.UUID, stepID string, percent int) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin start provisioning step tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `
		UPDATE provisioning_jobs
		SET status = 'provisioning', current_step = $2, percent = $3, updated_at = NOW(), last_error = ''
		WHERE id = $1
	`, jobID, stepID, percent); err != nil {
		return fmt.Errorf("update provisioning job start: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		UPDATE provisioning_events
		SET status = CASE WHEN step_id = $2 THEN 'in_progress' ELSE status END,
			updated_at = NOW()
		WHERE job_id = $1
	`, jobID, stepID); err != nil {
		return fmt.Errorf("update provisioning event start: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		UPDATE sites
		SET status = 'provisioning', provisioning_step = $2, updated_at = NOW(), last_error = ''
		WHERE id = (SELECT site_id FROM provisioning_jobs WHERE id = $1)
	`, jobID, stepID); err != nil {
		return fmt.Errorf("update site start provisioning: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit start provisioning step tx: %w", err)
	}
	return nil
}

func (s *Store) CompleteProvisioningStep(ctx context.Context, jobID uuid.UUID, stepID string, percent int) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin complete provisioning step tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `
		UPDATE provisioning_events
		SET status = 'completed', updated_at = NOW()
		WHERE job_id = $1 AND step_id = $2
	`, jobID, stepID); err != nil {
		return fmt.Errorf("complete provisioning event: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		UPDATE provisioning_jobs
		SET current_step = $2, percent = $3, updated_at = NOW()
		WHERE id = $1
	`, jobID, stepID, percent); err != nil {
		return fmt.Errorf("update provisioning job complete: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		UPDATE sites
		SET provisioning_step = $2, updated_at = NOW()
		WHERE id = (SELECT site_id FROM provisioning_jobs WHERE id = $1)
	`, jobID, stepID); err != nil {
		return fmt.Errorf("update site complete provisioning: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit complete provisioning step tx: %w", err)
	}
	return nil
}

func (s *Store) ActivateProvisioningJob(ctx context.Context, jobID uuid.UUID) (Site, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Site{}, fmt.Errorf("begin activate provisioning tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	now := time.Now().UTC()
	if _, err := tx.Exec(ctx, `
		UPDATE provisioning_jobs
		SET status = 'active', current_step = 'finalize', percent = 100, updated_at = $2
		WHERE id = $1
	`, jobID, now); err != nil {
		return Site{}, fmt.Errorf("activate provisioning job: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		UPDATE provisioning_events
		SET status = 'completed', updated_at = $2
		WHERE job_id = $1
	`, jobID, now); err != nil {
		return Site{}, fmt.Errorf("complete all provisioning events: %w", err)
	}

	var site Site
	err = tx.QueryRow(ctx, `
		UPDATE sites
		SET status = 'active', provisioning_step = 'finalize', activated_at = $2, updated_at = $2, last_error = ''
		WHERE id = (SELECT site_id FROM provisioning_jobs WHERE id = $1)
		RETURNING id, owner_user_id, name, subdomain, plan_code, region, status, site_url, admin_url, admin_name, admin_email, moodle_username, provisioning_step, last_error, activated_at, created_at, updated_at
	`, jobID, now).Scan(
		&site.ID, &site.OwnerUserID, &site.Name, &site.Subdomain, &site.PlanCode, &site.Region, &site.Status, &site.SiteURL, &site.AdminURL, &site.AdminName, &site.AdminEmail, &site.MoodleUsername, &site.ProvisioningStep, &site.LastError, &site.ActivatedAt, &site.CreatedAt, &site.UpdatedAt,
	)
	if err != nil {
		return Site{}, fmt.Errorf("activate site: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return Site{}, fmt.Errorf("commit activate provisioning tx: %w", err)
	}
	return site, nil
}

func (s *Store) FailProvisioningJob(ctx context.Context, jobID uuid.UUID, stepID, failure string) (Site, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Site{}, fmt.Errorf("begin fail provisioning tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `
		UPDATE provisioning_jobs
		SET status = 'failed', current_step = $2, last_error = $3, updated_at = NOW()
		WHERE id = $1
	`, jobID, stepID, failure); err != nil {
		return Site{}, fmt.Errorf("fail provisioning job: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		UPDATE provisioning_events
		SET status = CASE WHEN step_id = $2 THEN 'error' ELSE status END, updated_at = NOW()
		WHERE job_id = $1
	`, jobID, stepID); err != nil {
		return Site{}, fmt.Errorf("fail provisioning event: %w", err)
	}

	var site Site
	err = tx.QueryRow(ctx, `
		UPDATE sites
		SET status = 'failed', provisioning_step = $2, last_error = $3, updated_at = NOW()
		WHERE id = (SELECT site_id FROM provisioning_jobs WHERE id = $1)
		RETURNING id, owner_user_id, name, subdomain, plan_code, region, status, site_url, admin_url, admin_name, admin_email, moodle_username, provisioning_step, last_error, activated_at, created_at, updated_at
	`, jobID, stepID, failure).Scan(
		&site.ID, &site.OwnerUserID, &site.Name, &site.Subdomain, &site.PlanCode, &site.Region, &site.Status, &site.SiteURL, &site.AdminURL, &site.AdminName, &site.AdminEmail, &site.MoodleUsername, &site.ProvisioningStep, &site.LastError, &site.ActivatedAt, &site.CreatedAt, &site.UpdatedAt,
	)
	if err != nil {
		return Site{}, fmt.Errorf("fail site: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return Site{}, fmt.Errorf("commit fail provisioning tx: %w", err)
	}
	return site, nil
}

func (s *Store) ListOrphanedProvisioningJobs(ctx context.Context, staleThreshold time.Duration) ([]ProvisioningJob, error) {
	cutoff := time.Now().UTC().Add(-staleThreshold)
	rows, err := s.pool.Query(ctx, `
		SELECT id, site_id, runtime_mode, status, current_step, percent, last_error, created_at, updated_at
		FROM provisioning_jobs
		WHERE status = 'pending' AND created_at < $1
		ORDER BY created_at ASC
	`, cutoff)
	if err != nil {
		return nil, fmt.Errorf("list orphaned provisioning jobs: %w", err)
	}
	defer rows.Close()

	var jobs []ProvisioningJob
	for rows.Next() {
		var job ProvisioningJob
		if err := rows.Scan(&job.ID, &job.SiteID, &job.RuntimeMode, &job.Status, &job.CurrentStep, &job.Percent, &job.LastError, &job.CreatedAt, &job.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan orphaned provisioning job: %w", err)
		}
		jobs = append(jobs, job)
	}
	return jobs, rows.Err()
}

func (s *Store) ResetProvisioningSteps(ctx context.Context, jobID uuid.UUID) error {
	if _, err := s.pool.Exec(ctx, `
		UPDATE provisioning_events
		SET status = 'pending', updated_at = NOW()
		WHERE job_id = $1 AND status IN ('in_progress', 'error', 'completed')
	`, jobID); err != nil {
		return fmt.Errorf("reset provisioning steps: %w", err)
	}
	if _, err := s.pool.Exec(ctx, `
		UPDATE provisioning_jobs
		SET status = 'running', current_step = '', last_error = '', percent = 0, updated_at = NOW()
		WHERE id = $1
	`, jobID); err != nil {
		return fmt.Errorf("reset provisioning job status: %w", err)
	}
	if _, err := s.pool.Exec(ctx, `
		UPDATE sites
		SET status = 'provisioning', provisioning_step = '', last_error = '', updated_at = NOW()
		WHERE id = (SELECT site_id FROM provisioning_jobs WHERE id = $1)
	`, jobID); err != nil {
		return fmt.Errorf("reset site status for retry: %w", err)
	}
	return nil
}

// --- Helpers ---

func defaultProvisioningEvents(jobID uuid.UUID, now time.Time) []ProvisioningEvent {
	return []ProvisioningEvent{
		{ID: uuid.New(), JobID: jobID, StepID: "provision", Title: "Menyiapkan Server", Description: "Mengalokasikan sumber daya server untuk situs Anda", Status: "pending", Position: 1, CreatedAt: now, UpdatedAt: now},
		{ID: uuid.New(), JobID: jobID, StepID: "database", Title: "Membuat Database", Description: "Menyiapkan database Moodle", Status: "pending", Position: 2, CreatedAt: now, UpdatedAt: now},
		{ID: uuid.New(), JobID: jobID, StepID: "install", Title: "Instalasi Moodle", Description: "Menginstal dan mengkonfigurasi Moodle versi terbaru", Status: "pending", Position: 3, CreatedAt: now, UpdatedAt: now},
		{ID: uuid.New(), JobID: jobID, StepID: "ssl", Title: "Konfigurasi SSL", Description: "Mengaktifkan sertifikat SSL untuk keamanan", Status: "pending", Position: 4, CreatedAt: now, UpdatedAt: now},
		{ID: uuid.New(), JobID: jobID, StepID: "finalize", Title: "Finalisasi", Description: "Menyelesaikan konfigurasi dan menyiapkan akun admin", Status: "pending", Position: 5, CreatedAt: now, UpdatedAt: now},
	}
}

func scanSite(row interface {
	Scan(dest ...interface{}) error
}, site *Site) error {
	if err := row.Scan(
		&site.ID, &site.OwnerUserID, &site.Name, &site.Subdomain, &site.PlanCode, &site.Region, &site.Status, &site.SiteURL, &site.AdminURL, &site.AdminName, &site.AdminEmail, &site.MoodleUsername, &site.ProvisioningStep, &site.LastError,
		&site.UsersActiveLimit, &site.StorageBytesLimit, &site.WebCPUMillicores, &site.WebMemoryMiB, &site.CronCPUMillicores, &site.CronMemoryMiB,
		&site.ActivatedAt, &site.CreatedAt, &site.UpdatedAt,
		&site.RuntimeHealth, &site.RuntimeLastError,
	); err != nil {
		return fmt.Errorf("scan site: %w", err)
	}
	return nil
}

func validateHostCapacity(ctx context.Context, tx pgx.Tx, plan Plan, capacity HostCapacityPolicy) error {
	return validateHostCapacityWithReservations(ctx, tx, plan, capacity, nil)
}

func validateHostCapacityChange(ctx context.Context, tx pgx.Tx, currentSite Site, targetPlan Plan, capacity HostCapacityPolicy) error {
	var reservedStorage int64
	var reservedCPU int64
	var reservedMemory int64
	if err := tx.QueryRow(ctx, `
		SELECT
			COALESCE(SUM(storage_bytes_limit), 0),
			COALESCE(SUM(web_cpu_millicores + cron_cpu_millicores), 0),
			COALESCE(SUM(web_memory_mib + cron_memory_mib), 0)
		FROM (
			SELECT
				storage_bytes_limit,
				web_cpu_millicores,
				cron_cpu_millicores,
				web_memory_mib,
				cron_memory_mib
			FROM sites
			WHERE status NOT IN ('failed', 'deleted')
			  AND id <> $1
			UNION ALL
			SELECT
				storage_bytes_limit,
				web_cpu_millicores,
				cron_cpu_millicores,
				web_memory_mib,
				cron_memory_mib
			FROM site_checkout_orders
			WHERE status IN ('pending_payment', 'paid')
		) reservations
	`, currentSite.ID).Scan(&reservedStorage, &reservedCPU, &reservedMemory); err != nil {
		return fmt.Errorf("read host capacity reservations for plan change: %w", err)
	}

	requestedCPU := int64(targetPlan.WebCPUMillicores + targetPlan.CronCPUMillicores)
	requestedMemory := int64(targetPlan.WebMemoryMiB + targetPlan.CronMemoryMiB)

	switch {
	case capacity.StorageBytesLimit > 0 && reservedStorage+targetPlan.StorageBytesLimit > capacity.StorageBytesLimit:
		return fmt.Errorf("%w: storage host tidak cukup untuk paket %s", ErrCapacityExceeded, targetPlan.Code)
	case capacity.CPUMillicoresLimit > 0 && reservedCPU+requestedCPU > int64(capacity.CPUMillicoresLimit):
		return fmt.Errorf("%w: CPU host tidak cukup untuk paket %s", ErrCapacityExceeded, targetPlan.Code)
	case capacity.MemoryMiBLimit > 0 && reservedMemory+requestedMemory > int64(capacity.MemoryMiBLimit):
		return fmt.Errorf("%w: memori host tidak cukup untuk paket %s", ErrCapacityExceeded, targetPlan.Code)
	default:
		return nil
	}
}

func validateHostCapacityWithReservations(ctx context.Context, tx pgx.Tx, plan Plan, capacity HostCapacityPolicy, excludeOrderID *uuid.UUID) error {
	var reservedStorage int64
	var reservedCPU int64
	var reservedMemory int64
	if err := tx.QueryRow(ctx, `
		SELECT
			COALESCE(SUM(storage_bytes_limit), 0),
			COALESCE(SUM(web_cpu_millicores + cron_cpu_millicores), 0),
			COALESCE(SUM(web_memory_mib + cron_memory_mib), 0)
		FROM (
			SELECT
				storage_bytes_limit,
				web_cpu_millicores,
				cron_cpu_millicores,
				web_memory_mib,
				cron_memory_mib
			FROM sites
			WHERE status NOT IN ('failed', 'deleted')
			UNION ALL
			SELECT
				storage_bytes_limit,
				web_cpu_millicores,
				cron_cpu_millicores,
				web_memory_mib,
				cron_memory_mib
			FROM site_checkout_orders
			WHERE status IN ('pending_payment', 'paid')
				AND ($1::uuid IS NULL OR id <> $1)
		) reservations
	`, excludeOrderID).Scan(&reservedStorage, &reservedCPU, &reservedMemory); err != nil {
		return fmt.Errorf("read host capacity reservations: %w", err)
	}

	requestedCPU := int64(plan.WebCPUMillicores + plan.CronCPUMillicores)
	requestedMemory := int64(plan.WebMemoryMiB + plan.CronMemoryMiB)

	switch {
	case capacity.StorageBytesLimit > 0 && reservedStorage+plan.StorageBytesLimit > capacity.StorageBytesLimit:
		return fmt.Errorf("%w: storage host tidak cukup untuk paket %s", ErrCapacityExceeded, plan.Code)
	case capacity.CPUMillicoresLimit > 0 && reservedCPU+requestedCPU > int64(capacity.CPUMillicoresLimit):
		return fmt.Errorf("%w: CPU host tidak cukup untuk paket %s", ErrCapacityExceeded, plan.Code)
	case capacity.MemoryMiBLimit > 0 && reservedMemory+requestedMemory > int64(capacity.MemoryMiBLimit):
		return fmt.Errorf("%w: memori host tidak cukup untuk paket %s", ErrCapacityExceeded, plan.Code)
	default:
		return nil
	}
}

func int64Ptr(value int64) *int64 {
	return &value
}
