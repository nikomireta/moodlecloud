-- +goose Up
CREATE TABLE site_admin_access_tokens (
  id UUID PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_username TEXT NOT NULL,
  target_email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX site_admin_access_tokens_site_id_idx ON site_admin_access_tokens (site_id, created_at DESC);
CREATE INDEX site_admin_access_tokens_owner_user_id_idx ON site_admin_access_tokens (owner_user_id, created_at DESC);
CREATE INDEX site_admin_access_tokens_expires_at_idx ON site_admin_access_tokens (expires_at);

-- +goose Down
DROP TABLE IF EXISTS site_admin_access_tokens;
