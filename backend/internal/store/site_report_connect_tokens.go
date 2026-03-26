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

var (
	ErrSiteReportConnectTokenExpired = errors.New("site report connect token expired")
	ErrSiteReportConnectTokenUsed    = errors.New("site report connect token already used")
)

func (s *Store) CreateSiteReportConnectToken(ctx context.Context, params CreateSiteReportConnectTokenParams) (SiteReportConnectToken, error) {
	now := time.Now().UTC()
	token := SiteReportConnectToken{
		ID:          uuid.New(),
		SiteID:      params.SiteID,
		OwnerUserID: params.OwnerUserID,
		TokenHash:   strings.TrimSpace(params.TokenHash),
		ExpiresAt:   params.ExpiresAt.UTC(),
		CreatedAt:   now,
	}
	if token.ExpiresAt.IsZero() {
		token.ExpiresAt = now.Add(15 * time.Minute)
	}

	if err := s.pool.QueryRow(ctx, `
		INSERT INTO site_report_connect_tokens (
			id, site_id, owner_user_id, token_hash, expires_at, used_at, created_at
		)
		VALUES ($1, $2, $3, $4, $5, NULL, $6)
		RETURNING id, site_id, owner_user_id, token_hash, expires_at, used_at, created_at
	`, token.ID, token.SiteID, token.OwnerUserID, token.TokenHash, token.ExpiresAt, token.CreatedAt).Scan(
		&token.ID,
		&token.SiteID,
		&token.OwnerUserID,
		&token.TokenHash,
		&token.ExpiresAt,
		&token.UsedAt,
		&token.CreatedAt,
	); err != nil {
		return SiteReportConnectToken{}, fmt.Errorf("create site report connect token: %w", err)
	}

	return token, nil
}

func (s *Store) RedeemSiteReportConnectToken(ctx context.Context, siteID uuid.UUID, rawToken string) (SiteReportConnectToken, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return SiteReportConnectToken{}, fmt.Errorf("begin redeem site report connect token tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	rawToken = strings.TrimSpace(rawToken)
	if rawToken == "" {
		return SiteReportConnectToken{}, ErrNotFound
	}
	tokenHash := auth.HashToken(rawToken)

	var token SiteReportConnectToken
	err = tx.QueryRow(ctx, `
		SELECT
			id, site_id, owner_user_id, token_hash, expires_at, used_at, created_at
		FROM site_report_connect_tokens
		WHERE site_id = $1 AND token_hash = $2
		FOR UPDATE
	`, siteID, tokenHash).Scan(
		&token.ID,
		&token.SiteID,
		&token.OwnerUserID,
		&token.TokenHash,
		&token.ExpiresAt,
		&token.UsedAt,
		&token.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SiteReportConnectToken{}, ErrNotFound
		}
		return SiteReportConnectToken{}, fmt.Errorf("get site report connect token for redeem: %w", err)
	}

	if token.UsedAt != nil {
		return SiteReportConnectToken{}, ErrSiteReportConnectTokenUsed
	}
	if time.Now().UTC().After(token.ExpiresAt) {
		return SiteReportConnectToken{}, ErrSiteReportConnectTokenExpired
	}

	usedAt := time.Now().UTC()
	if err := tx.QueryRow(ctx, `
		UPDATE site_report_connect_tokens
		SET used_at = $2
		WHERE id = $1
		RETURNING used_at
	`, token.ID, usedAt).Scan(&token.UsedAt); err != nil {
		return SiteReportConnectToken{}, fmt.Errorf("mark site report connect token used: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return SiteReportConnectToken{}, fmt.Errorf("commit redeem site report connect token tx: %w", err)
	}

	return token, nil
}
