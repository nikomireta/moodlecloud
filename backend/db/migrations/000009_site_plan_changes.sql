-- +goose Up
CREATE TABLE site_plan_changes (
  id UUID PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_plan_code TEXT NOT NULL REFERENCES plans(code),
  to_plan_code TEXT NOT NULL REFERENCES plans(code),
  status TEXT NOT NULL DEFAULT 'applied',
  applied_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX site_plan_changes_site_id_idx ON site_plan_changes (site_id, created_at DESC);
CREATE INDEX site_plan_changes_owner_user_id_idx ON site_plan_changes (owner_user_id, created_at DESC);

-- +goose Down
DROP TABLE IF EXISTS site_plan_changes;
