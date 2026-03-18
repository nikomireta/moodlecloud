-- +goose Up
CREATE TABLE site_report_connections (
  site_id UUID PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
  ingest_token_hash TEXT NOT NULL UNIQUE,
  site_url_snapshot TEXT NOT NULL DEFAULT '',
  plugin_version TEXT NOT NULL DEFAULT '',
  moodle_version TEXT NOT NULL DEFAULT '',
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_error TEXT NOT NULL DEFAULT '',
  registered_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX site_report_connections_last_seen_at_idx ON site_report_connections (last_seen_at DESC);

-- +goose Down
DROP TABLE IF EXISTS site_report_connections;
