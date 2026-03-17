-- name: ListPlans :many
SELECT
  code,
  name,
  description,
  price_monthly,
  price_yearly,
  features,
  users_active_limit,
  storage_bytes_limit,
  web_cpu_millicores,
  web_memory_mib,
  cron_cpu_millicores,
  cron_memory_mib,
  created_at,
  updated_at
FROM plans
ORDER BY
  CASE code
    WHEN 'starter' THEN 1
    WHEN 'professional' THEN 2
    WHEN 'enterprise' THEN 3
    ELSE 999
  END;
