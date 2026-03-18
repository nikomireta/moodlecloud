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
)

const (
	SiteBackupFrequencyDaily   = "daily"
	SiteBackupFrequencyWeekly  = "weekly"
	SiteBackupFrequencyMonthly = "monthly"
)

func normalizeSiteBackupFrequency(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func validSiteBackupFrequency(value string) bool {
	switch normalizeSiteBackupFrequency(value) {
	case SiteBackupFrequencyDaily, SiteBackupFrequencyWeekly, SiteBackupFrequencyMonthly:
		return true
	default:
		return false
	}
}

func validSiteBackupRetentionDays(value int) bool {
	switch value {
	case 7, 30, 90:
		return true
	default:
		return false
	}
}

func scanSiteBackup(scanner interface {
	Scan(dest ...any) error
}) (SiteBackup, error) {
	var backup SiteBackup
	var siteID uuid.NullUUID
	err := scanner.Scan(
		&backup.ID,
		&backup.OwnerUserID,
		&siteID,
		&backup.SiteName,
		&backup.SiteSubdomain,
		&backup.Trigger,
		&backup.Status,
		&backup.ObjectKey,
		&backup.SizeBytes,
		&backup.SHA256,
		&backup.ExpiresAt,
		&backup.LastError,
		&backup.StartedAt,
		&backup.CompletedAt,
		&backup.CreatedAt,
		&backup.UpdatedAt,
	)
	if err != nil {
		return SiteBackup{}, err
	}
	if siteID.Valid {
		backup.SiteID = &siteID.UUID
	}
	return backup, nil
}

func scanSiteBackupSettings(scanner interface {
	Scan(dest ...any) error
}) (SiteBackupSettings, error) {
	var settings SiteBackupSettings
	err := scanner.Scan(
		&settings.SiteID,
		&settings.Enabled,
		&settings.Frequency,
		&settings.RetentionDays,
		&settings.CreatedAt,
		&settings.UpdatedAt,
	)
	if err != nil {
		return SiteBackupSettings{}, err
	}
	return settings, nil
}

func (s *Store) GetSiteBackupSettings(ctx context.Context, siteID uuid.UUID) (SiteBackupSettings, error) {
	settings, err := scanSiteBackupSettings(s.pool.QueryRow(ctx, `
		SELECT site_id, enabled, frequency, retention_days, created_at, updated_at
		FROM site_backup_settings
		WHERE site_id = $1
	`, siteID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SiteBackupSettings{}, ErrNotFound
		}
		return SiteBackupSettings{}, fmt.Errorf("get site backup settings: %w", err)
	}
	return settings, nil
}

func (s *Store) GetSiteBackupHistoryWithSettingsForOwner(ctx context.Context, ownerUserID, siteID uuid.UUID) (SiteBackupSettings, []SiteBackup, error) {
	if _, err := s.GetSiteByIDForOwner(ctx, ownerUserID, siteID); err != nil {
		return SiteBackupSettings{}, nil, err
	}

	settings, err := s.GetSiteBackupSettings(ctx, siteID)
	if err != nil {
		return SiteBackupSettings{}, nil, err
	}

	rows, err := s.pool.Query(ctx, `
		SELECT
			id, owner_user_id, site_id, site_name, site_subdomain, trigger, status, object_key, size_bytes, sha256,
			expires_at, last_error, started_at, completed_at, created_at, updated_at
		FROM site_backups
		WHERE owner_user_id = $1 AND site_id = $2
		ORDER BY created_at DESC
	`, ownerUserID, siteID)
	if err != nil {
		return SiteBackupSettings{}, nil, fmt.Errorf("list site backups: %w", err)
	}
	defer rows.Close()

	backups := make([]SiteBackup, 0)
	for rows.Next() {
		item, err := scanSiteBackup(rows)
		if err != nil {
			return SiteBackupSettings{}, nil, fmt.Errorf("scan site backup: %w", err)
		}
		backups = append(backups, item)
	}
	if err := rows.Err(); err != nil {
		return SiteBackupSettings{}, nil, err
	}

	return settings, backups, nil
}

func (s *Store) UpdateSiteBackupSettings(ctx context.Context, params UpdateSiteBackupSettingsParams) (SiteBackupSettings, error) {
	if !validSiteBackupFrequency(params.Frequency) {
		return SiteBackupSettings{}, fmt.Errorf("%w: frekuensi backup tidak valid", ErrConflict)
	}
	if !validSiteBackupRetentionDays(params.RetentionDays) {
		return SiteBackupSettings{}, fmt.Errorf("%w: retensi backup tidak valid", ErrConflict)
	}
	if _, err := s.GetSiteByIDForOwner(ctx, params.OwnerUserID, params.SiteID); err != nil {
		return SiteBackupSettings{}, err
	}

	settings, err := scanSiteBackupSettings(s.pool.QueryRow(ctx, `
		UPDATE site_backup_settings
		SET enabled = $2, frequency = $3, retention_days = $4, updated_at = NOW()
		WHERE site_id = $1
		RETURNING site_id, enabled, frequency, retention_days, created_at, updated_at
	`, params.SiteID, params.Enabled, normalizeSiteBackupFrequency(params.Frequency), params.RetentionDays))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SiteBackupSettings{}, ErrNotFound
		}
		return SiteBackupSettings{}, fmt.Errorf("update site backup settings: %w", err)
	}
	return settings, nil
}

func (s *Store) CreatePendingSiteBackup(ctx context.Context, params CreateSiteBackupParams) (SiteBackup, error) {
	trigger := strings.ToLower(strings.TrimSpace(params.Trigger))
	switch trigger {
	case "manual", "scheduled":
	default:
		return SiteBackup{}, fmt.Errorf("%w: trigger backup tidak valid", ErrConflict)
	}
	if params.RetentionDays <= 0 {
		return SiteBackup{}, fmt.Errorf("%w: retensi backup tidak valid", ErrConflict)
	}

	now := time.Now().UTC()
	expiresAt := now.AddDate(0, 0, params.RetentionDays)
	backup := SiteBackup{
		ID:            uuid.New(),
		OwnerUserID:   params.Site.OwnerUserID,
		SiteID:        &params.Site.ID,
		SiteName:      strings.TrimSpace(params.Site.Name),
		SiteSubdomain: strings.TrimSpace(params.Site.Subdomain),
		Trigger:       trigger,
		Status:        "pending",
		ExpiresAt:     &expiresAt,
		LastError:     "",
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	item, err := scanSiteBackup(s.pool.QueryRow(ctx, `
		INSERT INTO site_backups (
			id, owner_user_id, site_id, site_name, site_subdomain, trigger, status, object_key,
			size_bytes, sha256, expires_at, last_error, started_at, completed_at, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, 'pending', '', 0, '', $7, '', NULL, NULL, $8, $8)
		RETURNING
			id, owner_user_id, site_id, site_name, site_subdomain, trigger, status, object_key, size_bytes, sha256,
			expires_at, last_error, started_at, completed_at, created_at, updated_at
	`, backup.ID, backup.OwnerUserID, backup.SiteID, backup.SiteName, backup.SiteSubdomain, backup.Trigger, backup.ExpiresAt, now))
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return SiteBackup{}, ErrConflict
		}
		return SiteBackup{}, fmt.Errorf("create pending site backup: %w", err)
	}
	return item, nil
}

func (s *Store) GetSiteBackupByID(ctx context.Context, backupID uuid.UUID) (SiteBackup, error) {
	backup, err := scanSiteBackup(s.pool.QueryRow(ctx, `
		SELECT
			id, owner_user_id, site_id, site_name, site_subdomain, trigger, status, object_key, size_bytes, sha256,
			expires_at, last_error, started_at, completed_at, created_at, updated_at
		FROM site_backups
		WHERE id = $1
	`, backupID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SiteBackup{}, ErrNotFound
		}
		return SiteBackup{}, fmt.Errorf("get site backup by id: %w", err)
	}
	return backup, nil
}

func (s *Store) GetSiteBackupForOwner(ctx context.Context, ownerUserID, siteID, backupID uuid.UUID) (SiteBackup, error) {
	if _, err := s.GetSiteByIDForOwner(ctx, ownerUserID, siteID); err != nil {
		return SiteBackup{}, err
	}

	backup, err := scanSiteBackup(s.pool.QueryRow(ctx, `
		SELECT
			id, owner_user_id, site_id, site_name, site_subdomain, trigger, status, object_key, size_bytes, sha256,
			expires_at, last_error, started_at, completed_at, created_at, updated_at
		FROM site_backups
		WHERE id = $1 AND owner_user_id = $2 AND site_id = $3
	`, backupID, ownerUserID, siteID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SiteBackup{}, ErrNotFound
		}
		return SiteBackup{}, fmt.Errorf("get site backup for owner: %w", err)
	}
	return backup, nil
}

func (s *Store) StartSiteBackup(ctx context.Context, backupID uuid.UUID) (SiteBackup, error) {
	now := time.Now().UTC()
	backup, err := scanSiteBackup(s.pool.QueryRow(ctx, `
		UPDATE site_backups
		SET status = 'running', started_at = COALESCE(started_at, $2), last_error = '', updated_at = $2
		WHERE id = $1 AND status = 'pending'
		RETURNING
			id, owner_user_id, site_id, site_name, site_subdomain, trigger, status, object_key, size_bytes, sha256,
			expires_at, last_error, started_at, completed_at, created_at, updated_at
	`, backupID, now))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SiteBackup{}, ErrConflict
		}
		return SiteBackup{}, fmt.Errorf("start site backup: %w", err)
	}
	return backup, nil
}

func (s *Store) CompleteSiteBackup(ctx context.Context, backupID uuid.UUID, objectKey string, sizeBytes int64, sha256Value string, completedAt time.Time) (SiteBackup, error) {
	backup, err := scanSiteBackup(s.pool.QueryRow(ctx, `
		UPDATE site_backups
		SET status = 'completed',
		    object_key = $2,
		    size_bytes = $3,
		    sha256 = $4,
		    last_error = '',
		    completed_at = $5,
		    updated_at = $5
		WHERE id = $1
		RETURNING
			id, owner_user_id, site_id, site_name, site_subdomain, trigger, status, object_key, size_bytes, sha256,
			expires_at, last_error, started_at, completed_at, created_at, updated_at
	`, backupID, strings.TrimSpace(objectKey), sizeBytes, strings.TrimSpace(sha256Value), completedAt))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SiteBackup{}, ErrNotFound
		}
		return SiteBackup{}, fmt.Errorf("complete site backup: %w", err)
	}
	return backup, nil
}

func (s *Store) FailSiteBackup(ctx context.Context, backupID uuid.UUID, failure string) (SiteBackup, error) {
	now := time.Now().UTC()
	backup, err := scanSiteBackup(s.pool.QueryRow(ctx, `
		UPDATE site_backups
		SET status = 'failed',
		    last_error = $2,
		    completed_at = COALESCE(completed_at, $3),
		    updated_at = $3
		WHERE id = $1
		RETURNING
			id, owner_user_id, site_id, site_name, site_subdomain, trigger, status, object_key, size_bytes, sha256,
			expires_at, last_error, started_at, completed_at, created_at, updated_at
	`, backupID, strings.TrimSpace(failure), now))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SiteBackup{}, ErrNotFound
		}
		return SiteBackup{}, fmt.Errorf("fail site backup: %w", err)
	}
	return backup, nil
}

func (s *Store) GetSiteBackupExecutionContext(ctx context.Context, backupID uuid.UUID) (SiteBackupExecutionContext, error) {
	backup, err := s.GetSiteBackupByID(ctx, backupID)
	if err != nil {
		return SiteBackupExecutionContext{}, err
	}
	return s.getSiteBackupExecutionContext(ctx, backup)
}

func (s *Store) getSiteBackupExecutionContext(ctx context.Context, backup SiteBackup) (SiteBackupExecutionContext, error) {
	if backup.SiteID == nil {
		return SiteBackupExecutionContext{Backup: backup}, ErrNotFound
	}

	var item SiteBackupExecutionContext
	var runtimeSiteID uuid.NullUUID
	var runtime SiteRuntimeMetadata
	err := s.pool.QueryRow(ctx, `
		SELECT
			s.id, s.owner_user_id, s.name, s.subdomain, s.plan_code, s.region, s.status, s.site_url, s.admin_url,
			s.admin_name, s.admin_email, s.moodle_username, s.provisioning_step, s.last_error,
			s.users_active_limit, s.storage_bytes_limit, s.web_cpu_millicores, s.web_memory_mib,
			s.cron_cpu_millicores, s.cron_memory_mib, s.activated_at, s.created_at, s.updated_at,
			pj.id, pj.site_id, pj.runtime_mode, pj.status, pj.current_step, pj.percent, pj.last_error, pj.created_at, pj.updated_at,
			sbs.site_id, sbs.enabled, sbs.frequency, sbs.retention_days, sbs.created_at, sbs.updated_at,
			srm.site_id, srm.image_repository, srm.image_tag, srm.web_container_name, srm.cron_container_name,
			srm.volume_name, srm.database_name, srm.database_user, srm.health_status, srm.last_health_error,
			srm.last_health_checked_at, srm.created_at, srm.updated_at
		FROM sites s
		JOIN provisioning_jobs pj ON pj.site_id = s.id
		JOIN site_backup_settings sbs ON sbs.site_id = s.id
		LEFT JOIN site_runtime_metadata srm ON srm.site_id = s.id
		WHERE s.id = $1
	`, *backup.SiteID).Scan(
		&item.Site.ID, &item.Site.OwnerUserID, &item.Site.Name, &item.Site.Subdomain, &item.Site.PlanCode, &item.Site.Region, &item.Site.Status, &item.Site.SiteURL, &item.Site.AdminURL,
		&item.Site.AdminName, &item.Site.AdminEmail, &item.Site.MoodleUsername, &item.Site.ProvisioningStep, &item.Site.LastError,
		&item.Site.UsersActiveLimit, &item.Site.StorageBytesLimit, &item.Site.WebCPUMillicores, &item.Site.WebMemoryMiB,
		&item.Site.CronCPUMillicores, &item.Site.CronMemoryMiB, &item.Site.ActivatedAt, &item.Site.CreatedAt, &item.Site.UpdatedAt,
		&item.Job.ID, &item.Job.SiteID, &item.Job.RuntimeMode, &item.Job.Status, &item.Job.CurrentStep, &item.Job.Percent, &item.Job.LastError, &item.Job.CreatedAt, &item.Job.UpdatedAt,
		&item.Settings.SiteID, &item.Settings.Enabled, &item.Settings.Frequency, &item.Settings.RetentionDays, &item.Settings.CreatedAt, &item.Settings.UpdatedAt,
		&runtimeSiteID, &runtime.ImageRepository, &runtime.ImageTag, &runtime.WebContainerName, &runtime.CronContainerName,
		&runtime.VolumeName, &runtime.DatabaseName, &runtime.DatabaseUser, &runtime.HealthStatus, &runtime.LastHealthError,
		&runtime.LastHealthCheckedAt, &runtime.CreatedAt, &runtime.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SiteBackupExecutionContext{Backup: backup}, ErrNotFound
		}
		return SiteBackupExecutionContext{}, fmt.Errorf("get site backup execution context: %w", err)
	}

	item.Backup = backup
	if runtimeSiteID.Valid {
		runtime.SiteID = runtimeSiteID.UUID
		item.Runtime = &runtime
	}
	return item, nil
}

func (s *Store) ListDueSiteBackups(ctx context.Context, now time.Time) ([]SiteBackupScheduleCandidate, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT
			s.id, s.owner_user_id, s.name, s.subdomain, s.plan_code, s.region, s.status, s.site_url, s.admin_url,
			s.admin_name, s.admin_email, s.moodle_username, s.provisioning_step, s.last_error,
			s.users_active_limit, s.storage_bytes_limit, s.web_cpu_millicores, s.web_memory_mib,
			s.cron_cpu_millicores, s.cron_memory_mib, s.activated_at, s.created_at, s.updated_at,
			pj.id, pj.site_id, pj.runtime_mode, pj.status, pj.current_step, pj.percent, pj.last_error, pj.created_at, pj.updated_at,
			sbs.site_id, sbs.enabled, sbs.frequency, sbs.retention_days, sbs.created_at, sbs.updated_at,
			srm.site_id, srm.image_repository, srm.image_tag, srm.web_container_name, srm.cron_container_name,
			srm.volume_name, srm.database_name, srm.database_user, srm.health_status, srm.last_health_error,
			srm.last_health_checked_at, srm.created_at, srm.updated_at,
			(
				SELECT MAX(completed_at)
				FROM site_backups sb
				WHERE sb.site_id = s.id AND sb.status = 'completed'
			) AS last_successful_backup_at
		FROM sites s
		JOIN provisioning_jobs pj ON pj.site_id = s.id
		JOIN site_backup_settings sbs ON sbs.site_id = s.id
		LEFT JOIN site_runtime_metadata srm ON srm.site_id = s.id
		WHERE s.status = 'active'
		  AND pj.runtime_mode = 'docker_local'
		  AND sbs.enabled = TRUE
		ORDER BY s.created_at ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("list due site backups: %w", err)
	}
	defer rows.Close()

	items := make([]SiteBackupScheduleCandidate, 0)
	for rows.Next() {
		var item SiteBackupScheduleCandidate
		var runtimeSiteID uuid.NullUUID
		var runtime SiteRuntimeMetadata
		if err := rows.Scan(
			&item.Site.ID, &item.Site.OwnerUserID, &item.Site.Name, &item.Site.Subdomain, &item.Site.PlanCode, &item.Site.Region, &item.Site.Status, &item.Site.SiteURL, &item.Site.AdminURL,
			&item.Site.AdminName, &item.Site.AdminEmail, &item.Site.MoodleUsername, &item.Site.ProvisioningStep, &item.Site.LastError,
			&item.Site.UsersActiveLimit, &item.Site.StorageBytesLimit, &item.Site.WebCPUMillicores, &item.Site.WebMemoryMiB,
			&item.Site.CronCPUMillicores, &item.Site.CronMemoryMiB, &item.Site.ActivatedAt, &item.Site.CreatedAt, &item.Site.UpdatedAt,
			&item.Job.ID, &item.Job.SiteID, &item.Job.RuntimeMode, &item.Job.Status, &item.Job.CurrentStep, &item.Job.Percent, &item.Job.LastError, &item.Job.CreatedAt, &item.Job.UpdatedAt,
			&item.Settings.SiteID, &item.Settings.Enabled, &item.Settings.Frequency, &item.Settings.RetentionDays, &item.Settings.CreatedAt, &item.Settings.UpdatedAt,
			&runtimeSiteID, &runtime.ImageRepository, &runtime.ImageTag, &runtime.WebContainerName, &runtime.CronContainerName,
			&runtime.VolumeName, &runtime.DatabaseName, &runtime.DatabaseUser, &runtime.HealthStatus, &runtime.LastHealthError,
			&runtime.LastHealthCheckedAt, &runtime.CreatedAt, &runtime.UpdatedAt,
			&item.LastSuccessfulBackupAt,
		); err != nil {
			return nil, fmt.Errorf("scan due site backup candidate: %w", err)
		}
		if runtimeSiteID.Valid {
			runtime.SiteID = runtimeSiteID.UUID
			item.Runtime = &runtime
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return items, nil
}

func (s *Store) ListExpiredSiteBackups(ctx context.Context, now time.Time) ([]SiteBackup, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT
			id, owner_user_id, site_id, site_name, site_subdomain, trigger, status, object_key, size_bytes, sha256,
			expires_at, last_error, started_at, completed_at, created_at, updated_at
		FROM site_backups
		WHERE expires_at <= $1
		ORDER BY expires_at ASC, created_at ASC
	`, now)
	if err != nil {
		return nil, fmt.Errorf("list expired site backups: %w", err)
	}
	defer rows.Close()

	backups := make([]SiteBackup, 0)
	for rows.Next() {
		item, err := scanSiteBackup(rows)
		if err != nil {
			return nil, fmt.Errorf("scan expired site backup: %w", err)
		}
		backups = append(backups, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return backups, nil
}

func (s *Store) DeleteSiteBackupRecord(ctx context.Context, backupID uuid.UUID) error {
	if _, err := s.pool.Exec(ctx, `DELETE FROM site_backups WHERE id = $1`, backupID); err != nil {
		return fmt.Errorf("delete site backup record: %w", err)
	}
	return nil
}
