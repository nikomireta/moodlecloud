-- +goose Up
ALTER TABLE site_plan_changes
  DROP CONSTRAINT IF EXISTS site_plan_changes_site_id_fkey;

ALTER TABLE site_plan_changes
  ALTER COLUMN site_id DROP NOT NULL,
  ADD COLUMN site_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN site_subdomain TEXT NOT NULL DEFAULT '';

UPDATE site_plan_changes spc
SET
  site_name = COALESCE(NULLIF(s.name, ''), site_name),
  site_subdomain = COALESCE(NULLIF(s.subdomain, ''), site_subdomain)
FROM sites s
WHERE spc.site_id = s.id;

ALTER TABLE site_plan_changes
  ADD CONSTRAINT site_plan_changes_site_id_fkey
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL;

ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_site_id_fkey;

ALTER TABLE subscriptions
  ALTER COLUMN site_id DROP NOT NULL,
  ADD COLUMN site_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN site_subdomain TEXT NOT NULL DEFAULT '',
  ADD COLUMN collection_method TEXT NOT NULL DEFAULT 'auto_charge';

UPDATE subscriptions sub
SET
  site_name = COALESCE(NULLIF(s.name, ''), site_name),
  site_subdomain = COALESCE(NULLIF(s.subdomain, ''), site_subdomain),
  collection_method = CASE
    WHEN sub.payment_method_id IS NULL THEN 'manual_invoice'
    ELSE 'auto_charge'
  END
FROM sites s
WHERE sub.site_id = s.id;

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_site_id_fkey
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL;

ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_site_id_fkey;

ALTER TABLE invoices
  ALTER COLUMN site_id DROP NOT NULL,
  ADD COLUMN site_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN site_subdomain TEXT NOT NULL DEFAULT '';

UPDATE invoices i
SET
  site_name = COALESCE(NULLIF(s.name, ''), site_name),
  site_subdomain = COALESCE(NULLIF(s.subdomain, ''), site_subdomain)
FROM sites s
WHERE i.site_id = s.id;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_site_id_fkey
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL;

CREATE TABLE site_checkout_orders (
  id UUID PRIMARY KEY,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL UNIQUE REFERENCES invoices(id) ON DELETE CASCADE,
  created_site_id UUID UNIQUE REFERENCES sites(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  site_name TEXT NOT NULL DEFAULT '',
  subdomain TEXT NOT NULL,
  plan_code TEXT NOT NULL REFERENCES plans(code),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  region TEXT NOT NULL DEFAULT '',
  admin_name TEXT NOT NULL DEFAULT '',
  admin_email TEXT NOT NULL DEFAULT '',
  payment_method_type TEXT NOT NULL DEFAULT '',
  amount_total BIGINT NOT NULL DEFAULT 0,
  users_active_limit INTEGER NOT NULL DEFAULT 0,
  storage_bytes_limit BIGINT NOT NULL DEFAULT 0,
  web_cpu_millicores INTEGER NOT NULL DEFAULT 0,
  web_memory_mib INTEGER NOT NULL DEFAULT 0,
  cron_cpu_millicores INTEGER NOT NULL DEFAULT 0,
  cron_memory_mib INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  provisioning_started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  last_error TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX site_checkout_orders_owner_user_id_idx ON site_checkout_orders (owner_user_id, created_at DESC);
CREATE INDEX site_checkout_orders_status_expires_at_idx ON site_checkout_orders (status, expires_at);
CREATE INDEX site_checkout_orders_created_site_id_idx ON site_checkout_orders (created_site_id);
CREATE UNIQUE INDEX site_checkout_orders_active_subdomain_idx
  ON site_checkout_orders (subdomain)
  WHERE status IN ('pending_payment', 'paid');

-- +goose Down
DROP INDEX IF EXISTS site_checkout_orders_active_subdomain_idx;
DROP INDEX IF EXISTS site_checkout_orders_created_site_id_idx;
DROP INDEX IF EXISTS site_checkout_orders_status_expires_at_idx;
DROP INDEX IF EXISTS site_checkout_orders_owner_user_id_idx;
DROP TABLE IF EXISTS site_checkout_orders;

ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_site_id_fkey;

DELETE FROM payment_attempts
WHERE invoice_id IN (SELECT id FROM invoices WHERE site_id IS NULL);

DELETE FROM invoice_items
WHERE invoice_id IN (SELECT id FROM invoices WHERE site_id IS NULL);

DELETE FROM invoices
WHERE site_id IS NULL;

ALTER TABLE invoices
  DROP COLUMN IF EXISTS site_subdomain,
  DROP COLUMN IF EXISTS site_name;

ALTER TABLE invoices
  ALTER COLUMN site_id SET NOT NULL,
  ADD CONSTRAINT invoices_site_id_fkey
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;

ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_site_id_fkey;

DELETE FROM subscriptions
WHERE site_id IS NULL;

ALTER TABLE subscriptions
  DROP COLUMN IF EXISTS collection_method,
  DROP COLUMN IF EXISTS site_subdomain,
  DROP COLUMN IF EXISTS site_name;

ALTER TABLE subscriptions
  ALTER COLUMN site_id SET NOT NULL,
  ADD CONSTRAINT subscriptions_site_id_fkey
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;

ALTER TABLE site_plan_changes
  DROP CONSTRAINT IF EXISTS site_plan_changes_site_id_fkey;

DELETE FROM site_plan_changes
WHERE site_id IS NULL;

ALTER TABLE site_plan_changes
  DROP COLUMN IF EXISTS site_subdomain,
  DROP COLUMN IF EXISTS site_name;

ALTER TABLE site_plan_changes
  ALTER COLUMN site_id SET NOT NULL,
  ADD CONSTRAINT site_plan_changes_site_id_fkey
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;
