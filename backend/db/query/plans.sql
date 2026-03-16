-- name: ListPlans :many
SELECT code, name, description, price_monthly, price_yearly, features, created_at, updated_at
FROM plans
ORDER BY
  CASE code
    WHEN 'starter' THEN 1
    WHEN 'professional' THEN 2
    WHEN 'enterprise' THEN 3
    ELSE 999
  END;
