package httpapi

import (
	"context"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/hibiken/asynq"

	"moodlepilot/backend/internal/auth"
	"moodlepilot/backend/internal/provisioning"
	"moodlepilot/backend/internal/store"
)

func (s *Server) handleListSites(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	sites, err := s.store.ListSitesByOwner(r.Context(), user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"sites": sites})
}

func (s *Server) handleCreateSite(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	var req struct {
		Name       string `json:"name"`
		Subdomain  string `json:"subdomain"`
		PlanCode   string `json:"plan_code"`
		Region     string `json:"region"`
		AdminName  string `json:"admin_name"`
		AdminEmail string `json:"admin_email"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	req.Subdomain = normalizeSubdomain(req.Subdomain)
	req.PlanCode = strings.TrimSpace(req.PlanCode)

	if strings.TrimSpace(req.Name) == "" || req.Subdomain == "" || req.PlanCode == "" || strings.TrimSpace(req.AdminName) == "" || strings.TrimSpace(req.AdminEmail) == "" {
		writeError(w, http.StatusBadRequest, "Semua field wajib diisi")
		return
	}
	if !isValidSubdomain(req.Subdomain) || isReservedSubdomain(req.Subdomain) {
		writeError(w, http.StatusBadRequest, "Subdomain tidak valid")
		return
	}
	plan, err := s.store.GetPlanByCode(r.Context(), req.PlanCode)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Paket tidak ditemukan")
		return
	}
	if !store.IsSelfServePlanCode(plan.Code) {
		writeError(w, http.StatusConflict, "Paket ini belum tersedia untuk pembuatan mandiri")
		return
	}
	available, err := s.store.IsSubdomainAvailable(r.Context(), req.Subdomain)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if !available {
		writeError(w, http.StatusConflict, "Subdomain tidak tersedia")
		return
	}
	if !looksLikeEmail(req.AdminEmail) {
		writeError(w, http.StatusBadRequest, "Email administrator tidak valid")
		return
	}
	reportBootstrapToken, err := auth.NewOpaqueToken()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	site, job, _, err := s.store.CreateSite(r.Context(), store.CreateSiteParams{
		OwnerUserID:          user.ID,
		Name:                 strings.TrimSpace(req.Name),
		Subdomain:            req.Subdomain,
		PlanCode:             req.PlanCode,
		Region:               store.SelfServeDefaultRegion,
		AdminName:            strings.TrimSpace(req.AdminName),
		AdminEmail:           auth.SanitizeEmail(req.AdminEmail),
		SiteURL:              siteURLForSubdomain(s.cfg, req.Subdomain),
		AdminURL:             adminURLForSubdomain(s.cfg, req.Subdomain),
		ReportBootstrapToken: reportBootstrapToken,
	}, s.cfg.ProvisioningRuntimeMode, plan, store.HostCapacityPolicy{
		StorageBytesLimit:  s.cfg.HostStorageBudgetBytes,
		CPUMillicoresLimit: s.cfg.HostCPUMillicoresBudget,
		MemoryMiBLimit:     s.cfg.HostMemoryMiBBudget,
	})
	if err != nil {
		if errors.Is(err, store.ErrCapacityExceeded) {
			writeError(w, http.StatusConflict, err.Error())
			return
		}
		if errors.Is(err, store.ErrConflict) {
			writeError(w, http.StatusConflict, "Subdomain tidak tersedia")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	task, err := provisioning.NewProvisionSiteTask(job.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if _, err := s.asynqClient.Enqueue(
		task,
		asynq.Queue("default"),
		asynq.MaxRetry(5),
		asynq.Timeout(20*time.Minute),
		asynq.TaskID("provision-site-"+job.ID.String()),
	); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"site":    site,
		"job":     job,
		"message": "Permintaan pembuatan situs berhasil dibuat",
	})
}

func (s *Server) handleGetSiteByID(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	siteID, err := uuid.Parse(chi.URLParam(r, "siteID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Site ID tidak valid")
		return
	}
	site, err := s.store.GetSiteByIDForOwner(r.Context(), user.ID, siteID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Situs tidak ditemukan")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"site": site})
}

func (s *Server) handleGetSiteUsage(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	siteID, err := uuid.Parse(chi.URLParam(r, "siteID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Site ID tidak valid")
		return
	}
	usage, err := s.store.GetSiteUsageBySiteIDForOwner(r.Context(), user.ID, siteID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Penggunaan situs tidak ditemukan")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"usage": usage})
}

func (s *Server) handleGetProvisioningBySiteID(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	siteID, err := uuid.Parse(chi.URLParam(r, "siteID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Site ID tidak valid")
		return
	}
	status, err := s.store.GetProvisioningStatusBySiteID(r.Context(), user.ID, siteID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Proses provisioning tidak ditemukan")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, status)
}

func (s *Server) handleGetSiteRuntime(w http.ResponseWriter, r *http.Request) {
	s.handleSiteRuntimeAction(w, r, "status")
}

func (s *Server) handleStartSiteRuntime(w http.ResponseWriter, r *http.Request) {
	s.handleSiteRuntimeAction(w, r, "start")
}

func (s *Server) handleRestartSiteRuntime(w http.ResponseWriter, r *http.Request) {
	s.handleSiteRuntimeAction(w, r, "restart")
}

func (s *Server) handleStopSiteRuntime(w http.ResponseWriter, r *http.Request) {
	s.handleSiteRuntimeAction(w, r, "stop")
}

func (s *Server) handleSiteRuntimeAction(w http.ResponseWriter, r *http.Request, action string) {
	user := currentUser(r.Context())
	siteID, err := uuid.Parse(chi.URLParam(r, "siteID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Site ID tidak valid")
		return
	}

	provisioningStatus, err := s.store.GetProvisioningStatusBySiteID(r.Context(), user.ID, siteID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Runtime situs tidak ditemukan")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var runtimeStatus provisioning.SiteRuntimeStatus
	switch action {
	case "status":
		runtimeStatus, err = s.runtime.GetRuntimeStatus(r.Context(), provisioningStatus.Site, provisioningStatus.Job, provisioningStatus.Runtime)
	case "start":
		runtimeStatus, err = s.runtime.StartSite(r.Context(), provisioningStatus.Site, provisioningStatus.Job, provisioningStatus.Runtime)
	case "restart":
		runtimeStatus, err = s.runtime.RestartSite(r.Context(), provisioningStatus.Site, provisioningStatus.Job, provisioningStatus.Runtime)
	case "stop":
		runtimeStatus, err = s.runtime.StopSite(r.Context(), provisioningStatus.Site, provisioningStatus.Job, provisioningStatus.Runtime)
	default:
		writeError(w, http.StatusInternalServerError, "Aksi runtime tidak didukung")
		return
	}
	if err != nil {
		switch {
		case errors.Is(err, provisioning.ErrRuntimeControlUnsupported):
			writeError(w, http.StatusConflict, "Runtime situs tidak mendukung aksi ini")
		case errors.Is(err, provisioning.ErrRuntimeMetadataMissing):
			writeError(w, http.StatusConflict, "Metadata runtime situs belum tersedia")
		case errors.Is(err, provisioning.ErrRuntimeNotControllable):
			writeError(w, http.StatusConflict, "Situs belum siap dikontrol")
		default:
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	s.persistRuntimeHealth(r.Context(), &runtimeStatus)
	writeJSON(w, http.StatusOK, runtimeStatus)
}

func (s *Server) handleGetSiteBySubdomain(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	site, err := s.store.GetSiteBySubdomainForOwner(r.Context(), user.ID, chi.URLParam(r, "subdomain"))
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Situs tidak ditemukan")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"site": site})
}

func (s *Server) persistRuntimeHealth(ctx context.Context, runtimeStatus *provisioning.SiteRuntimeStatus) {
	if runtimeStatus == nil || runtimeStatus.Runtime == nil {
		return
	}

	healthStatus := strings.TrimSpace(runtimeStatus.OverallStatus)
	if healthStatus == "running" {
		healthStatus = "healthy"
	} else if healthStatus == "stopped" {
		healthStatus = "stopped" // Pertahankan secara eksplisit.
	} else if healthStatus == "" {
		healthStatus = "unknown"
	}
	runtimeStatus.Runtime.HealthStatus = healthStatus
	runtimeStatus.Runtime.LastHealthError = runtimeStatus.LastError
	now := time.Now().UTC()
	runtimeStatus.Runtime.LastHealthCheckedAt = &now
	if err := s.store.UpdateSiteRuntimeHealth(ctx, runtimeStatus.Site.ID, healthStatus, runtimeStatus.LastError); err != nil {
		log.Printf("persist runtime health error: %v", err)
	}
}

func (s *Server) handleListNotifications(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	notifications, err := s.store.ListNotifications(r.Context(), user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"notifications": notifications})
}

func (s *Server) handleMarkAllNotificationsRead(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	if err := s.store.MarkAllNotificationsRead(r.Context(), user.ID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "Semua notifikasi ditandai telah dibaca"})
}

func (s *Server) handleMarkNotificationRead(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	notificationID, err := uuid.Parse(chi.URLParam(r, "notificationID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Notification ID tidak valid")
		return
	}
	if err := s.store.MarkNotificationRead(r.Context(), user.ID, notificationID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "Notifikasi ditandai telah dibaca"})
}

func (s *Server) handleDeleteNotification(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	notificationID, err := uuid.Parse(chi.URLParam(r, "notificationID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Notification ID tidak valid")
		return
	}
	if err := s.store.DeleteNotification(r.Context(), user.ID, notificationID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "Notifikasi dihapus"})
}
