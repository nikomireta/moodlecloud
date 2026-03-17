-- +goose Up
CREATE TABLE site_custom_domains (
  site_id UUID PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
  domain TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  verification_token TEXT NOT NULL,
  last_error TEXT NOT NULL DEFAULT '',
  verified_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX site_custom_domains_status_idx ON site_custom_domains (status);

-- +goose Down
DROP TABLE IF EXISTS site_custom_domains;
