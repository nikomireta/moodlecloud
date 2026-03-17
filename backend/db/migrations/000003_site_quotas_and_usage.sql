-- +goose Up
ALTER TABLE plans
  ADD COLUMN users_active_limit INTEGER,
  ADD COLUMN storage_bytes_limit BIGINT,
  ADD COLUMN web_cpu_millicores INTEGER,
  ADD COLUMN web_memory_mib INTEGER,
  ADD COLUMN cron_cpu_millicores INTEGER,
  ADD COLUMN cron_memory_mib INTEGER;

UPDATE plans
SET
  users_active_limit = CASE code
    WHEN 'starter' THEN 100
    WHEN 'professional' THEN 1000
    WHEN 'enterprise' THEN 5000
    ELSE users_active_limit
  END,
  storage_bytes_limit = CASE code
    WHEN 'starter' THEN 2147483648
    WHEN 'professional' THEN 107374182400
    WHEN 'enterprise' THEN 268435456000
    ELSE storage_bytes_limit
  END,
  web_cpu_millicores = CASE code
    WHEN 'starter' THEN 1000
    WHEN 'professional' THEN 2000
    WHEN 'enterprise' THEN 4000
    ELSE web_cpu_millicores
  END,
  web_memory_mib = CASE code
    WHEN 'starter' THEN 1536
    WHEN 'professional' THEN 3072
    WHEN 'enterprise' THEN 6144
    ELSE web_memory_mib
  END,
  cron_cpu_millicores = CASE code
    WHEN 'starter' THEN 250
    WHEN 'professional' THEN 500
    WHEN 'enterprise' THEN 1000
    ELSE cron_cpu_millicores
  END,
  cron_memory_mib = CASE code
    WHEN 'starter' THEN 512
    WHEN 'professional' THEN 1024
    WHEN 'enterprise' THEN 1536
    ELSE cron_memory_mib
  END;

ALTER TABLE plans
  ALTER COLUMN users_active_limit SET NOT NULL,
  ALTER COLUMN storage_bytes_limit SET NOT NULL,
  ALTER COLUMN web_cpu_millicores SET NOT NULL,
  ALTER COLUMN web_memory_mib SET NOT NULL,
  ALTER COLUMN cron_cpu_millicores SET NOT NULL,
  ALTER COLUMN cron_memory_mib SET NOT NULL;

ALTER TABLE sites
  ADD COLUMN users_active_limit INTEGER,
  ADD COLUMN storage_bytes_limit BIGINT,
  ADD COLUMN web_cpu_millicores INTEGER,
  ADD COLUMN web_memory_mib INTEGER,
  ADD COLUMN cron_cpu_millicores INTEGER,
  ADD COLUMN cron_memory_mib INTEGER;

UPDATE sites s
SET
  users_active_limit = COALESCE(p.users_active_limit, CASE s.plan_code
    WHEN 'starter' THEN 100
    WHEN 'professional' THEN 1000
    WHEN 'enterprise' THEN 5000
    ELSE 100
  END),
  storage_bytes_limit = COALESCE(p.storage_bytes_limit, CASE s.plan_code
    WHEN 'starter' THEN 2147483648
    WHEN 'professional' THEN 107374182400
    WHEN 'enterprise' THEN 268435456000
    ELSE 2147483648
  END),
  web_cpu_millicores = COALESCE(p.web_cpu_millicores, CASE s.plan_code
    WHEN 'starter' THEN 1000
    WHEN 'professional' THEN 2000
    WHEN 'enterprise' THEN 4000
    ELSE 1000
  END),
  web_memory_mib = COALESCE(p.web_memory_mib, CASE s.plan_code
    WHEN 'starter' THEN 1536
    WHEN 'professional' THEN 3072
    WHEN 'enterprise' THEN 6144
    ELSE 1536
  END),
  cron_cpu_millicores = COALESCE(p.cron_cpu_millicores, CASE s.plan_code
    WHEN 'starter' THEN 250
    WHEN 'professional' THEN 500
    WHEN 'enterprise' THEN 1000
    ELSE 250
  END),
  cron_memory_mib = COALESCE(p.cron_memory_mib, CASE s.plan_code
    WHEN 'starter' THEN 512
    WHEN 'professional' THEN 1024
    WHEN 'enterprise' THEN 1536
    ELSE 512
  END)
FROM plans p
WHERE s.plan_code = p.code;

UPDATE sites
SET
  users_active_limit = COALESCE(users_active_limit, 100),
  storage_bytes_limit = COALESCE(storage_bytes_limit, 2147483648),
  web_cpu_millicores = COALESCE(web_cpu_millicores, 1000),
  web_memory_mib = COALESCE(web_memory_mib, 1536),
  cron_cpu_millicores = COALESCE(cron_cpu_millicores, 250),
  cron_memory_mib = COALESCE(cron_memory_mib, 512);

ALTER TABLE sites
  ALTER COLUMN users_active_limit SET NOT NULL,
  ALTER COLUMN storage_bytes_limit SET NOT NULL,
  ALTER COLUMN web_cpu_millicores SET NOT NULL,
  ALTER COLUMN web_memory_mib SET NOT NULL,
  ALTER COLUMN cron_cpu_millicores SET NOT NULL,
  ALTER COLUMN cron_memory_mib SET NOT NULL;

CREATE TABLE site_usage_snapshots (
  site_id UUID PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
  users_active_count INTEGER NOT NULL DEFAULT 0,
  files_bytes_used BIGINT NOT NULL DEFAULT 0,
  database_bytes_used BIGINT NOT NULL DEFAULT 0,
  storage_bytes_used BIGINT NOT NULL DEFAULT 0,
  warning_level TEXT NOT NULL DEFAULT 'normal',
  over_limit BOOLEAN NOT NULL DEFAULT FALSE,
  last_error TEXT NOT NULL DEFAULT '',
  measured_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

INSERT INTO site_usage_snapshots (
  site_id, users_active_count, files_bytes_used, database_bytes_used, storage_bytes_used,
  warning_level, over_limit, last_error, measured_at, created_at, updated_at
)
SELECT
  id, 0, 0, 0, 0,
  'normal', FALSE, '', NULL, NOW(), NOW()
FROM sites
ON CONFLICT (site_id) DO NOTHING;

-- +goose Down
DROP TABLE IF EXISTS site_usage_snapshots;

ALTER TABLE sites
  DROP COLUMN IF EXISTS cron_memory_mib,
  DROP COLUMN IF EXISTS cron_cpu_millicores,
  DROP COLUMN IF EXISTS web_memory_mib,
  DROP COLUMN IF EXISTS web_cpu_millicores,
  DROP COLUMN IF EXISTS storage_bytes_limit,
  DROP COLUMN IF EXISTS users_active_limit;

ALTER TABLE plans
  DROP COLUMN IF EXISTS cron_memory_mib,
  DROP COLUMN IF EXISTS cron_cpu_millicores,
  DROP COLUMN IF EXISTS web_memory_mib,
  DROP COLUMN IF EXISTS web_cpu_millicores,
  DROP COLUMN IF EXISTS storage_bytes_limit,
  DROP COLUMN IF EXISTS users_active_limit;
