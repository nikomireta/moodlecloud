-- +goose Up
CREATE TABLE billing_customers (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_customer_id TEXT NOT NULL DEFAULT '',
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  organization TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX billing_customers_provider_idx ON billing_customers (provider, provider_customer_id);

CREATE TABLE billing_payment_methods (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES billing_customers(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_token TEXT NOT NULL,
  type TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT '',
  last4 TEXT NOT NULL DEFAULT '',
  expiry_month TEXT NOT NULL DEFAULT '',
  expiry_year TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  reusable BOOLEAN NOT NULL DEFAULT FALSE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX billing_payment_methods_provider_token_idx ON billing_payment_methods (provider, provider_token);
CREATE INDEX billing_payment_methods_customer_id_idx ON billing_payment_methods (customer_id, created_at DESC);
CREATE INDEX billing_payment_methods_owner_user_id_idx ON billing_payment_methods (owner_user_id, created_at DESC);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES billing_customers(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  payment_method_id UUID REFERENCES billing_payment_methods(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  provider_subscription_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  billing_cycle TEXT NOT NULL,
  current_plan_code TEXT NOT NULL REFERENCES plans(code),
  pending_plan_code TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'IDR',
  amount_total BIGINT NOT NULL DEFAULT 0,
  anchor_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  next_charge_at TIMESTAMPTZ,
  last_charge_failed_at TIMESTAMPTZ,
  last_error TEXT NOT NULL DEFAULT '',
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX subscriptions_owner_user_id_idx ON subscriptions (owner_user_id, updated_at DESC);
CREATE INDEX subscriptions_site_id_idx ON subscriptions (site_id, updated_at DESC);
CREATE INDEX subscriptions_next_charge_at_idx ON subscriptions (status, next_charge_at);

CREATE TABLE invoices (
  id UUID PRIMARY KEY,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES billing_customers(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  subscription_id UUID,
  number TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'IDR',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  from_plan_code TEXT NOT NULL DEFAULT '',
  to_plan_code TEXT NOT NULL DEFAULT '',
  payment_method_type TEXT NOT NULL DEFAULT '',
  amount_subtotal BIGINT NOT NULL DEFAULT 0,
  amount_tax BIGINT NOT NULL DEFAULT 0,
  amount_total BIGINT NOT NULL DEFAULT 0,
  checkout_url TEXT NOT NULL DEFAULT '',
  redirect_url TEXT NOT NULL DEFAULT '',
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX invoices_owner_user_id_idx ON invoices (owner_user_id, created_at DESC);
CREATE INDEX invoices_site_id_idx ON invoices (site_id, created_at DESC);
CREATE INDEX invoices_status_idx ON invoices (status, created_at DESC);

CREATE TABLE invoice_items (
  id UUID PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL DEFAULT 'plan',
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_amount BIGINT NOT NULL DEFAULT 0,
  total_amount BIGINT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX invoice_items_invoice_id_idx ON invoice_items (invoice_id, created_at ASC);

CREATE TABLE payment_attempts (
  id UUID PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  subscription_id UUID,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL UNIQUE,
  payment_method_type TEXT NOT NULL,
  status TEXT NOT NULL,
  amount BIGINT NOT NULL DEFAULT 0,
  redirect_url TEXT NOT NULL DEFAULT '',
  failure_reason TEXT NOT NULL DEFAULT '',
  raw_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX payment_attempts_invoice_id_idx ON payment_attempts (invoice_id, created_at DESC);
CREATE INDEX payment_attempts_status_idx ON payment_attempts (status, created_at DESC);

CREATE TABLE provider_webhook_events (
  id UUID PRIMARY KEY,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  signature TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ,
  processing_error TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX provider_webhook_events_provider_external_type_idx
  ON provider_webhook_events (provider, external_id, event_type);
CREATE INDEX provider_webhook_events_processed_idx ON provider_webhook_events (provider, processed_at, created_at DESC);

-- +goose Down
DROP TABLE IF EXISTS provider_webhook_events;
DROP TABLE IF EXISTS payment_attempts;
DROP TABLE IF EXISTS invoice_items;
DROP TABLE IF EXISTS invoices;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS billing_payment_methods;
DROP TABLE IF EXISTS billing_customers;
