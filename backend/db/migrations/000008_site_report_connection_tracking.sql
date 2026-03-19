-- +goose Up
ALTER TABLE site_report_connections
  ADD COLUMN tracking_mode TEXT NOT NULL DEFAULT '',
  ADD COLUMN tracking_last_seen_at TIMESTAMPTZ NULL;

CREATE INDEX site_report_connections_tracking_last_seen_at_idx
  ON site_report_connections (tracking_last_seen_at DESC);

-- +goose Down
DROP INDEX IF EXISTS site_report_connections_tracking_last_seen_at_idx;

ALTER TABLE site_report_connections
  DROP COLUMN IF EXISTS tracking_last_seen_at,
  DROP COLUMN IF EXISTS tracking_mode;
