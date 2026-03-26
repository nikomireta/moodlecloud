package provisioning

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/hibiken/asynq"
	"github.com/jackc/pgx/v5/pgxpool"

	"moodlepilot/backend/internal/store"
)

func (h Handler) HandleMeterSiteUsageSweepTask(ctx context.Context, _ *asynq.Task) error {
	contexts, err := h.Store.ListProvisioningContextsForUsageMetering(ctx)
	if err != nil {
		return fmt.Errorf("list usage metering contexts: %w", err)
	}

	for _, item := range contexts {
		usage, err := h.measureSiteUsageSnapshot(ctx, item)
		if err != nil {
			current, currentErr := h.Store.GetSiteUsageBySiteIDForOwner(ctx, item.Site.OwnerUserID, item.Site.ID)
			if currentErr != nil && !errors.Is(currentErr, store.ErrNotFound) {
				return fmt.Errorf("read current usage for %s: %w", item.Site.Subdomain, currentErr)
			}
			if currentErr == nil {
				current.LastError = err.Error()
				if _, upsertErr := h.Store.UpsertSiteUsageSnapshot(ctx, current); upsertErr != nil {
					return fmt.Errorf("persist usage error for %s: %w", item.Site.Subdomain, upsertErr)
				}
				continue
			}

			now := time.Now().UTC()
			if _, upsertErr := h.Store.UpsertSiteUsageSnapshot(ctx, store.SiteUsageSnapshot{
				SiteID:       item.Site.ID,
				WarningLevel: "normal",
				OverLimit:    false,
				LastError:    err.Error(),
				MeasuredAt:   nil,
				CreatedAt:    now,
				UpdatedAt:    now,
			}); upsertErr != nil {
				return fmt.Errorf("persist initial usage error for %s: %w", item.Site.Subdomain, upsertErr)
			}
			continue
		}

		if _, err := h.Store.UpsertSiteUsageSnapshot(ctx, usage); err != nil {
			return fmt.Errorf("upsert site usage for %s: %w", item.Site.Subdomain, err)
		}
	}

	return nil
}

func MeasureSiteUsageSnapshot(ctx context.Context, item store.SiteProvisioningContext, siteDBAdminURL, siteRuntimeSecret string) (store.SiteUsageSnapshot, error) {
	handler := Handler{
		SiteDBAdminURL:    siteDBAdminURL,
		SiteRuntimeSecret: siteRuntimeSecret,
	}
	return handler.measureSiteUsageSnapshot(ctx, item)
}

func (h Handler) measureSiteUsageSnapshot(ctx context.Context, item store.SiteProvisioningContext) (store.SiteUsageSnapshot, error) {
	if item.Runtime == nil {
		return store.SiteUsageSnapshot{}, errors.New("runtime metadata belum tersedia untuk metering")
	}

	siteDBURL, err := buildSiteDatabaseURL(h.SiteDBAdminURL, *item.Runtime, DatabasePassword(h.SiteRuntimeSecret, item.Site.ID.String()))
	if err != nil {
		return store.SiteUsageSnapshot{}, fmt.Errorf("build site database url: %w", err)
	}

	pool, err := pgxpool.New(ctx, siteDBURL)
	if err != nil {
		return store.SiteUsageSnapshot{}, fmt.Errorf("open site database: %w", err)
	}
	defer pool.Close()

	adminUsername := strings.TrimSpace(item.Site.MoodleUsername)
	if adminUsername == "" {
		adminUsername = "admin"
	}

	var usersActiveCount int
	if err := pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM mdl_user
		WHERE deleted = 0
		  AND suspended = 0
		  AND username <> 'guest'
		  AND username <> $1
	`, adminUsername).Scan(&usersActiveCount); err != nil {
		return store.SiteUsageSnapshot{}, fmt.Errorf("count active moodle users: %w", err)
	}

	var filesBytesUsed int64
	if err := pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(GREATEST(filesize, 0)), 0)
		FROM mdl_files
		WHERE filename <> '.'
	`).Scan(&filesBytesUsed); err != nil {
		return store.SiteUsageSnapshot{}, fmt.Errorf("sum moodle file usage: %w", err)
	}

	var databaseBytesUsed int64
	if err := pool.QueryRow(ctx, `SELECT pg_database_size(current_database())`).Scan(&databaseBytesUsed); err != nil {
		return store.SiteUsageSnapshot{}, fmt.Errorf("read database size: %w", err)
	}

	storageBytesUsed := filesBytesUsed + databaseBytesUsed
	warningLevel, overLimit := classifyUsageLevel(item.Site.UsersActiveLimit, item.Site.StorageBytesLimit, usersActiveCount, storageBytesUsed)
	measuredAt := time.Now().UTC()

	return store.SiteUsageSnapshot{
		SiteID:            item.Site.ID,
		UsersActiveCount:  usersActiveCount,
		FilesBytesUsed:    filesBytesUsed,
		DatabaseBytesUsed: databaseBytesUsed,
		StorageBytesUsed:  storageBytesUsed,
		WarningLevel:      warningLevel,
		OverLimit:         overLimit,
		LastError:         "",
		MeasuredAt:        &measuredAt,
	}, nil
}

func classifyUsageLevel(usersLimit int, storageLimit int64, usersUsed int, storageUsed int64) (string, bool) {
	maxRatio := 0.0
	if usersLimit > 0 {
		ratio := float64(usersUsed) / float64(usersLimit)
		if ratio > maxRatio {
			maxRatio = ratio
		}
	}
	if storageLimit > 0 {
		ratio := float64(storageUsed) / float64(storageLimit)
		if ratio > maxRatio {
			maxRatio = ratio
		}
	}

	switch {
	case maxRatio >= 1:
		return "over_limit", true
	case maxRatio >= 0.95:
		return "critical", false
	case maxRatio >= 0.80:
		return "warning", false
	default:
		return "normal", false
	}
}
