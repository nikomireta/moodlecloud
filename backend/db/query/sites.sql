-- name: ListSitesByOwner :many
SELECT
  id,
  owner_user_id,
  name,
  subdomain,
  plan_code,
  region,
  status,
  site_url,
  admin_url,
  admin_name,
  admin_email,
  moodle_username,
  provisioning_step,
  last_error,
  users_active_limit,
  storage_bytes_limit,
  web_cpu_millicores,
  web_memory_mib,
  cron_cpu_millicores,
  cron_memory_mib,
  activated_at,
  created_at,
  updated_at
FROM sites
WHERE owner_user_id = $1
ORDER BY created_at DESC;
