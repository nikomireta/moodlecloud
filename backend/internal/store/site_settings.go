package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

func (s *Store) UpdateSiteName(ctx context.Context, params UpdateSiteParams) (Site, error) {
	var site Site
	err := s.pool.QueryRow(ctx, `
		UPDATE sites
		SET name = $3, updated_at = NOW()
		WHERE owner_user_id = $1 AND id = $2
		RETURNING
			id, owner_user_id, name, subdomain, plan_code, region, status, site_url, admin_url,
			admin_name, admin_email, moodle_username, provisioning_step, last_error,
			users_active_limit, storage_bytes_limit, web_cpu_millicores, web_memory_mib,
			cron_cpu_millicores, cron_memory_mib, activated_at, created_at, updated_at
	`, params.OwnerUserID, params.SiteID, strings.TrimSpace(params.Name)).Scan(
		&site.ID, &site.OwnerUserID, &site.Name, &site.Subdomain, &site.PlanCode, &site.Region, &site.Status, &site.SiteURL, &site.AdminURL,
		&site.AdminName, &site.AdminEmail, &site.MoodleUsername, &site.ProvisioningStep, &site.LastError,
		&site.UsersActiveLimit, &site.StorageBytesLimit, &site.WebCPUMillicores, &site.WebMemoryMiB,
		&site.CronCPUMillicores, &site.CronMemoryMiB, &site.ActivatedAt, &site.CreatedAt, &site.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Site{}, ErrNotFound
		}
		return Site{}, fmt.Errorf("update site name: %w", err)
	}
	return site, nil
}

func (s *Store) UpdateSiteURLs(ctx context.Context, params UpdateSiteURLsParams) (Site, error) {
	var site Site
	err := s.pool.QueryRow(ctx, `
		UPDATE sites
		SET site_url = $3, admin_url = $4, updated_at = NOW()
		WHERE owner_user_id = $1 AND id = $2
		RETURNING
			id, owner_user_id, name, subdomain, plan_code, region, status, site_url, admin_url,
			admin_name, admin_email, moodle_username, provisioning_step, last_error,
			users_active_limit, storage_bytes_limit, web_cpu_millicores, web_memory_mib,
			cron_cpu_millicores, cron_memory_mib, activated_at, created_at, updated_at
	`, params.OwnerUserID, params.SiteID, strings.TrimSpace(params.SiteURL), strings.TrimSpace(params.AdminURL)).Scan(
		&site.ID, &site.OwnerUserID, &site.Name, &site.Subdomain, &site.PlanCode, &site.Region, &site.Status, &site.SiteURL, &site.AdminURL,
		&site.AdminName, &site.AdminEmail, &site.MoodleUsername, &site.ProvisioningStep, &site.LastError,
		&site.UsersActiveLimit, &site.StorageBytesLimit, &site.WebCPUMillicores, &site.WebMemoryMiB,
		&site.CronCPUMillicores, &site.CronMemoryMiB, &site.ActivatedAt, &site.CreatedAt, &site.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Site{}, ErrNotFound
		}
		return Site{}, fmt.Errorf("update site urls: %w", err)
	}
	return site, nil
}

func (s *Store) GetSiteCustomDomain(ctx context.Context, siteID uuid.UUID) (SiteCustomDomain, error) {
	var domain SiteCustomDomain
	err := s.pool.QueryRow(ctx, `
		SELECT site_id, domain, status, verification_token, last_error, verified_at, activated_at, created_at, updated_at
		FROM site_custom_domains
		WHERE site_id = $1
	`, siteID).Scan(
		&domain.SiteID, &domain.Domain, &domain.Status, &domain.VerificationToken, &domain.LastError,
		&domain.VerifiedAt, &domain.ActivatedAt, &domain.CreatedAt, &domain.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SiteCustomDomain{}, ErrNotFound
		}
		return SiteCustomDomain{}, fmt.Errorf("get site custom domain: %w", err)
	}
	return domain, nil
}

func (s *Store) UpsertSiteCustomDomain(ctx context.Context, params UpsertSiteCustomDomainParams) (SiteCustomDomain, error) {
	now := time.Now().UTC()
	domain := SiteCustomDomain{
		SiteID:            params.SiteID,
		Domain:            strings.ToLower(strings.TrimSpace(params.Domain)),
		Status:            strings.TrimSpace(params.Status),
		VerificationToken: strings.TrimSpace(params.VerificationToken),
		LastError:         strings.TrimSpace(params.LastError),
		VerifiedAt:        params.VerifiedAt,
		ActivatedAt:       params.ActivatedAt,
	}

	err := s.pool.QueryRow(ctx, `
		INSERT INTO site_custom_domains (
			site_id, domain, status, verification_token, last_error, verified_at, activated_at, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
		ON CONFLICT (site_id) DO UPDATE SET
			domain = EXCLUDED.domain,
			status = EXCLUDED.status,
			verification_token = EXCLUDED.verification_token,
			last_error = EXCLUDED.last_error,
			verified_at = EXCLUDED.verified_at,
			activated_at = EXCLUDED.activated_at,
			updated_at = EXCLUDED.updated_at
		RETURNING site_id, domain, status, verification_token, last_error, verified_at, activated_at, created_at, updated_at
	`, domain.SiteID, domain.Domain, domain.Status, domain.VerificationToken, domain.LastError, domain.VerifiedAt, domain.ActivatedAt, now).Scan(
		&domain.SiteID, &domain.Domain, &domain.Status, &domain.VerificationToken, &domain.LastError,
		&domain.VerifiedAt, &domain.ActivatedAt, &domain.CreatedAt, &domain.UpdatedAt,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return SiteCustomDomain{}, fmt.Errorf("%w: custom domain sudah digunakan", ErrConflict)
		}
		return SiteCustomDomain{}, fmt.Errorf("upsert site custom domain: %w", err)
	}
	return domain, nil
}

func (s *Store) DeleteSiteCustomDomain(ctx context.Context, siteID uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM site_custom_domains WHERE site_id = $1`, siteID)
	if err != nil {
		return fmt.Errorf("delete site custom domain: %w", err)
	}
	return nil
}

func (s *Store) DeleteSiteForOwner(ctx context.Context, ownerUserID, siteID uuid.UUID) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM sites WHERE owner_user_id = $1 AND id = $2`, ownerUserID, siteID)
	if err != nil {
		return fmt.Errorf("delete site: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
