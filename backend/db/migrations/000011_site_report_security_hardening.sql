-- +goose Up
ALTER TABLE sites
  ADD COLUMN report_bootstrap_token TEXT NOT NULL DEFAULT '';

ALTER TABLE site_runtime_metadata
  ADD COLUMN report_bootstrap_token TEXT NOT NULL DEFAULT '';

CREATE TABLE site_report_connect_tokens (
  id UUID PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX site_report_connect_tokens_site_id_idx
  ON site_report_connect_tokens (site_id, created_at DESC);

CREATE INDEX site_report_connect_tokens_owner_user_id_idx
  ON site_report_connect_tokens (owner_user_id, created_at DESC);

CREATE INDEX site_report_connect_tokens_expires_at_idx
  ON site_report_connect_tokens (expires_at);

-- +goose Down
DROP INDEX IF EXISTS site_report_connect_tokens_expires_at_idx;
DROP INDEX IF EXISTS site_report_connect_tokens_owner_user_id_idx;
DROP INDEX IF EXISTS site_report_connect_tokens_site_id_idx;

DROP TABLE IF EXISTS site_report_connect_tokens;

ALTER TABLE site_runtime_metadata
  DROP COLUMN IF EXISTS report_bootstrap_token;

ALTER TABLE sites
  DROP COLUMN IF EXISTS report_bootstrap_token;
