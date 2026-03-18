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
    WHEN 'kelas-10' THEN 1
    WHEN 'kelas-50' THEN 2
    WHEN 'kelas-100' THEN 3
    WHEN 'institusi-300' THEN 4
    WHEN 'institusi-500' THEN 5
    WHEN 'institusi-700' THEN 6
    WHEN 'skala-1000' THEN 7
    WHEN 'skala-3000' THEN 8
    WHEN 'skala-5000' THEN 9
    WHEN 'skala-10000' THEN 10
    WHEN 'starter' THEN 101
    WHEN 'professional' THEN 102
    WHEN 'enterprise' THEN 103
    ELSE 999
  END;
