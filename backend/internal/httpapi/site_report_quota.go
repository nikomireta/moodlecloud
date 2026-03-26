package httpapi

import (
	"context"
	"errors"
	"net/http"
	"time"

	"moodlepilot/backend/internal/auth"
	"moodlepilot/backend/internal/provisioning"
	"moodlepilot/backend/internal/store"
)

type siteReportQuotaResponse struct {
	Status            string `json:"status"`
	SiteID            string `json:"site_id"`
	PlanCode          string `json:"plan_code"`
	UsersActiveLimit  int    `json:"users_active_limit"`
	StorageBytesLimit int64  `json:"storage_bytes_limit"`
	UsersActiveCount  int    `json:"users_active_count"`
	FilesBytesUsed    int64  `json:"files_bytes_used"`
	DatabaseBytesUsed int64  `json:"database_bytes_used"`
	StorageBytesUsed  int64  `json:"storage_bytes_used"`
	WarningLevel      string `json:"warning_level"`
	OverLimit         bool   `json:"over_limit"`
	MeasuredAt        string `json:"measured_at"`
	UsageSource       string `json:"usage_source"`
	LastError         string `json:"last_error"`
}

func (s *Server) handleGetSiteReportQuota(w http.ResponseWriter, r *http.Request) {
	token := reportIngestTokenFromRequest(r)
	if token == "" {
		writeError(w, http.StatusUnauthorized, "Ingest token diperlukan")
		return
	}

	connection, err := s.store.GetSiteReportConnectionByIngestTokenHash(r.Context(), auth.HashToken(token))
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusUnauthorized, "Ingest token tidak valid")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	site, err := s.store.GetSiteByID(r.Context(), connection.SiteID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Situs tidak ditemukan")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	usage, usageSource, lastError := s.loadSiteReportQuotaUsage(r.Context(), site)
	measuredAt := ""
	if usage.MeasuredAt != nil {
		measuredAt = usage.MeasuredAt.UTC().Format(timeRFC3339UTC)
	}

	writeJSON(w, http.StatusOK, siteReportQuotaResponse{
		Status:            "ok",
		SiteID:            site.ID.String(),
		PlanCode:          site.PlanCode,
		UsersActiveLimit:  site.UsersActiveLimit,
		StorageBytesLimit: site.StorageBytesLimit,
		UsersActiveCount:  usage.UsersActiveCount,
		FilesBytesUsed:    usage.FilesBytesUsed,
		DatabaseBytesUsed: usage.DatabaseBytesUsed,
		StorageBytesUsed:  usage.StorageBytesUsed,
		WarningLevel:      usage.WarningLevel,
		OverLimit:         usage.OverLimit,
		MeasuredAt:        measuredAt,
		UsageSource:       usageSource,
		LastError:         lastError,
	})
}

func (s *Server) loadSiteReportQuotaUsage(ctx context.Context, site store.Site) (store.SiteUsageSnapshot, string, string) {
	lastError := ""

	runtimeMetadata, err := s.store.GetSiteRuntimeMetadata(ctx, site.ID)
	if err == nil {
		usage, measureErr := provisioning.MeasureSiteUsageSnapshot(ctx, store.SiteProvisioningContext{
			Site:    site,
			Runtime: &runtimeMetadata,
		}, s.cfg.SiteDBAdminURL, s.cfg.SiteRuntimeSecret)
		if measureErr == nil {
			persisted, persistErr := s.store.UpsertSiteUsageSnapshot(ctx, usage)
			if persistErr == nil {
				return persisted, "live", ""
			}
			return usage, "live", persistErr.Error()
		}
		lastError = measureErr.Error()
	} else if !errors.Is(err, store.ErrNotFound) {
		lastError = err.Error()
	}

	usage, err := s.store.GetSiteUsageBySiteID(ctx, site.ID)
	if err == nil {
		return usage, "stored", lastError
	}
	if !errors.Is(err, store.ErrNotFound) && lastError == "" {
		lastError = err.Error()
	}

	now := time.Now().UTC()
	return store.SiteUsageSnapshot{
		SiteID:       site.ID,
		WarningLevel: "normal",
		OverLimit:    false,
		CreatedAt:    now,
		UpdatedAt:    now,
	}, "empty", lastError
}
