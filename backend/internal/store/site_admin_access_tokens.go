package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"moodlepilot/backend/internal/auth"
)

func (s *Store) CreateSiteAdminAccessToken(ctx context.Context, params CreateSiteAdminAccessTokenParams) (SiteAdminAccessToken, error) {
	now := time.Now().UTC()
	token := SiteAdminAccessToken{
		ID:             uuid.New(),
		SiteID:         params.SiteID,
		OwnerUserID:    params.OwnerUserID,
		TargetUsername: strings.TrimSpace(params.TargetUsername),
		TargetEmail:    strings.ToLower(strings.TrimSpace(params.TargetEmail)),
		TokenHash:      strings.TrimSpace(params.TokenHash),
		ExpiresAt:      params.ExpiresAt.UTC(),
		CreatedAt:      now,
	}

	if token.ExpiresAt.IsZero() {
		token.ExpiresAt = now.Add(5 * time.Minute)
	}

	if err := s.pool.QueryRow(ctx, `
		INSERT INTO site_admin_access_tokens (
			id, site_id, owner_user_id, target_username, target_email, token_hash, expires_at, used_at, created_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8)
		RETURNING id, site_id, owner_user_id, target_username, target_email, token_hash, expires_at, used_at, created_at
	`, token.ID, token.SiteID, token.OwnerUserID, token.TargetUsername, token.TargetEmail, token.TokenHash, token.ExpiresAt, token.CreatedAt).Scan(
		&token.ID,
		&token.SiteID,
		&token.OwnerUserID,
		&token.TargetUsername,
		&token.TargetEmail,
		&token.TokenHash,
		&token.ExpiresAt,
		&token.UsedAt,
		&token.CreatedAt,
	); err != nil {
		return SiteAdminAccessToken{}, fmt.Errorf("create site admin access token: %w", err)
	}

	return token, nil
}

func (s *Store) RedeemSiteAdminAccessToken(ctx context.Context, siteID uuid.UUID, rawToken string) (SiteAdminAccessToken, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return SiteAdminAccessToken{}, fmt.Errorf("begin redeem site admin access token tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	rawToken = strings.TrimSpace(rawToken)
	if rawToken == "" {
		return SiteAdminAccessToken{}, ErrNotFound
	}
	tokenHash := auth.HashToken(rawToken)

	var token SiteAdminAccessToken
	err = tx.QueryRow(ctx, `
		SELECT
			id, site_id, owner_user_id, target_username, target_email, token_hash, expires_at, used_at, created_at
		FROM site_admin_access_tokens
		WHERE site_id = $1 AND token_hash = $2
		FOR UPDATE
	`, siteID, tokenHash).Scan(
		&token.ID,
		&token.SiteID,
		&token.OwnerUserID,
		&token.TargetUsername,
		&token.TargetEmail,
		&token.TokenHash,
		&token.ExpiresAt,
		&token.UsedAt,
		&token.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SiteAdminAccessToken{}, ErrNotFound
		}
		return SiteAdminAccessToken{}, fmt.Errorf("get site admin access token for redeem: %w", err)
	}

	if token.UsedAt != nil {
		return SiteAdminAccessToken{}, ErrSiteAdminAccessTokenUsed
	}
	if time.Now().UTC().After(token.ExpiresAt) {
		return SiteAdminAccessToken{}, ErrSiteAdminAccessTokenExpired
	}

	usedAt := time.Now().UTC()
	if err := tx.QueryRow(ctx, `
		UPDATE site_admin_access_tokens
		SET used_at = $2
		WHERE id = $1
		RETURNING used_at
	`, token.ID, usedAt).Scan(&token.UsedAt); err != nil {
		return SiteAdminAccessToken{}, fmt.Errorf("mark site admin access token used: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return SiteAdminAccessToken{}, fmt.Errorf("commit redeem site admin access token tx: %w", err)
	}

	return token, nil
}
