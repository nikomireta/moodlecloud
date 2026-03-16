-- +goose Up
CREATE TABLE site_runtime_metadata (
  site_id UUID PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
  image_repository TEXT NOT NULL,
  image_tag TEXT NOT NULL,
  web_container_name TEXT NOT NULL,
  cron_container_name TEXT NOT NULL,
  volume_name TEXT NOT NULL,
  database_name TEXT NOT NULL,
  database_user TEXT NOT NULL,
  health_status TEXT NOT NULL DEFAULT 'unknown',
  last_health_error TEXT NOT NULL DEFAULT '',
  last_health_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

-- +goose Down
DROP TABLE IF EXISTS site_runtime_metadata;
