package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

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
