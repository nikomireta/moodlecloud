package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func (s *Store) GetSiteByID(ctx context.Context, siteID uuid.UUID) (Site, error) {
	var site Site
	err := s.pool.QueryRow(ctx, `
		SELECT
			s.id, s.owner_user_id, s.name, s.subdomain, s.plan_code, s.region, s.status, s.site_url, s.admin_url,
			s.admin_name, s.admin_email, s.moodle_username, s.provisioning_step, s.last_error,
			s.users_active_limit, s.storage_bytes_limit, s.web_cpu_millicores, s.web_memory_mib,
			s.cron_cpu_millicores, s.cron_memory_mib, s.activated_at, s.created_at, s.updated_at,
			COALESCE(m.health_status, '') as runtime_health
		FROM sites s
		LEFT JOIN site_runtime_metadata m ON m.site_id = s.id
		WHERE s.id = $1
	`, siteID).Scan(
		&site.ID, &site.OwnerUserID, &site.Name, &site.Subdomain, &site.PlanCode, &site.Region, &site.Status, &site.SiteURL, &site.AdminURL,
		&site.AdminName, &site.AdminEmail, &site.MoodleUsername, &site.ProvisioningStep, &site.LastError,
		&site.UsersActiveLimit, &site.StorageBytesLimit, &site.WebCPUMillicores, &site.WebMemoryMiB,
		&site.CronCPUMillicores, &site.CronMemoryMiB, &site.ActivatedAt, &site.CreatedAt, &site.UpdatedAt,
		&site.RuntimeHealth,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Site{}, ErrNotFound
		}
		return Site{}, fmt.Errorf("get site by id: %w", err)
	}
	return site, nil
}

func (s *Store) UpsertSiteReportConnection(ctx context.Context, params UpsertSiteReportConnectionParams) (SiteReportConnection, error) {
	now := time.Now().UTC()
	capabilitiesJSON, err := json.Marshal(params.Capabilities)
	if err != nil {
		return SiteReportConnection{}, fmt.Errorf("marshal site report connection capabilities: %w", err)
	}

	connection := SiteReportConnection{
		SiteID:          params.SiteID,
		IngestTokenHash: strings.TrimSpace(params.IngestTokenHash),
		SiteURLSnapshot: strings.TrimSpace(params.SiteURLSnapshot),
		PluginVersion:   strings.TrimSpace(params.PluginVersion),
		MoodleVersion:   strings.TrimSpace(params.MoodleVersion),
		Capabilities:    append([]string(nil), params.Capabilities...),
		LastError:       strings.TrimSpace(params.LastError),
	}

	var rawCapabilities []byte
	err = s.pool.QueryRow(ctx, `
		INSERT INTO site_report_connections (
			site_id, ingest_token_hash, site_url_snapshot, plugin_version, moodle_version,
			capabilities, last_error, registered_at, last_seen_at, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $8, $8, $8)
		ON CONFLICT (site_id) DO UPDATE SET
			ingest_token_hash = EXCLUDED.ingest_token_hash,
			site_url_snapshot = EXCLUDED.site_url_snapshot,
			plugin_version = EXCLUDED.plugin_version,
			moodle_version = EXCLUDED.moodle_version,
			capabilities = EXCLUDED.capabilities,
			last_error = EXCLUDED.last_error,
			last_seen_at = EXCLUDED.last_seen_at,
			updated_at = EXCLUDED.updated_at
		RETURNING
			site_id, ingest_token_hash, site_url_snapshot, plugin_version, moodle_version,
			capabilities, last_error, registered_at, last_seen_at, created_at, updated_at
	`, connection.SiteID, connection.IngestTokenHash, connection.SiteURLSnapshot, connection.PluginVersion, connection.MoodleVersion, string(capabilitiesJSON), connection.LastError, now).Scan(
		&connection.SiteID, &connection.IngestTokenHash, &connection.SiteURLSnapshot, &connection.PluginVersion, &connection.MoodleVersion,
		&rawCapabilities, &connection.LastError, &connection.RegisteredAt, &connection.LastSeenAt, &connection.CreatedAt, &connection.UpdatedAt,
	)
	if err != nil {
		return SiteReportConnection{}, fmt.Errorf("upsert site report connection: %w", err)
	}
	if err := json.Unmarshal(rawCapabilities, &connection.Capabilities); err != nil {
		return SiteReportConnection{}, fmt.Errorf("decode site report connection capabilities: %w", err)
	}
	return connection, nil
}
