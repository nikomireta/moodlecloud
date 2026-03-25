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
)

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
