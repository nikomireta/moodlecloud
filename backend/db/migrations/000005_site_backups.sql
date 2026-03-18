-- +goose Up
CREATE TABLE site_backup_settings (
  site_id UUID PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  frequency TEXT NOT NULL DEFAULT 'daily',
  retention_days INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT site_backup_settings_frequency_check CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  CONSTRAINT site_backup_settings_retention_days_check CHECK (retention_days > 0)
);

INSERT INTO site_backup_settings (site_id, enabled, frequency, retention_days, created_at, updated_at)
SELECT id, TRUE, 'daily', 30, NOW(), NOW()
FROM sites
ON CONFLICT (site_id) DO NOTHING;

CREATE TABLE site_backups (
  id UUID PRIMARY KEY,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
  site_name TEXT NOT NULL,
  site_subdomain TEXT NOT NULL,
  trigger TEXT NOT NULL,
  status TEXT NOT NULL,
  object_key TEXT NOT NULL DEFAULT '',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  sha256 TEXT NOT NULL DEFAULT '',
  expires_at TIMESTAMPTZ NOT NULL,
  last_error TEXT NOT NULL DEFAULT '',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT site_backups_trigger_check CHECK (trigger IN ('manual', 'scheduled')),
  CONSTRAINT site_backups_status_check CHECK (status IN ('pending', 'running', 'completed', 'failed'))
);

CREATE INDEX site_backups_owner_user_id_created_at_idx ON site_backups (owner_user_id, created_at DESC);
CREATE INDEX site_backups_site_id_created_at_idx ON site_backups (site_id, created_at DESC);
CREATE INDEX site_backups_expires_at_idx ON site_backups (expires_at);
CREATE UNIQUE INDEX site_backups_active_run_idx
  ON site_backups (site_id)
  WHERE site_id IS NOT NULL AND status IN ('pending', 'running');

-- +goose Down
DROP INDEX IF EXISTS site_backups_active_run_idx;
DROP INDEX IF EXISTS site_backups_expires_at_idx;
DROP INDEX IF EXISTS site_backups_site_id_created_at_idx;
DROP INDEX IF EXISTS site_backups_owner_user_id_created_at_idx;
DROP TABLE IF EXISTS site_backups;
DROP TABLE IF EXISTS site_backup_settings;
