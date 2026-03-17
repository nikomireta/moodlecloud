package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct {
	pool *pgxpool.Pool
}

var (
	ErrNotFound         = errors.New("not found")
	ErrConflict         = errors.New("conflict")
	ErrCapacityExceeded = errors.New("host capacity exceeded")
)

func Open(ctx context.Context, databaseURL string) (*Store, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("open db pool: %w", err)
	}
	return &Store{pool: pool}, nil
}

func (s *Store) Close() {
	s.pool.Close()
}

func (s *Store) Pool() *pgxpool.Pool {
	return s.pool
}

func (s *Store) Ping(ctx context.Context) error {
	return s.pool.Ping(ctx)
}

func (s *Store) SeedPlans(ctx context.Context) error {
	plans := []Plan{
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

func (s *Store) SeedPlaywrightUser(ctx context.Context, params SeedPlaywrightUserParams) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin seed playwright user tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	now := time.Now().UTC()
	userID := uuid.New()
	email := strings.ToLower(strings.TrimSpace(params.Email))
	if email == "" || strings.TrimSpace(params.Name) == "" || params.PasswordHash == "" {
		return errors.New("playwright seed user requires name, email, and password hash")
	}

	err = tx.QueryRow(ctx, `
		INSERT INTO users (id, name, email, company, organization, phone, password_hash, email_verified_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, '', $6, $7, $7, $7)
		ON CONFLICT (email) DO UPDATE SET
			name = EXCLUDED.name,
			company = EXCLUDED.company,
			organization = EXCLUDED.organization,
			password_hash = EXCLUDED.password_hash,
			email_verified_at = EXCLUDED.email_verified_at,
			updated_at = EXCLUDED.updated_at
		RETURNING id
	`, userID, strings.TrimSpace(params.Name), email, strings.TrimSpace(params.Company), strings.TrimSpace(params.Organization), params.PasswordHash, now).Scan(&userID)
	if err != nil {
		return fmt.Errorf("upsert playwright seed user: %w", err)
	}

	prefs := defaultNotificationPreferences()
	emailJSON, err := json.Marshal(prefs.Email)
	if err != nil {
		return fmt.Errorf("marshal playwright seed email preferences: %w", err)
	}
	pushJSON, err := json.Marshal(prefs.Push)
	if err != nil {
		return fmt.Errorf("marshal playwright seed push preferences: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO notification_preferences (user_id, email, push, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $4)
		ON CONFLICT (user_id) DO NOTHING
	`, userID, emailJSON, pushJSON, now)
	if err != nil {
		return fmt.Errorf("ensure playwright seed notification preferences: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit seed playwright user tx: %w", err)
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
			WHEN 'starter' THEN 1
			WHEN 'professional' THEN 2
			WHEN 'enterprise' THEN 3
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

func (s *Store) CreateUser(ctx context.Context, params CreateUserParams) (User, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return User{}, fmt.Errorf("begin create user tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	now := time.Now().UTC()
	user := User{
		ID:           uuid.New(),
		Name:         params.Name,
		Email:        strings.ToLower(strings.TrimSpace(params.Email)),
		Company:      params.Company,
		Organization: params.Organization,
		Phone:        params.Phone,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO users (id, name, email, company, organization, phone, password_hash, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, user.ID, user.Name, user.Email, user.Company, user.Organization, user.Phone, params.PasswordHash, user.CreatedAt, user.UpdatedAt)
	if err != nil {
		return User{}, fmt.Errorf("insert user: %w", err)
	}

	prefs, err := json.Marshal(defaultNotificationPreferences())
	if err != nil {
		return User{}, fmt.Errorf("marshal notification preferences: %w", err)
	}

	var decoded map[string]map[string]bool
	if err := json.Unmarshal(prefs, &decoded); err != nil {
		return User{}, fmt.Errorf("decode default preferences: %w", err)
	}

	emailJSON, err := json.Marshal(decoded["email"])
	if err != nil {
		return User{}, fmt.Errorf("marshal email preferences: %w", err)
	}
	pushJSON, err := json.Marshal(decoded["push"])
	if err != nil {
		return User{}, fmt.Errorf("marshal push preferences: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO notification_preferences (user_id, email, push, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5)
	`, user.ID, emailJSON, pushJSON, now, now)
	if err != nil {
		return User{}, fmt.Errorf("insert notification preferences: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return User{}, fmt.Errorf("commit create user tx: %w", err)
	}
	return user, nil
}

func (s *Store) GetUserByEmail(ctx context.Context, email string) (AuthUser, error) {
	var user AuthUser
	err := s.pool.QueryRow(ctx, `
		SELECT id, name, email, company, organization, phone, email_verified_at, created_at, updated_at, password_hash
		FROM users
		WHERE email = $1
	`, strings.ToLower(strings.TrimSpace(email))).Scan(
		&user.ID,
		&user.Name,
		&user.Email,
		&user.Company,
		&user.Organization,
		&user.Phone,
		&user.EmailVerifiedAt,
		&user.CreatedAt,
		&user.UpdatedAt,
		&user.PasswordHash,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return AuthUser{}, ErrNotFound
		}
		return AuthUser{}, fmt.Errorf("get user by email: %w", err)
	}
	return user, nil
}

func (s *Store) GetUserByID(ctx context.Context, userID uuid.UUID) (User, error) {
	var user User
	err := s.pool.QueryRow(ctx, `
		SELECT id, name, email, company, organization, phone, email_verified_at, created_at, updated_at
		FROM users
		WHERE id = $1
	`, userID).Scan(
		&user.ID,
		&user.Name,
		&user.Email,
		&user.Company,
		&user.Organization,
		&user.Phone,
		&user.EmailVerifiedAt,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return User{}, ErrNotFound
		}
		return User{}, fmt.Errorf("get user by id: %w", err)
	}
	return user, nil
}

func (s *Store) UpdateUser(ctx context.Context, user User) (User, error) {
	user.UpdatedAt = time.Now().UTC()
	err := s.pool.QueryRow(ctx, `
		UPDATE users
		SET name = $2, company = $3, organization = $4, phone = $5, updated_at = $6
		WHERE id = $1
		RETURNING id, name, email, company, organization, phone, email_verified_at, created_at, updated_at
	`, user.ID, user.Name, user.Company, user.Organization, user.Phone, user.UpdatedAt).Scan(
		&user.ID,
		&user.Name,
		&user.Email,
		&user.Company,
		&user.Organization,
		&user.Phone,
		&user.EmailVerifiedAt,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		return User{}, fmt.Errorf("update user: %w", err)
	}
	return user, nil
}

func (s *Store) UpdateUserPassword(ctx context.Context, userID uuid.UUID, passwordHash string) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE users SET password_hash = $2, updated_at = NOW()
		WHERE id = $1
	`, userID, passwordHash)
	if err != nil {
		return fmt.Errorf("update user password: %w", err)
	}
	return nil
}

func (s *Store) CreateEmailVerification(ctx context.Context, userID uuid.UUID, code string, expiresAt time.Time) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO email_verifications (id, user_id, code, expires_at, created_at)
		VALUES ($1, $2, $3, $4, $5)
	`, uuid.New(), userID, code, expiresAt, time.Now().UTC())
	if err != nil {
		return fmt.Errorf("create email verification: %w", err)
	}
	return nil
}

func (s *Store) ConsumeEmailVerification(ctx context.Context, email, code string) (User, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return User{}, fmt.Errorf("begin consume verification tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var user User
	var verificationID uuid.UUID
	var expiresAt time.Time
	var consumedAt *time.Time
	err = tx.QueryRow(ctx, `
		SELECT
			u.id, u.name, u.email, u.company, u.organization, u.phone, u.email_verified_at, u.created_at, u.updated_at,
			ev.id, ev.expires_at, ev.consumed_at
		FROM users u
		JOIN email_verifications ev ON ev.user_id = u.id
		WHERE u.email = $1
		ORDER BY ev.created_at DESC
		LIMIT 1
	`, strings.ToLower(strings.TrimSpace(email))).Scan(
		&user.ID, &user.Name, &user.Email, &user.Company, &user.Organization, &user.Phone, &user.EmailVerifiedAt, &user.CreatedAt, &user.UpdatedAt,
		&verificationID, &expiresAt, &consumedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return User{}, ErrNotFound
		}
		return User{}, fmt.Errorf("lookup verification: %w", err)
	}
	if consumedAt != nil || time.Now().UTC().After(expiresAt) {
		return User{}, errors.New("verification code expired")
	}

	var storedCode string
	err = tx.QueryRow(ctx, `SELECT code FROM email_verifications WHERE id = $1`, verificationID).Scan(&storedCode)
	if err != nil {
		return User{}, fmt.Errorf("read verification code: %w", err)
	}
	if storedCode != code {
		return User{}, errors.New("verification code invalid")
	}

	now := time.Now().UTC()
	err = tx.QueryRow(ctx, `
		UPDATE users
		SET email_verified_at = COALESCE(email_verified_at, $2), updated_at = $2
		WHERE id = $1
		RETURNING id, name, email, company, organization, phone, email_verified_at, created_at, updated_at
	`, user.ID, now).Scan(
		&user.ID, &user.Name, &user.Email, &user.Company, &user.Organization, &user.Phone, &user.EmailVerifiedAt, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		return User{}, fmt.Errorf("update verified user: %w", err)
	}

	_, err = tx.Exec(ctx, `
		UPDATE email_verifications
		SET consumed_at = $2
		WHERE user_id = $1 AND consumed_at IS NULL
	`, user.ID, now)
	if err != nil {
		return User{}, fmt.Errorf("consume verification rows: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return User{}, fmt.Errorf("commit consume verification tx: %w", err)
	}
	return user, nil
}

func (s *Store) CreatePasswordReset(ctx context.Context, userID uuid.UUID, token string, expiresAt time.Time) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO password_resets (id, user_id, token, expires_at, created_at)
		VALUES ($1, $2, $3, $4, $5)
	`, uuid.New(), userID, token, expiresAt, time.Now().UTC())
	if err != nil {
		return fmt.Errorf("create password reset: %w", err)
	}
	return nil
}

func (s *Store) ConsumePasswordReset(ctx context.Context, token, passwordHash string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin password reset tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var resetID uuid.UUID
	var userID uuid.UUID
	var expiresAt time.Time
	var consumedAt *time.Time
	err = tx.QueryRow(ctx, `
		SELECT id, user_id, expires_at, consumed_at
		FROM password_resets
		WHERE token = $1
	`, token).Scan(&resetID, &userID, &expiresAt, &consumedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return fmt.Errorf("lookup password reset: %w", err)
	}
	if consumedAt != nil || time.Now().UTC().After(expiresAt) {
		return errors.New("reset token expired")
	}

	if _, err := tx.Exec(ctx, `UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`, userID, passwordHash); err != nil {
		return fmt.Errorf("update password from reset: %w", err)
	}
	if _, err := tx.Exec(ctx, `UPDATE password_resets SET consumed_at = NOW() WHERE id = $1`, resetID); err != nil {
		return fmt.Errorf("consume password reset: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit password reset tx: %w", err)
	}
	return nil
}

func (s *Store) CreateSession(ctx context.Context, params CreateSessionParams) (Session, error) {
	session := Session{
		ID:         uuid.New(),
		UserID:     params.UserID,
		UserAgent:  params.UserAgent,
		IPAddress:  params.IPAddress,
		RememberMe: params.RememberMe,
		ExpiresAt:  params.ExpiresAt,
		LastSeenAt: time.Now().UTC(),
		CreatedAt:  time.Now().UTC(),
	}
	_, err := s.pool.Exec(ctx, `
		INSERT INTO sessions (id, user_id, secret_hash, user_agent, ip_address, remember_me, expires_at, last_seen_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, session.ID, session.UserID, params.SecretHash, session.UserAgent, session.IPAddress, session.RememberMe, session.ExpiresAt, session.LastSeenAt, session.CreatedAt)
	if err != nil {
		return Session{}, fmt.Errorf("create session: %w", err)
	}
	return session, nil
}

func (s *Store) GetSessionLookup(ctx context.Context, sessionID uuid.UUID) (SessionLookup, error) {
	var lookup SessionLookup
	err := s.pool.QueryRow(ctx, `
		SELECT
			s.id, s.user_id, s.user_agent, s.ip_address, s.remember_me, s.expires_at, s.last_seen_at, s.created_at, s.secret_hash,
			u.id, u.name, u.email, u.company, u.organization, u.phone, u.email_verified_at, u.created_at, u.updated_at
		FROM sessions s
		JOIN users u ON u.id = s.user_id
		WHERE s.id = $1
	`, sessionID).Scan(
		&lookup.ID, &lookup.UserID, &lookup.UserAgent, &lookup.IPAddress, &lookup.RememberMe, &lookup.ExpiresAt, &lookup.LastSeenAt, &lookup.CreatedAt, &lookup.SecretHash,
		&lookup.User.ID, &lookup.User.Name, &lookup.User.Email, &lookup.User.Company, &lookup.User.Organization, &lookup.User.Phone, &lookup.User.EmailVerifiedAt, &lookup.User.CreatedAt, &lookup.User.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SessionLookup{}, ErrNotFound
		}
		return SessionLookup{}, fmt.Errorf("get session lookup: %w", err)
	}
	return lookup, nil
}

func (s *Store) TouchSession(ctx context.Context, sessionID uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `UPDATE sessions SET last_seen_at = NOW() WHERE id = $1`, sessionID)
	if err != nil {
		return fmt.Errorf("touch session: %w", err)
	}
	return nil
}

func (s *Store) DeleteSession(ctx context.Context, sessionID uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM sessions WHERE id = $1`, sessionID)
	if err != nil {
		return fmt.Errorf("delete session: %w", err)
	}
	return nil
}

func (s *Store) DeleteSessionForUser(ctx context.Context, userID, sessionID uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM sessions WHERE id = $1 AND user_id = $2`, sessionID, userID)
	if err != nil {
		return fmt.Errorf("delete session for user: %w", err)
	}
	return nil
}

func (s *Store) ListUserSessions(ctx context.Context, userID uuid.UUID) ([]Session, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, user_id, user_agent, ip_address, remember_me, expires_at, last_seen_at, created_at
		FROM sessions
		WHERE user_id = $1
		ORDER BY last_seen_at DESC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("list user sessions: %w", err)
	}
	defer rows.Close()

	sessions := make([]Session, 0)
	for rows.Next() {
		var session Session
		if err := rows.Scan(&session.ID, &session.UserID, &session.UserAgent, &session.IPAddress, &session.RememberMe, &session.ExpiresAt, &session.LastSeenAt, &session.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan user session: %w", err)
		}
		sessions = append(sessions, session)
	}
	return sessions, rows.Err()
}

func (s *Store) ListSitesByOwner(ctx context.Context, ownerUserID uuid.UUID) ([]Site, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT
			s.id, s.owner_user_id, s.name, s.subdomain, s.plan_code, s.region, s.status, s.site_url, s.admin_url,
			s.admin_name, s.admin_email, s.moodle_username, s.provisioning_step, s.last_error,
			s.users_active_limit, s.storage_bytes_limit, s.web_cpu_millicores, s.web_memory_mib,
			s.cron_cpu_millicores, s.cron_memory_mib, s.activated_at, s.created_at, s.updated_at,
			COALESCE(m.health_status, '') as runtime_health
		FROM sites s
		LEFT JOIN site_runtime_metadata m ON m.site_id = s.id
		WHERE s.owner_user_id = $1
		ORDER BY s.created_at DESC
	`, ownerUserID)
	if err != nil {
		return nil, fmt.Errorf("list sites by owner: %w", err)
	}
	defer rows.Close()

	sites := make([]Site, 0)
	for rows.Next() {
		var site Site
		if err := scanSite(rows, &site); err != nil {
			return nil, err
		}
		sites = append(sites, site)
	}
	return sites, rows.Err()
}

func (s *Store) IsSubdomainAvailable(ctx context.Context, subdomain string) (bool, error) {
	var count int
	err := s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM sites WHERE subdomain = $1`, strings.ToLower(strings.TrimSpace(subdomain))).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("count subdomains: %w", err)
	}
	return count == 0, nil
}

func (s *Store) CreateSite(ctx context.Context, params CreateSiteParams, runtimeMode string, plan Plan, capacity HostCapacityPolicy) (Site, ProvisioningJob, []ProvisioningEvent, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Site{}, ProvisioningJob{}, nil, fmt.Errorf("begin create site tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, int64(2026031701)); err != nil {
		return Site{}, ProvisioningJob{}, nil, fmt.Errorf("lock host capacity policy: %w", err)
	}
	if err := validateHostCapacity(ctx, tx, plan, capacity); err != nil {
		return Site{}, ProvisioningJob{}, nil, err
	}

	now := time.Now().UTC()
	site := Site{
		ID:                uuid.New(),
		OwnerUserID:       params.OwnerUserID,
		Name:              params.Name,
		Subdomain:         strings.ToLower(strings.TrimSpace(params.Subdomain)),
		PlanCode:          params.PlanCode,
		Region:            params.Region,
		Status:            "pending",
		SiteURL:           strings.TrimSpace(params.SiteURL),
		AdminURL:          strings.TrimSpace(params.AdminURL),
		AdminName:         params.AdminName,
		AdminEmail:        params.AdminEmail,
		MoodleUsername:    "admin",
		ProvisioningStep:  "pending",
		UsersActiveLimit:  plan.UsersActiveLimit,
		StorageBytesLimit: plan.StorageBytesLimit,
		WebCPUMillicores:  plan.WebCPUMillicores,
		WebMemoryMiB:      plan.WebMemoryMiB,
		CronCPUMillicores: plan.CronCPUMillicores,
		CronMemoryMiB:     plan.CronMemoryMiB,
		CreatedAt:         now,
		UpdatedAt:         now,
	}
	if site.SiteURL == "" {
		site.SiteURL = fmt.Sprintf("https://%s.moodlepilot.id", site.Subdomain)
	}
	if site.AdminURL == "" {
		site.AdminURL = fmt.Sprintf("%s/admin", strings.TrimRight(site.SiteURL, "/"))
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO sites (
			id, owner_user_id, name, subdomain, plan_code, region, status, site_url, admin_url,
			admin_name, admin_email, moodle_username, provisioning_step, users_active_limit,
			storage_bytes_limit, web_cpu_millicores, web_memory_mib, cron_cpu_millicores,
			cron_memory_mib, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
	`, site.ID, site.OwnerUserID, site.Name, site.Subdomain, site.PlanCode, site.Region, site.Status, site.SiteURL, site.AdminURL, site.AdminName, site.AdminEmail, site.MoodleUsername, site.ProvisioningStep, site.UsersActiveLimit, site.StorageBytesLimit, site.WebCPUMillicores, site.WebMemoryMiB, site.CronCPUMillicores, site.CronMemoryMiB, site.CreatedAt, site.UpdatedAt)
	if err != nil {
		return Site{}, ProvisioningJob{}, nil, fmt.Errorf("insert site: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO site_usage_snapshots (
			site_id, users_active_count, files_bytes_used, database_bytes_used, storage_bytes_used,
			warning_level, over_limit, last_error, measured_at, created_at, updated_at
		)
		VALUES ($1, 0, 0, 0, 0, 'normal', FALSE, '', NULL, $2, $2)
	`, site.ID, now); err != nil {
		return Site{}, ProvisioningJob{}, nil, fmt.Errorf("insert site usage snapshot: %w", err)
	}

	job := ProvisioningJob{
		ID:          uuid.New(),
		SiteID:      site.ID,
		RuntimeMode: runtimeMode,
		Status:      "pending",
		CurrentStep: "pending",
		Percent:     0,
		LastError:   "",
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO provisioning_jobs (id, site_id, runtime_mode, status, current_step, percent, last_error, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, job.ID, job.SiteID, job.RuntimeMode, job.Status, job.CurrentStep, job.Percent, job.LastError, job.CreatedAt, job.UpdatedAt)
	if err != nil {
		return Site{}, ProvisioningJob{}, nil, fmt.Errorf("insert provisioning job: %w", err)
	}

	events := defaultProvisioningEvents(job.ID, now)
	for _, event := range events {
		_, err = tx.Exec(ctx, `
			INSERT INTO provisioning_events (id, job_id, step_id, title, description, status, position, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		`, event.ID, event.JobID, event.StepID, event.Title, event.Description, event.Status, event.Position, event.CreatedAt, event.UpdatedAt)
		if err != nil {
			return Site{}, ProvisioningJob{}, nil, fmt.Errorf("insert provisioning event: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return Site{}, ProvisioningJob{}, nil, fmt.Errorf("commit create site tx: %w", err)
	}
	return site, job, events, nil
}

func (s *Store) UpsertSiteRuntimeMetadata(ctx context.Context, params UpsertSiteRuntimeMetadataParams) (SiteRuntimeMetadata, error) {
	now := time.Now().UTC()
	metadata := SiteRuntimeMetadata{
		SiteID:            params.SiteID,
		ImageRepository:   strings.TrimSpace(params.ImageRepository),
		ImageTag:          strings.TrimSpace(params.ImageTag),
		WebContainerName:  strings.TrimSpace(params.WebContainerName),
		CronContainerName: strings.TrimSpace(params.CronContainerName),
		VolumeName:        strings.TrimSpace(params.VolumeName),
		DatabaseName:      strings.TrimSpace(params.DatabaseName),
		DatabaseUser:      strings.TrimSpace(params.DatabaseUser),
		HealthStatus:      strings.TrimSpace(params.HealthStatus),
		LastHealthError:   strings.TrimSpace(params.LastHealthError),
		UpdatedAt:         now,
	}
	if metadata.HealthStatus == "" {
		metadata.HealthStatus = "unknown"
	}

	err := s.pool.QueryRow(ctx, `
		INSERT INTO site_runtime_metadata (
			site_id, image_repository, image_tag, web_container_name, cron_container_name, volume_name,
			database_name, database_user, health_status, last_health_error, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
		ON CONFLICT (site_id) DO UPDATE SET
			image_repository = EXCLUDED.image_repository,
			image_tag = EXCLUDED.image_tag,
			web_container_name = EXCLUDED.web_container_name,
			cron_container_name = EXCLUDED.cron_container_name,
			volume_name = EXCLUDED.volume_name,
			database_name = EXCLUDED.database_name,
			database_user = EXCLUDED.database_user,
			health_status = EXCLUDED.health_status,
			last_health_error = EXCLUDED.last_health_error,
			updated_at = EXCLUDED.updated_at
		RETURNING site_id, image_repository, image_tag, web_container_name, cron_container_name, volume_name,
		          database_name, database_user, health_status, last_health_error, last_health_checked_at, created_at, updated_at
	`, metadata.SiteID, metadata.ImageRepository, metadata.ImageTag, metadata.WebContainerName, metadata.CronContainerName, metadata.VolumeName, metadata.DatabaseName, metadata.DatabaseUser, metadata.HealthStatus, metadata.LastHealthError, now).Scan(
		&metadata.SiteID, &metadata.ImageRepository, &metadata.ImageTag, &metadata.WebContainerName, &metadata.CronContainerName, &metadata.VolumeName,
		&metadata.DatabaseName, &metadata.DatabaseUser, &metadata.HealthStatus, &metadata.LastHealthError, &metadata.LastHealthCheckedAt, &metadata.CreatedAt, &metadata.UpdatedAt,
	)
	if err != nil {
		return SiteRuntimeMetadata{}, fmt.Errorf("upsert site runtime metadata: %w", err)
	}
	return metadata, nil
}

func (s *Store) GetSiteRuntimeMetadata(ctx context.Context, siteID uuid.UUID) (SiteRuntimeMetadata, error) {
	var metadata SiteRuntimeMetadata
	err := s.pool.QueryRow(ctx, `
		SELECT site_id, image_repository, image_tag, web_container_name, cron_container_name, volume_name,
		       database_name, database_user, health_status, last_health_error, last_health_checked_at, created_at, updated_at
		FROM site_runtime_metadata
		WHERE site_id = $1
	`, siteID).Scan(
		&metadata.SiteID, &metadata.ImageRepository, &metadata.ImageTag, &metadata.WebContainerName, &metadata.CronContainerName, &metadata.VolumeName,
		&metadata.DatabaseName, &metadata.DatabaseUser, &metadata.HealthStatus, &metadata.LastHealthError, &metadata.LastHealthCheckedAt, &metadata.CreatedAt, &metadata.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SiteRuntimeMetadata{}, ErrNotFound
		}
		return SiteRuntimeMetadata{}, fmt.Errorf("get site runtime metadata: %w", err)
	}
	return metadata, nil
}

func (s *Store) UpdateSiteRuntimeHealth(ctx context.Context, siteID uuid.UUID, healthStatus, lastHealthError string) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE site_runtime_metadata
		SET health_status = $2, last_health_error = $3, last_health_checked_at = NOW(), updated_at = NOW()
		WHERE site_id = $1
	`, siteID, strings.TrimSpace(healthStatus), strings.TrimSpace(lastHealthError))
	if err != nil {
		return fmt.Errorf("update site runtime health: %w", err)
	}
	return nil
}

func (s *Store) GetProvisioningContextByJobID(ctx context.Context, jobID uuid.UUID) (Site, ProvisioningJob, *SiteRuntimeMetadata, error) {
	var site Site
	var job ProvisioningJob
	err := s.pool.QueryRow(ctx, `
		SELECT
			pj.id, pj.site_id, pj.runtime_mode, pj.status, pj.current_step, pj.percent, pj.last_error, pj.created_at, pj.updated_at,
			s.id, s.owner_user_id, s.name, s.subdomain, s.plan_code, s.region, s.status, s.site_url, s.admin_url,
			s.admin_name, s.admin_email, s.moodle_username, s.provisioning_step, s.last_error,
			s.users_active_limit, s.storage_bytes_limit, s.web_cpu_millicores, s.web_memory_mib,
			s.cron_cpu_millicores, s.cron_memory_mib, s.activated_at, s.created_at, s.updated_at
		FROM provisioning_jobs pj
		JOIN sites s ON s.id = pj.site_id
		WHERE pj.id = $1
	`, jobID).Scan(
		&job.ID, &job.SiteID, &job.RuntimeMode, &job.Status, &job.CurrentStep, &job.Percent, &job.LastError, &job.CreatedAt, &job.UpdatedAt,
		&site.ID, &site.OwnerUserID, &site.Name, &site.Subdomain, &site.PlanCode, &site.Region, &site.Status, &site.SiteURL, &site.AdminURL,
		&site.AdminName, &site.AdminEmail, &site.MoodleUsername, &site.ProvisioningStep, &site.LastError,
		&site.UsersActiveLimit, &site.StorageBytesLimit, &site.WebCPUMillicores, &site.WebMemoryMiB,
		&site.CronCPUMillicores, &site.CronMemoryMiB, &site.ActivatedAt, &site.CreatedAt, &site.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Site{}, ProvisioningJob{}, nil, ErrNotFound
		}
		return Site{}, ProvisioningJob{}, nil, fmt.Errorf("get provisioning context: %w", err)
	}

	runtimeMetadata, err := s.GetSiteRuntimeMetadata(ctx, site.ID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return site, job, nil, nil
		}
		return Site{}, ProvisioningJob{}, nil, err
	}
	return site, job, &runtimeMetadata, nil
}

func (s *Store) GetSiteBySubdomainForOwner(ctx context.Context, ownerUserID uuid.UUID, subdomain string) (Site, error) {
	var site Site
	err := s.pool.QueryRow(ctx, `
		SELECT
			s.id, s.owner_user_id, s.name, s.subdomain, s.plan_code, s.region, s.status, s.site_url, s.admin_url,
			s.admin_name, s.admin_email, s.moodle_username, s.provisioning_step, s.last_error,
			s.users_active_limit, s.storage_bytes_limit, s.web_cpu_millicores, s.web_memory_mib,
			s.cron_cpu_millicores, s.cron_memory_mib, s.activated_at, s.created_at, s.updated_at,
			COALESCE(m.health_status, '') as runtime_health
		FROM sites s
		LEFT JOIN site_runtime_metadata m ON m.site_id = s.id
		WHERE s.owner_user_id = $1 AND s.subdomain = $2
	`, ownerUserID, strings.ToLower(strings.TrimSpace(subdomain))).Scan(
		&site.ID, &site.OwnerUserID, &site.Name, &site.Subdomain, &site.PlanCode, &site.Region, &site.Status, &site.SiteURL, &site.AdminURL, &site.AdminName, &site.AdminEmail, &site.MoodleUsername, &site.ProvisioningStep, &site.LastError,
		&site.UsersActiveLimit, &site.StorageBytesLimit, &site.WebCPUMillicores, &site.WebMemoryMiB, &site.CronCPUMillicores, &site.CronMemoryMiB, &site.ActivatedAt, &site.CreatedAt, &site.UpdatedAt,
		&site.RuntimeHealth,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Site{}, ErrNotFound
		}
		return Site{}, fmt.Errorf("get site by subdomain: %w", err)
	}
	return site, nil
}

func (s *Store) GetSiteByIDForOwner(ctx context.Context, ownerUserID, siteID uuid.UUID) (Site, error) {
	var site Site
	err := s.pool.QueryRow(ctx, `
		SELECT
			s.id, s.owner_user_id, s.name, s.subdomain, s.plan_code, s.region, s.status, s.site_url, s.admin_url,
			s.admin_name, s.admin_email, s.moodle_username, s.provisioning_step, s.last_error,
			s.users_active_limit, s.storage_bytes_limit, s.web_cpu_millicores, s.web_memory_mib,
			s.cron_cpu_millicores, s.cron_memory_mib, s.activated_at, s.created_at, s.updated_at,
			COALESCE(m.health_status, '') as runtime_health
		FROM sites s
		LEFT JOIN site_runtime_metadata m ON m.site_id = s.id
		WHERE s.owner_user_id = $1 AND s.id = $2
	`, ownerUserID, siteID).Scan(
		&site.ID, &site.OwnerUserID, &site.Name, &site.Subdomain, &site.PlanCode, &site.Region, &site.Status, &site.SiteURL, &site.AdminURL, &site.AdminName, &site.AdminEmail, &site.MoodleUsername, &site.ProvisioningStep, &site.LastError,
		&site.UsersActiveLimit, &site.StorageBytesLimit, &site.WebCPUMillicores, &site.WebMemoryMiB, &site.CronCPUMillicores, &site.CronMemoryMiB, &site.ActivatedAt, &site.CreatedAt, &site.UpdatedAt,
		&site.RuntimeHealth,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Site{}, ErrNotFound
		}
		return Site{}, fmt.Errorf("get site by id: %w", err)
	}
	return site, nil
}

func (s *Store) GetProvisioningStatusBySiteID(ctx context.Context, ownerUserID, siteID uuid.UUID) (ProvisioningStatus, error) {
	site, err := s.GetSiteByIDForOwner(ctx, ownerUserID, siteID)
	if err != nil {
		return ProvisioningStatus{}, err
	}
	return s.getProvisioningStatusBySiteID(ctx, site.ID, site)
}

func (s *Store) GetProvisioningStatusBySubdomain(ctx context.Context, ownerUserID uuid.UUID, subdomain string) (ProvisioningStatus, error) {
	site, err := s.GetSiteBySubdomainForOwner(ctx, ownerUserID, subdomain)
	if err != nil {
		return ProvisioningStatus{}, err
	}
	return s.getProvisioningStatusBySiteID(ctx, site.ID, site)
}

func (s *Store) getProvisioningStatusBySiteID(ctx context.Context, siteID uuid.UUID, site Site) (ProvisioningStatus, error) {
	var job ProvisioningJob
	err := s.pool.QueryRow(ctx, `
		SELECT id, site_id, runtime_mode, status, current_step, percent, last_error, created_at, updated_at
		FROM provisioning_jobs
		WHERE site_id = $1
	`, siteID).Scan(&job.ID, &job.SiteID, &job.RuntimeMode, &job.Status, &job.CurrentStep, &job.Percent, &job.LastError, &job.CreatedAt, &job.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ProvisioningStatus{}, ErrNotFound
		}
		return ProvisioningStatus{}, fmt.Errorf("get provisioning job: %w", err)
	}

	rows, err := s.pool.Query(ctx, `
		SELECT id, job_id, step_id, title, description, status, position, created_at, updated_at
		FROM provisioning_events
		WHERE job_id = $1
		ORDER BY position ASC
	`, job.ID)
	if err != nil {
		return ProvisioningStatus{}, fmt.Errorf("list provisioning events: %w", err)
	}
	defer rows.Close()

	var events []ProvisioningEvent
	for rows.Next() {
		var event ProvisioningEvent
		if err := rows.Scan(&event.ID, &event.JobID, &event.StepID, &event.Title, &event.Description, &event.Status, &event.Position, &event.CreatedAt, &event.UpdatedAt); err != nil {
			return ProvisioningStatus{}, fmt.Errorf("scan provisioning event: %w", err)
		}
		events = append(events, event)
	}
	if err := rows.Err(); err != nil {
		return ProvisioningStatus{}, err
	}

	var runtimeMetadata *SiteRuntimeMetadata
	metadata, err := s.GetSiteRuntimeMetadata(ctx, site.ID)
	if err != nil {
		if !errors.Is(err, ErrNotFound) {
			return ProvisioningStatus{}, err
		}
	} else {
		runtimeMetadata = &metadata
	}

	return ProvisioningStatus{Site: site, Job: job, Runtime: runtimeMetadata, Events: events}, nil
}

func (s *Store) GetSiteUsageBySiteIDForOwner(ctx context.Context, ownerUserID, siteID uuid.UUID) (SiteUsageSnapshot, error) {
	if _, err := s.GetSiteByIDForOwner(ctx, ownerUserID, siteID); err != nil {
		return SiteUsageSnapshot{}, err
	}

	var usage SiteUsageSnapshot
	err := s.pool.QueryRow(ctx, `
		SELECT
			site_id, users_active_count, files_bytes_used, database_bytes_used, storage_bytes_used,
			warning_level, over_limit, last_error, measured_at, created_at, updated_at
		FROM site_usage_snapshots
		WHERE site_id = $1
	`, siteID).Scan(
		&usage.SiteID,
		&usage.UsersActiveCount,
		&usage.FilesBytesUsed,
		&usage.DatabaseBytesUsed,
		&usage.StorageBytesUsed,
		&usage.WarningLevel,
		&usage.OverLimit,
		&usage.LastError,
		&usage.MeasuredAt,
		&usage.CreatedAt,
		&usage.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SiteUsageSnapshot{}, ErrNotFound
		}
		return SiteUsageSnapshot{}, fmt.Errorf("get site usage snapshot: %w", err)
	}
	return usage, nil
}

func (s *Store) UpsertSiteUsageSnapshot(ctx context.Context, usage SiteUsageSnapshot) (SiteUsageSnapshot, error) {
	now := time.Now().UTC()
	if usage.WarningLevel == "" {
		usage.WarningLevel = "normal"
	}

	err := s.pool.QueryRow(ctx, `
		INSERT INTO site_usage_snapshots (
			site_id, users_active_count, files_bytes_used, database_bytes_used, storage_bytes_used,
			warning_level, over_limit, last_error, measured_at, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
		ON CONFLICT (site_id) DO UPDATE SET
			users_active_count = EXCLUDED.users_active_count,
			files_bytes_used = EXCLUDED.files_bytes_used,
			database_bytes_used = EXCLUDED.database_bytes_used,
			storage_bytes_used = EXCLUDED.storage_bytes_used,
			warning_level = EXCLUDED.warning_level,
			over_limit = EXCLUDED.over_limit,
			last_error = EXCLUDED.last_error,
			measured_at = EXCLUDED.measured_at,
			updated_at = EXCLUDED.updated_at
		RETURNING
			site_id, users_active_count, files_bytes_used, database_bytes_used, storage_bytes_used,
			warning_level, over_limit, last_error, measured_at, created_at, updated_at
	`, usage.SiteID, usage.UsersActiveCount, usage.FilesBytesUsed, usage.DatabaseBytesUsed, usage.StorageBytesUsed, usage.WarningLevel, usage.OverLimit, strings.TrimSpace(usage.LastError), usage.MeasuredAt, now).Scan(
		&usage.SiteID,
		&usage.UsersActiveCount,
		&usage.FilesBytesUsed,
		&usage.DatabaseBytesUsed,
		&usage.StorageBytesUsed,
		&usage.WarningLevel,
		&usage.OverLimit,
		&usage.LastError,
		&usage.MeasuredAt,
		&usage.CreatedAt,
		&usage.UpdatedAt,
	)
	if err != nil {
		return SiteUsageSnapshot{}, fmt.Errorf("upsert site usage snapshot: %w", err)
	}
	return usage, nil
}

func (s *Store) ListProvisioningContextsForUsageMetering(ctx context.Context) ([]SiteProvisioningContext, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT
			s.id, s.owner_user_id, s.name, s.subdomain, s.plan_code, s.region, s.status, s.site_url, s.admin_url,
			s.admin_name, s.admin_email, s.moodle_username, s.provisioning_step, s.last_error,
			s.users_active_limit, s.storage_bytes_limit, s.web_cpu_millicores, s.web_memory_mib,
			s.cron_cpu_millicores, s.cron_memory_mib, s.activated_at, s.created_at, s.updated_at,
			pj.id, pj.site_id, pj.runtime_mode, pj.status, pj.current_step, pj.percent, pj.last_error, pj.created_at, pj.updated_at,
			srm.site_id, srm.image_repository, srm.image_tag, srm.web_container_name, srm.cron_container_name,
			srm.volume_name, srm.database_name, srm.database_user, srm.health_status, srm.last_health_error,
			srm.last_health_checked_at, srm.created_at, srm.updated_at
		FROM sites s
		JOIN provisioning_jobs pj ON pj.site_id = s.id
		JOIN site_runtime_metadata srm ON srm.site_id = s.id
		WHERE pj.runtime_mode = 'docker_local'
		ORDER BY s.created_at ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("list provisioning contexts for usage metering: %w", err)
	}
	defer rows.Close()

	contexts := make([]SiteProvisioningContext, 0)
	for rows.Next() {
		var item SiteProvisioningContext
		var runtime SiteRuntimeMetadata
		if err := rows.Scan(
			&item.Site.ID, &item.Site.OwnerUserID, &item.Site.Name, &item.Site.Subdomain, &item.Site.PlanCode, &item.Site.Region, &item.Site.Status, &item.Site.SiteURL, &item.Site.AdminURL,
			&item.Site.AdminName, &item.Site.AdminEmail, &item.Site.MoodleUsername, &item.Site.ProvisioningStep, &item.Site.LastError,
			&item.Site.UsersActiveLimit, &item.Site.StorageBytesLimit, &item.Site.WebCPUMillicores, &item.Site.WebMemoryMiB,
			&item.Site.CronCPUMillicores, &item.Site.CronMemoryMiB, &item.Site.ActivatedAt, &item.Site.CreatedAt, &item.Site.UpdatedAt,
			&item.Job.ID, &item.Job.SiteID, &item.Job.RuntimeMode, &item.Job.Status, &item.Job.CurrentStep, &item.Job.Percent, &item.Job.LastError, &item.Job.CreatedAt, &item.Job.UpdatedAt,
			&runtime.SiteID, &runtime.ImageRepository, &runtime.ImageTag, &runtime.WebContainerName, &runtime.CronContainerName,
			&runtime.VolumeName, &runtime.DatabaseName, &runtime.DatabaseUser, &runtime.HealthStatus, &runtime.LastHealthError,
			&runtime.LastHealthCheckedAt, &runtime.CreatedAt, &runtime.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan provisioning context for usage metering: %w", err)
		}
		item.Runtime = &runtime
		contexts = append(contexts, item)
	}
	return contexts, rows.Err()
}

func (s *Store) StartProvisioningStep(ctx context.Context, jobID uuid.UUID, stepID string, percent int) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin start provisioning step tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `
		UPDATE provisioning_jobs
		SET status = 'provisioning', current_step = $2, percent = $3, updated_at = NOW(), last_error = ''
		WHERE id = $1
	`, jobID, stepID, percent); err != nil {
		return fmt.Errorf("update provisioning job start: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		UPDATE provisioning_events
		SET status = CASE WHEN step_id = $2 THEN 'in_progress' ELSE status END,
			updated_at = NOW()
		WHERE job_id = $1
	`, jobID, stepID); err != nil {
		return fmt.Errorf("update provisioning event start: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		UPDATE sites
		SET status = 'provisioning', provisioning_step = $2, updated_at = NOW(), last_error = ''
		WHERE id = (SELECT site_id FROM provisioning_jobs WHERE id = $1)
	`, jobID, stepID); err != nil {
		return fmt.Errorf("update site start provisioning: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit start provisioning step tx: %w", err)
	}
	return nil
}

func (s *Store) CompleteProvisioningStep(ctx context.Context, jobID uuid.UUID, stepID string, percent int) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin complete provisioning step tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `
		UPDATE provisioning_events
		SET status = 'completed', updated_at = NOW()
		WHERE job_id = $1 AND step_id = $2
	`, jobID, stepID); err != nil {
		return fmt.Errorf("complete provisioning event: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		UPDATE provisioning_jobs
		SET current_step = $2, percent = $3, updated_at = NOW()
		WHERE id = $1
	`, jobID, stepID, percent); err != nil {
		return fmt.Errorf("update provisioning job complete: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		UPDATE sites
		SET provisioning_step = $2, updated_at = NOW()
		WHERE id = (SELECT site_id FROM provisioning_jobs WHERE id = $1)
	`, jobID, stepID); err != nil {
		return fmt.Errorf("update site complete provisioning: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit complete provisioning step tx: %w", err)
	}
	return nil
}

func (s *Store) ActivateProvisioningJob(ctx context.Context, jobID uuid.UUID) (Site, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Site{}, fmt.Errorf("begin activate provisioning tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	now := time.Now().UTC()
	if _, err := tx.Exec(ctx, `
		UPDATE provisioning_jobs
		SET status = 'active', current_step = 'finalize', percent = 100, updated_at = $2
		WHERE id = $1
	`, jobID, now); err != nil {
		return Site{}, fmt.Errorf("activate provisioning job: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		UPDATE provisioning_events
		SET status = 'completed', updated_at = $2
		WHERE job_id = $1
	`, jobID, now); err != nil {
		return Site{}, fmt.Errorf("complete all provisioning events: %w", err)
	}

	var site Site
	err = tx.QueryRow(ctx, `
		UPDATE sites
		SET status = 'active', provisioning_step = 'finalize', activated_at = $2, updated_at = $2, last_error = ''
		WHERE id = (SELECT site_id FROM provisioning_jobs WHERE id = $1)
		RETURNING id, owner_user_id, name, subdomain, plan_code, region, status, site_url, admin_url, admin_name, admin_email, moodle_username, provisioning_step, last_error, activated_at, created_at, updated_at
	`, jobID, now).Scan(
		&site.ID, &site.OwnerUserID, &site.Name, &site.Subdomain, &site.PlanCode, &site.Region, &site.Status, &site.SiteURL, &site.AdminURL, &site.AdminName, &site.AdminEmail, &site.MoodleUsername, &site.ProvisioningStep, &site.LastError, &site.ActivatedAt, &site.CreatedAt, &site.UpdatedAt,
	)
	if err != nil {
		return Site{}, fmt.Errorf("activate site: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return Site{}, fmt.Errorf("commit activate provisioning tx: %w", err)
	}
	return site, nil
}

func (s *Store) FailProvisioningJob(ctx context.Context, jobID uuid.UUID, stepID, failure string) (Site, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Site{}, fmt.Errorf("begin fail provisioning tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `
		UPDATE provisioning_jobs
		SET status = 'failed', current_step = $2, last_error = $3, updated_at = NOW()
		WHERE id = $1
	`, jobID, stepID, failure); err != nil {
		return Site{}, fmt.Errorf("fail provisioning job: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		UPDATE provisioning_events
		SET status = CASE WHEN step_id = $2 THEN 'error' ELSE status END, updated_at = NOW()
		WHERE job_id = $1
	`, jobID, stepID); err != nil {
		return Site{}, fmt.Errorf("fail provisioning event: %w", err)
	}

	var site Site
	err = tx.QueryRow(ctx, `
		UPDATE sites
		SET status = 'failed', provisioning_step = $2, last_error = $3, updated_at = NOW()
		WHERE id = (SELECT site_id FROM provisioning_jobs WHERE id = $1)
		RETURNING id, owner_user_id, name, subdomain, plan_code, region, status, site_url, admin_url, admin_name, admin_email, moodle_username, provisioning_step, last_error, activated_at, created_at, updated_at
	`, jobID, stepID, failure).Scan(
		&site.ID, &site.OwnerUserID, &site.Name, &site.Subdomain, &site.PlanCode, &site.Region, &site.Status, &site.SiteURL, &site.AdminURL, &site.AdminName, &site.AdminEmail, &site.MoodleUsername, &site.ProvisioningStep, &site.LastError, &site.ActivatedAt, &site.CreatedAt, &site.UpdatedAt,
	)
	if err != nil {
		return Site{}, fmt.Errorf("fail site: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return Site{}, fmt.Errorf("commit fail provisioning tx: %w", err)
	}
	return site, nil
}

// ResetProvisioningSteps resets all provisioning events for a job back to
// "pending" status. This is used when Asynq retries a failed provisioning
// task so the frontend progress UI shows a clean slate and the worker can
// re-run every step from the beginning.
// ListOrphanedProvisioningJobs returns provisioning jobs that have been stuck
// in "pending" status for longer than the given threshold. These are jobs
// where the database transaction committed but the Asynq task was never
// enqueued (e.g., API crash between DB commit and Redis enqueue).
func (s *Store) ListOrphanedProvisioningJobs(ctx context.Context, staleThreshold time.Duration) ([]ProvisioningJob, error) {
	cutoff := time.Now().UTC().Add(-staleThreshold)
	rows, err := s.pool.Query(ctx, `
		SELECT id, site_id, runtime_mode, status, current_step, percent, last_error, created_at, updated_at
		FROM provisioning_jobs
		WHERE status = 'pending' AND created_at < $1
		ORDER BY created_at ASC
	`, cutoff)
	if err != nil {
		return nil, fmt.Errorf("list orphaned provisioning jobs: %w", err)
	}
	defer rows.Close()

	var jobs []ProvisioningJob
	for rows.Next() {
		var job ProvisioningJob
		if err := rows.Scan(&job.ID, &job.SiteID, &job.RuntimeMode, &job.Status, &job.CurrentStep, &job.Percent, &job.LastError, &job.CreatedAt, &job.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan orphaned provisioning job: %w", err)
		}
		jobs = append(jobs, job)
	}
	return jobs, rows.Err()
}

func (s *Store) ResetProvisioningSteps(ctx context.Context, jobID uuid.UUID) error {
	if _, err := s.pool.Exec(ctx, `
		UPDATE provisioning_events
		SET status = 'pending', updated_at = NOW()
		WHERE job_id = $1 AND status IN ('in_progress', 'error', 'completed')
	`, jobID); err != nil {
		return fmt.Errorf("reset provisioning steps: %w", err)
	}
	if _, err := s.pool.Exec(ctx, `
		UPDATE provisioning_jobs
		SET status = 'running', current_step = '', last_error = '', percent = 0, updated_at = NOW()
		WHERE id = $1
	`, jobID); err != nil {
		return fmt.Errorf("reset provisioning job status: %w", err)
	}
	if _, err := s.pool.Exec(ctx, `
		UPDATE sites
		SET status = 'provisioning', provisioning_step = '', last_error = '', updated_at = NOW()
		WHERE id = (SELECT site_id FROM provisioning_jobs WHERE id = $1)
	`, jobID); err != nil {
		return fmt.Errorf("reset site status for retry: %w", err)
	}
	return nil
}

func (s *Store) CreateNotification(ctx context.Context, params CreateNotificationParams) (Notification, error) {
	notification := Notification{
		ID:        uuid.New(),
		UserID:    params.UserID,
		Type:      params.Type,
		Category:  params.Category,
		Title:     params.Title,
		Message:   params.Message,
		ActionURL: params.ActionURL,
		CreatedAt: time.Now().UTC(),
	}
	_, err := s.pool.Exec(ctx, `
		INSERT INTO notifications (id, user_id, type, category, title, message, action_url, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`, notification.ID, notification.UserID, notification.Type, notification.Category, notification.Title, notification.Message, notification.ActionURL, notification.CreatedAt)
	if err != nil {
		return Notification{}, fmt.Errorf("create notification: %w", err)
	}
	return notification, nil
}

func (s *Store) ListNotifications(ctx context.Context, userID uuid.UUID) ([]Notification, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, user_id, type, category, title, message, action_url, read_at, created_at
		FROM notifications
		WHERE user_id = $1
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("list notifications: %w", err)
	}
	defer rows.Close()

	notifications := make([]Notification, 0)
	for rows.Next() {
		var notification Notification
		if err := rows.Scan(&notification.ID, &notification.UserID, &notification.Type, &notification.Category, &notification.Title, &notification.Message, &notification.ActionURL, &notification.ReadAt, &notification.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan notification: %w", err)
		}
		notifications = append(notifications, notification)
	}
	return notifications, rows.Err()
}

func (s *Store) MarkNotificationRead(ctx context.Context, userID, notificationID uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE notifications
		SET read_at = COALESCE(read_at, NOW())
		WHERE id = $1 AND user_id = $2
	`, notificationID, userID)
	if err != nil {
		return fmt.Errorf("mark notification read: %w", err)
	}
	return nil
}

func (s *Store) MarkAllNotificationsRead(ctx context.Context, userID uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE notifications
		SET read_at = COALESCE(read_at, NOW())
		WHERE user_id = $1
	`, userID)
	if err != nil {
		return fmt.Errorf("mark all notifications read: %w", err)
	}
	return nil
}

func (s *Store) DeleteNotification(ctx context.Context, userID, notificationID uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `
		DELETE FROM notifications
		WHERE id = $1 AND user_id = $2
	`, notificationID, userID)
	if err != nil {
		return fmt.Errorf("delete notification: %w", err)
	}
	return nil
}

func (s *Store) GetNotificationPreferences(ctx context.Context, userID uuid.UUID) (NotificationPreferences, error) {
	var emailJSON []byte
	var pushJSON []byte
	err := s.pool.QueryRow(ctx, `
		SELECT email, push
		FROM notification_preferences
		WHERE user_id = $1
	`, userID).Scan(&emailJSON, &pushJSON)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return defaultNotificationPreferences(), nil
		}
		return NotificationPreferences{}, fmt.Errorf("get notification preferences: %w", err)
	}

	prefs := NotificationPreferences{}
	if err := json.Unmarshal(emailJSON, &prefs.Email); err != nil {
		return NotificationPreferences{}, fmt.Errorf("decode email preferences: %w", err)
	}
	if err := json.Unmarshal(pushJSON, &prefs.Push); err != nil {
		return NotificationPreferences{}, fmt.Errorf("decode push preferences: %w", err)
	}
	return prefs, nil
}

func (s *Store) UpdateNotificationPreferences(ctx context.Context, userID uuid.UUID, prefs NotificationPreferences) (NotificationPreferences, error) {
	emailJSON, err := json.Marshal(prefs.Email)
	if err != nil {
		return NotificationPreferences{}, fmt.Errorf("marshal email preferences: %w", err)
	}
	pushJSON, err := json.Marshal(prefs.Push)
	if err != nil {
		return NotificationPreferences{}, fmt.Errorf("marshal push preferences: %w", err)
	}

	_, err = s.pool.Exec(ctx, `
		INSERT INTO notification_preferences (user_id, email, push, created_at, updated_at)
		VALUES ($1, $2, $3, NOW(), NOW())
		ON CONFLICT (user_id) DO UPDATE SET
			email = EXCLUDED.email,
			push = EXCLUDED.push,
			updated_at = NOW()
	`, userID, emailJSON, pushJSON)
	if err != nil {
		return NotificationPreferences{}, fmt.Errorf("upsert notification preferences: %w", err)
	}
	return prefs, nil
}

func defaultProvisioningEvents(jobID uuid.UUID, now time.Time) []ProvisioningEvent {
	return []ProvisioningEvent{
		{ID: uuid.New(), JobID: jobID, StepID: "provision", Title: "Menyiapkan Server", Description: "Mengalokasikan sumber daya server untuk situs Anda", Status: "pending", Position: 1, CreatedAt: now, UpdatedAt: now},
		{ID: uuid.New(), JobID: jobID, StepID: "database", Title: "Membuat Database", Description: "Menyiapkan database Moodle", Status: "pending", Position: 2, CreatedAt: now, UpdatedAt: now},
		{ID: uuid.New(), JobID: jobID, StepID: "install", Title: "Instalasi Moodle", Description: "Menginstal dan mengkonfigurasi Moodle versi terbaru", Status: "pending", Position: 3, CreatedAt: now, UpdatedAt: now},
		{ID: uuid.New(), JobID: jobID, StepID: "ssl", Title: "Konfigurasi SSL", Description: "Mengaktifkan sertifikat SSL untuk keamanan", Status: "pending", Position: 4, CreatedAt: now, UpdatedAt: now},
		{ID: uuid.New(), JobID: jobID, StepID: "finalize", Title: "Finalisasi", Description: "Menyelesaikan konfigurasi dan menyiapkan akun admin", Status: "pending", Position: 5, CreatedAt: now, UpdatedAt: now},
	}
}

func defaultNotificationPreferences() NotificationPreferences {
	return NotificationPreferences{
		Email: map[string]bool{
			"deployment":  true,
			"backup":      true,
			"security":    true,
			"billing":     true,
			"updates":     false,
			"performance": true,
		},
		Push: map[string]bool{
			"deployment":  true,
			"backup":      false,
			"security":    true,
			"billing":     true,
			"updates":     false,
			"performance": false,
		},
	}
}

func scanSite(row interface {
	Scan(dest ...interface{}) error
}, site *Site) error {
	if err := row.Scan(
		&site.ID, &site.OwnerUserID, &site.Name, &site.Subdomain, &site.PlanCode, &site.Region, &site.Status, &site.SiteURL, &site.AdminURL, &site.AdminName, &site.AdminEmail, &site.MoodleUsername, &site.ProvisioningStep, &site.LastError,
		&site.UsersActiveLimit, &site.StorageBytesLimit, &site.WebCPUMillicores, &site.WebMemoryMiB, &site.CronCPUMillicores, &site.CronMemoryMiB,
		&site.ActivatedAt, &site.CreatedAt, &site.UpdatedAt,
		&site.RuntimeHealth,
	); err != nil {
		return fmt.Errorf("scan site: %w", err)
	}
	return nil
}

func validateHostCapacity(ctx context.Context, tx pgx.Tx, plan Plan, capacity HostCapacityPolicy) error {
	var reservedStorage int64
	var reservedCPU int64
	var reservedMemory int64
	if err := tx.QueryRow(ctx, `
		SELECT
			COALESCE(SUM(storage_bytes_limit), 0),
			COALESCE(SUM(web_cpu_millicores + cron_cpu_millicores), 0),
			COALESCE(SUM(web_memory_mib + cron_memory_mib), 0)
		FROM sites
		WHERE status NOT IN ('failed', 'deleted')
	`).Scan(&reservedStorage, &reservedCPU, &reservedMemory); err != nil {
		return fmt.Errorf("read host capacity reservations: %w", err)
	}

	requestedCPU := int64(plan.WebCPUMillicores + plan.CronCPUMillicores)
	requestedMemory := int64(plan.WebMemoryMiB + plan.CronMemoryMiB)

	switch {
	case capacity.StorageBytesLimit > 0 && reservedStorage+plan.StorageBytesLimit > capacity.StorageBytesLimit:
		return fmt.Errorf("%w: storage host tidak cukup untuk paket %s", ErrCapacityExceeded, plan.Code)
	case capacity.CPUMillicoresLimit > 0 && reservedCPU+requestedCPU > int64(capacity.CPUMillicoresLimit):
		return fmt.Errorf("%w: CPU host tidak cukup untuk paket %s", ErrCapacityExceeded, plan.Code)
	case capacity.MemoryMiBLimit > 0 && reservedMemory+requestedMemory > int64(capacity.MemoryMiBLimit):
		return fmt.Errorf("%w: memori host tidak cukup untuk paket %s", ErrCapacityExceeded, plan.Code)
	default:
		return nil
	}
}

func int64Ptr(value int64) *int64 {
	return &value
}
