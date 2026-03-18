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

func (s *Store) GetSiteReportConnectionByIngestTokenHash(ctx context.Context, ingestTokenHash string) (SiteReportConnection, error) {
	var connection SiteReportConnection
	var rawCapabilities []byte

	err := s.pool.QueryRow(ctx, `
		SELECT
			site_id, ingest_token_hash, site_url_snapshot, plugin_version, moodle_version,
			capabilities, last_error, registered_at, last_seen_at, created_at, updated_at
		FROM site_report_connections
		WHERE ingest_token_hash = $1
	`, strings.TrimSpace(ingestTokenHash)).Scan(
		&connection.SiteID, &connection.IngestTokenHash, &connection.SiteURLSnapshot, &connection.PluginVersion, &connection.MoodleVersion,
		&rawCapabilities, &connection.LastError, &connection.RegisteredAt, &connection.LastSeenAt, &connection.CreatedAt, &connection.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SiteReportConnection{}, ErrNotFound
		}
		return SiteReportConnection{}, fmt.Errorf("get site report connection by ingest token hash: %w", err)
	}

	if err := json.Unmarshal(rawCapabilities, &connection.Capabilities); err != nil {
		return SiteReportConnection{}, fmt.Errorf("decode site report connection capabilities: %w", err)
	}

	return connection, nil
}

func (s *Store) UpdateSiteReportConnectionHeartbeat(ctx context.Context, params UpdateSiteReportConnectionHeartbeatParams) (SiteReportConnection, error) {
	connection := SiteReportConnection{
		SiteID:        params.SiteID,
		PluginVersion: strings.TrimSpace(params.PluginVersion),
		MoodleVersion: strings.TrimSpace(params.MoodleVersion),
		LastError:     strings.TrimSpace(params.LastError),
		LastSeenAt:    params.LastSeenAt.UTC(),
	}
	if connection.LastSeenAt.IsZero() {
		connection.LastSeenAt = time.Now().UTC()
	}

	var rawCapabilities []byte
	err := s.pool.QueryRow(ctx, `
		UPDATE site_report_connections
		SET
			plugin_version = CASE WHEN $2 <> '' THEN $2 ELSE plugin_version END,
			moodle_version = CASE WHEN $3 <> '' THEN $3 ELSE moodle_version END,
			last_error = $4,
			last_seen_at = $5,
			updated_at = $5
		WHERE site_id = $1
		RETURNING
			site_id, ingest_token_hash, site_url_snapshot, plugin_version, moodle_version,
			capabilities, last_error, registered_at, last_seen_at, created_at, updated_at
	`, connection.SiteID, connection.PluginVersion, connection.MoodleVersion, connection.LastError, connection.LastSeenAt).Scan(
		&connection.SiteID, &connection.IngestTokenHash, &connection.SiteURLSnapshot, &connection.PluginVersion, &connection.MoodleVersion,
		&rawCapabilities, &connection.LastError, &connection.RegisteredAt, &connection.LastSeenAt, &connection.CreatedAt, &connection.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SiteReportConnection{}, ErrNotFound
		}
		return SiteReportConnection{}, fmt.Errorf("update site report connection heartbeat: %w", err)
	}
	if err := json.Unmarshal(rawCapabilities, &connection.Capabilities); err != nil {
		return SiteReportConnection{}, fmt.Errorf("decode site report connection capabilities: %w", err)
	}

	return connection, nil
}

func (s *Store) UpsertSiteReportSnapshot(ctx context.Context, params UpsertSiteReportSnapshotParams) (SiteReportSnapshot, error) {
	snapshot := SiteReportSnapshot{
		ID:            uuid.New(),
		SiteID:        params.SiteID,
		SnapshotKey:   strings.TrimSpace(params.SnapshotKey),
		PeriodKey:     strings.TrimSpace(params.PeriodKey),
		PeriodStart:   params.PeriodStart.UTC(),
		PeriodEnd:     params.PeriodEnd.UTC(),
		Payload:       append(json.RawMessage(nil), params.Payload...),
		PluginVersion: strings.TrimSpace(params.PluginVersion),
		MoodleVersion: strings.TrimSpace(params.MoodleVersion),
		GeneratedAt:   params.GeneratedAt.UTC(),
		ReceivedAt:    params.ReceivedAt.UTC(),
	}
	if snapshot.SnapshotKey == "" {
		snapshot.SnapshotKey = "reports_summary_v1"
	}
	if snapshot.PeriodKey == "" {
		snapshot.PeriodKey = "last_7_days"
	}
	if len(snapshot.Payload) == 0 {
		snapshot.Payload = json.RawMessage(`{}`)
	}
	if snapshot.GeneratedAt.IsZero() {
		snapshot.GeneratedAt = time.Now().UTC()
	}
	if snapshot.ReceivedAt.IsZero() {
		snapshot.ReceivedAt = time.Now().UTC()
	}

	err := s.pool.QueryRow(ctx, `
		INSERT INTO site_report_snapshots (
			id, site_id, snapshot_key, period_key, period_start, period_end, payload,
			plugin_version, moodle_version, generated_at, received_at, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $11, $11)
		ON CONFLICT (site_id, snapshot_key, period_start, period_end) DO UPDATE SET
			period_key = EXCLUDED.period_key,
			payload = EXCLUDED.payload,
			plugin_version = EXCLUDED.plugin_version,
			moodle_version = EXCLUDED.moodle_version,
			generated_at = EXCLUDED.generated_at,
			received_at = EXCLUDED.received_at,
			updated_at = EXCLUDED.updated_at
		RETURNING
			id, site_id, snapshot_key, period_key, period_start, period_end, payload,
			plugin_version, moodle_version, generated_at, received_at, created_at, updated_at
	`, snapshot.ID, snapshot.SiteID, snapshot.SnapshotKey, snapshot.PeriodKey, snapshot.PeriodStart, snapshot.PeriodEnd, string(snapshot.Payload), snapshot.PluginVersion, snapshot.MoodleVersion, snapshot.GeneratedAt, snapshot.ReceivedAt).Scan(
		&snapshot.ID, &snapshot.SiteID, &snapshot.SnapshotKey, &snapshot.PeriodKey, &snapshot.PeriodStart, &snapshot.PeriodEnd, &snapshot.Payload,
		&snapshot.PluginVersion, &snapshot.MoodleVersion, &snapshot.GeneratedAt, &snapshot.ReceivedAt, &snapshot.CreatedAt, &snapshot.UpdatedAt,
	)
	if err != nil {
		return SiteReportSnapshot{}, fmt.Errorf("upsert site report snapshot: %w", err)
	}

	return snapshot, nil
}

func (s *Store) GetLatestSiteReportSnapshotBySiteIDForOwner(ctx context.Context, ownerUserID, siteID uuid.UUID, snapshotKey, periodKey string) (SiteReportSnapshot, error) {
	snapshotKey = strings.TrimSpace(snapshotKey)
	if snapshotKey == "" {
		snapshotKey = "reports_summary_v1"
	}
	periodKey = strings.TrimSpace(periodKey)
	if periodKey == "" {
		periodKey = "last_7_days"
	}

	var snapshot SiteReportSnapshot
	err := s.pool.QueryRow(ctx, `
		SELECT
			sr.id, sr.site_id, sr.snapshot_key, sr.period_key, sr.period_start, sr.period_end, sr.payload,
			sr.plugin_version, sr.moodle_version, sr.generated_at, sr.received_at, sr.created_at, sr.updated_at
		FROM site_report_snapshots sr
		INNER JOIN sites s ON s.id = sr.site_id
		WHERE s.owner_user_id = $1
		  AND sr.site_id = $2
		  AND sr.snapshot_key = $3
		  AND sr.period_key = $4
		ORDER BY sr.received_at DESC, sr.updated_at DESC
		LIMIT 1
	`, ownerUserID, siteID, snapshotKey, periodKey).Scan(
		&snapshot.ID, &snapshot.SiteID, &snapshot.SnapshotKey, &snapshot.PeriodKey, &snapshot.PeriodStart, &snapshot.PeriodEnd, &snapshot.Payload,
		&snapshot.PluginVersion, &snapshot.MoodleVersion, &snapshot.GeneratedAt, &snapshot.ReceivedAt, &snapshot.CreatedAt, &snapshot.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SiteReportSnapshot{}, ErrNotFound
		}
		return SiteReportSnapshot{}, fmt.Errorf("get latest site report snapshot: %w", err)
	}

	return snapshot, nil
}
