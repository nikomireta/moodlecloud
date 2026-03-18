-- +goose Up
CREATE TABLE site_report_snapshots (
    id UUID PRIMARY KEY,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    snapshot_key TEXT NOT NULL,
    period_key TEXT NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    plugin_version TEXT NOT NULL DEFAULT '',
    moodle_version TEXT NOT NULL DEFAULT '',
    generated_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (site_id, snapshot_key, period_start, period_end)
);

CREATE INDEX idx_site_report_snapshots_latest
    ON site_report_snapshots (site_id, snapshot_key, period_key, received_at DESC);

-- +goose Down
DROP TABLE IF EXISTS site_report_snapshots;
