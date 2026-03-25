package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
)

func gibibytes(value int64) int64 {
	return value * 1024 * 1024 * 1024
}

func planFeatures(users, storage, deployment, backup, support, sla string) map[string]interface{} {
	return map[string]interface{}{
		"sites":        "1 situs",
		"users":        users,
		"storage":      storage,
		"deployment":   deployment,
		"backup":       backup,
		"support":      support,
		"ssl":          true,
		"customDomain": true,
		"sla":          sla,
	}
}

func (s *Store) SeedPlans(ctx context.Context) error {
	plans := []Plan{
		{
			Code:              "kelas-10",
			Name:              "Kelas 10",
			Description:       "Untuk kelas, pelatihan, dan sekolah kecil",
			PriceMonthly:      int64Ptr(149000),
			PriceYearly:       int64Ptr(1430000),
			Features:          planFeatures("10 pengguna", "10 GB", "Managed single instance", "Harian", "Email", "99.5%"),
			UsersActiveLimit:  10,
			StorageBytesLimit: gibibytes(10),
			WebCPUMillicores:  500,
			WebMemoryMiB:      1024,
			CronCPUMillicores: 250,
			CronMemoryMiB:     512,
		},
		{
			Code:              "kelas-50",
			Name:              "Kelas 50",
			Description:       "Untuk kelas, pelatihan, dan sekolah kecil",
			PriceMonthly:      int64Ptr(299000),
			PriceYearly:       int64Ptr(2870000),
			Features:          planFeatures("50 pengguna", "25 GB", "Managed single instance", "Harian", "Email", "99.5%"),
			UsersActiveLimit:  50,
			StorageBytesLimit: gibibytes(25),
			WebCPUMillicores:  750,
			WebMemoryMiB:      1280,
			CronCPUMillicores: 250,
			CronMemoryMiB:     512,
		},
		{
			Code:              "kelas-100",
			Name:              "Kelas 100",
			Description:       "Untuk kelas, pelatihan, dan sekolah kecil",
			PriceMonthly:      int64Ptr(499000),
			PriceYearly:       int64Ptr(4790000),
			Features:          planFeatures("100 pengguna", "50 GB", "Managed single instance", "Harian", "Email", "99.5%"),
			UsersActiveLimit:  100,
			StorageBytesLimit: gibibytes(50),
			WebCPUMillicores:  1000,
			WebMemoryMiB:      1536,
			CronCPUMillicores: 250,
			CronMemoryMiB:     512,
		},
		{
			Code:              "institusi-300",
			Name:              "Institusi 300",
			Description:       "Untuk kampus, lembaga, dan operasional harian yang stabil",
			PriceMonthly:      int64Ptr(1499000),
			PriceYearly:       int64Ptr(14390000),
			Features:          planFeatures("300 pengguna", "200 GB", "Dedicated VPS", "Harian", "Prioritas", "99.9%"),
			UsersActiveLimit:  300,
			StorageBytesLimit: gibibytes(200),
			WebCPUMillicores:  1500,
			WebMemoryMiB:      2048,
			CronCPUMillicores: 500,
			CronMemoryMiB:     768,
		},
		{
			Code:              "institusi-500",
			Name:              "Institusi 500",
			Description:       "Untuk kampus, lembaga, dan operasional harian yang stabil",
			PriceMonthly:      int64Ptr(2499000),
			PriceYearly:       int64Ptr(23990000),
			Features:          planFeatures("500 pengguna", "350 GB", "Dedicated VPS", "Harian", "Prioritas", "99.9%"),
			UsersActiveLimit:  500,
			StorageBytesLimit: gibibytes(350),
			WebCPUMillicores:  2000,
			WebMemoryMiB:      3072,
			CronCPUMillicores: 500,
			CronMemoryMiB:     1024,
		},
		{
			Code:              "institusi-700",
			Name:              "Institusi 700",
			Description:       "Untuk kampus, lembaga, dan operasional harian yang stabil",
			PriceMonthly:      int64Ptr(3499000),
			PriceYearly:       int64Ptr(33590000),
			Features:          planFeatures("700 pengguna", "500 GB", "Dedicated VPS", "Harian", "Prioritas", "99.9%"),
			UsersActiveLimit:  700,
			StorageBytesLimit: gibibytes(500),
			WebCPUMillicores:  2500,
			WebMemoryMiB:      4096,
			CronCPUMillicores: 750,
			CronMemoryMiB:     1024,
		},
		{
			Code:              "skala-1000",
			Name:              "Skala 1000",
			Description:       "Untuk deployment besar, multi-unit, dan trafik tinggi",
			PriceMonthly:      int64Ptr(5999000),
			PriceYearly:       int64Ptr(57590000),
			Features:          planFeatures("1.000 pengguna", "750 GB", "HA cluster", "Prioritas", "Dedicated", "99.95%"),
			UsersActiveLimit:  1000,
			StorageBytesLimit: gibibytes(750),
			WebCPUMillicores:  3000,
			WebMemoryMiB:      6144,
			CronCPUMillicores: 1000,
			CronMemoryMiB:     1536,
		},
		{
			Code:              "skala-3000",
			Name:              "Skala 3000",
			Description:       "Untuk deployment besar, multi-unit, dan trafik tinggi",
			PriceMonthly:      int64Ptr(12999000),
			PriceYearly:       int64Ptr(124790000),
			Features:          planFeatures("3.000 pengguna", "1.5 TB", "HA cluster", "Prioritas", "Dedicated", "99.95%"),
			UsersActiveLimit:  3000,
			StorageBytesLimit: gibibytes(1536),
			WebCPUMillicores:  5000,
			WebMemoryMiB:      8192,
			CronCPUMillicores: 1500,
			CronMemoryMiB:     2048,
		},
		{
			Code:              "skala-5000",
			Name:              "Skala 5000",
			Description:       "Untuk deployment besar, multi-unit, dan trafik tinggi",
			PriceMonthly:      int64Ptr(19999000),
			PriceYearly:       int64Ptr(191990000),
			Features:          planFeatures("5.000 pengguna", "3 TB", "HA cluster", "Prioritas", "Dedicated", "99.95%"),
			UsersActiveLimit:  5000,
			StorageBytesLimit: gibibytes(3072),
			WebCPUMillicores:  7000,
			WebMemoryMiB:      12288,
			CronCPUMillicores: 2000,
			CronMemoryMiB:     3072,
		},
		{
			Code:              "skala-10000",
			Name:              "Skala 10000",
			Description:       "Untuk deployment besar, multi-unit, dan trafik tinggi",
			PriceMonthly:      int64Ptr(34999000),
			PriceYearly:       int64Ptr(335990000),
			Features:          planFeatures("10.000 pengguna", "6 TB", "HA cluster", "Prioritas", "Dedicated", "99.95%"),
			UsersActiveLimit:  10000,
			StorageBytesLimit: gibibytes(6144),
			WebCPUMillicores:  10000,
			WebMemoryMiB:      16384,
			CronCPUMillicores: 3000,
			CronMemoryMiB:     4096,
		},
		{
			Code:         "starter",
			Name:         "Starter",
			Description:  "Untuk individu dan kelas kecil",
			PriceMonthly: int64Ptr(0),
			PriceYearly:  int64Ptr(0),
			Features: map[string]interface{}{
				"sites":        "1 situs",
				"users":        "100 pengguna",
				"storage":      "2 GB",
				"bandwidth":    "10 GB/bulan",
				"backup":       "Mingguan",
				"support":      "Email",
				"ssl":          true,
				"customDomain": false,
				"api":          false,
				"analytics":    false,
			},
			UsersActiveLimit:  100,
			StorageBytesLimit: 2 * 1024 * 1024 * 1024,
			WebCPUMillicores:  1000,
			WebMemoryMiB:      1536,
			CronCPUMillicores: 250,
			CronMemoryMiB:     512,
		},
		{
			Code:         "professional",
			Name:         "Professional",
			Description:  "Untuk institusi menengah",
			PriceMonthly: int64Ptr(499000),
			PriceYearly:  int64Ptr(4990000),
			Features: map[string]interface{}{
				"sites":        "5 situs",
				"users":        "1.000 pengguna",
				"storage":      "100 GB",
				"bandwidth":    "100 GB/bulan",
				"backup":       "Harian",
				"support":      "Prioritas",
				"ssl":          true,
				"customDomain": true,
				"api":          true,
				"analytics":    true,
			},
			UsersActiveLimit:  1000,
			StorageBytesLimit: 100 * 1024 * 1024 * 1024,
			WebCPUMillicores:  2000,
			WebMemoryMiB:      3072,
			CronCPUMillicores: 500,
			CronMemoryMiB:     1024,
		},
		{
			Code:         "enterprise",
			Name:         "Enterprise",
			Description:  "Untuk institusi besar",
			PriceMonthly: nil,
			PriceYearly:  nil,
			Features: map[string]interface{}{
				"sites":        "Custom",
				"users":        "5.000 pengguna",
				"storage":      "250 GB",
				"bandwidth":    "Unlimited",
				"backup":       "Real-time",
				"support":      "Dedicated",
				"ssl":          true,
				"customDomain": true,
				"api":          true,
				"analytics":    true,
			},
			UsersActiveLimit:  5000,
			StorageBytesLimit: 250 * 1024 * 1024 * 1024,
			WebCPUMillicores:  4000,
			WebMemoryMiB:      6144,
			CronCPUMillicores: 1000,
			CronMemoryMiB:     1536,
		},
	}

	for _, plan := range plans {
		featuresJSON, err := json.Marshal(plan.Features)
		if err != nil {
			return fmt.Errorf("marshal plan features: %w", err)
		}

		_, err = s.pool.Exec(ctx, `
			INSERT INTO plans (
				code, name, description, price_monthly, price_yearly, features,
				users_active_limit, storage_bytes_limit, web_cpu_millicores, web_memory_mib,
				cron_cpu_millicores, cron_memory_mib, created_at, updated_at
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
			ON CONFLICT (code) DO UPDATE SET
				name = EXCLUDED.name,
				description = EXCLUDED.description,
				price_monthly = EXCLUDED.price_monthly,
				price_yearly = EXCLUDED.price_yearly,
				features = EXCLUDED.features,
				users_active_limit = EXCLUDED.users_active_limit,
				storage_bytes_limit = EXCLUDED.storage_bytes_limit,
				web_cpu_millicores = EXCLUDED.web_cpu_millicores,
				web_memory_mib = EXCLUDED.web_memory_mib,
				cron_cpu_millicores = EXCLUDED.cron_cpu_millicores,
				cron_memory_mib = EXCLUDED.cron_memory_mib,
				updated_at = NOW()
		`, plan.Code, plan.Name, plan.Description, plan.PriceMonthly, plan.PriceYearly, featuresJSON, plan.UsersActiveLimit, plan.StorageBytesLimit, plan.WebCPUMillicores, plan.WebMemoryMiB, plan.CronCPUMillicores, plan.CronMemoryMiB)
		if err != nil {
			return fmt.Errorf("upsert plan %s: %w", plan.Code, err)
		}
	}

	return nil
}

func (s *Store) ListPlans(ctx context.Context) ([]Plan, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT
			code, name, description, price_monthly, price_yearly, features,
			users_active_limit, storage_bytes_limit, web_cpu_millicores, web_memory_mib,
			cron_cpu_millicores, cron_memory_mib, created_at, updated_at
		FROM plans
		ORDER BY CASE code
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
			ELSE 999 END
	`)
	if err != nil {
		return nil, fmt.Errorf("list plans: %w", err)
	}
	defer rows.Close()

	var plans []Plan
	for rows.Next() {
		var plan Plan
		var featuresJSON []byte
		if err := rows.Scan(
			&plan.Code,
			&plan.Name,
			&plan.Description,
			&plan.PriceMonthly,
			&plan.PriceYearly,
			&featuresJSON,
			&plan.UsersActiveLimit,
			&plan.StorageBytesLimit,
			&plan.WebCPUMillicores,
			&plan.WebMemoryMiB,
			&plan.CronCPUMillicores,
			&plan.CronMemoryMiB,
			&plan.CreatedAt,
			&plan.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan plan: %w", err)
		}
		if err := json.Unmarshal(featuresJSON, &plan.Features); err != nil {
			return nil, fmt.Errorf("unmarshal plan features: %w", err)
		}
		plans = append(plans, plan)
	}
	return plans, rows.Err()
}

func (s *Store) GetPlanByCode(ctx context.Context, code string) (Plan, error) {
	var plan Plan
	var featuresJSON []byte
	err := s.pool.QueryRow(ctx, `
		SELECT
			code, name, description, price_monthly, price_yearly, features,
			users_active_limit, storage_bytes_limit, web_cpu_millicores, web_memory_mib,
			cron_cpu_millicores, cron_memory_mib, created_at, updated_at
		FROM plans WHERE code = $1
	`, code).Scan(
		&plan.Code,
		&plan.Name,
		&plan.Description,
		&plan.PriceMonthly,
		&plan.PriceYearly,
		&featuresJSON,
		&plan.UsersActiveLimit,
		&plan.StorageBytesLimit,
		&plan.WebCPUMillicores,
		&plan.WebMemoryMiB,
		&plan.CronCPUMillicores,
		&plan.CronMemoryMiB,
		&plan.CreatedAt,
		&plan.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Plan{}, ErrNotFound
		}
		return Plan{}, fmt.Errorf("get plan by code: %w", err)
	}
	if err := json.Unmarshal(featuresJSON, &plan.Features); err != nil {
		return Plan{}, fmt.Errorf("unmarshal plan features: %w", err)
	}
	return plan, nil
}
