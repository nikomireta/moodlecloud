-- name: ListSitesByOwner :many
SELECT id, owner_user_id, name, subdomain, plan_code, region, status, site_url, admin_url, admin_name, admin_email, moodle_username, provisioning_step, last_error, activated_at, created_at, updated_at
FROM sites
WHERE owner_user_id = $1
ORDER BY created_at DESC;
