package httpapi

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"moodlepilot/backend/internal/store"
)

type sitePlanChangeResponse struct {
	Site    store.Site               `json:"site"`
	Usage   *store.SiteUsageSnapshot `json:"usage,omitempty"`
	Message string                   `json:"message"`
}

type sitePlanChangesResponse struct {
	Changes []store.SitePlanChange `json:"changes"`
}

func (s *Server) handleListOwnerSitePlanChanges(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	changes, err := s.store.ListSitePlanChangesByOwner(r.Context(), user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, sitePlanChangesResponse{Changes: changes})
}

func (s *Server) handleListSitePlanChanges(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	siteID, err := uuid.Parse(chi.URLParam(r, "siteID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Site ID tidak valid")
		return
	}

	changes, err := s.store.ListSitePlanChangesForOwner(r.Context(), user.ID, siteID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Situs tidak ditemukan")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, sitePlanChangesResponse{Changes: changes})
}

func (s *Server) handleChangeSitePlan(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	siteID, err := uuid.Parse(chi.URLParam(r, "siteID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Site ID tidak valid")
		return
	}

	var req struct {
		PlanCode string `json:"plan_code"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	req.PlanCode = strings.TrimSpace(req.PlanCode)
	if req.PlanCode == "" {
		writeError(w, http.StatusBadRequest, "Paket tujuan wajib diisi")
		return
	}

	currentSite, err := s.store.GetSiteByIDForOwner(r.Context(), user.ID, siteID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Situs tidak ditemukan")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if currentSite.Status != "active" {
		writeError(w, http.StatusConflict, "Situs harus aktif sebelum paket diubah")
		return
	}
	if !store.CanSelfServeUpgradeFromPlanCode(currentSite.PlanCode) {
		writeError(w, http.StatusConflict, "Paket situs ini belum mendukung upgrade mandiri")
		return
	}

	targetPlan, err := s.store.GetPlanByCode(r.Context(), req.PlanCode)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusBadRequest, "Paket tujuan tidak ditemukan")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if !store.IsSelfServePlanCode(targetPlan.Code) {
		writeError(w, http.StatusConflict, "Paket tujuan belum tersedia untuk upgrade mandiri")
		return
	}
	if currentSite.PlanCode == targetPlan.Code {
		writeError(w, http.StatusConflict, "Paket tujuan sama dengan paket aktif saat ini")
		return
	}
	if !store.IsSelfServeUpgradePath(currentSite.PlanCode, targetPlan.Code) {
		writeError(w, http.StatusConflict, "Hanya upgrade ke paket self-serve yang lebih tinggi yang diperbolehkan")
		return
	}

	provisioningStatus, err := s.store.GetProvisioningStatusBySiteID(r.Context(), user.ID, currentSite.ID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusConflict, "Status provisioning situs belum lengkap untuk upgrade paket")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if provisioningStatus.Runtime == nil {
		writeError(w, http.StatusConflict, "Runtime situs belum siap untuk upgrade paket")
		return
	}

	var customDomain *store.SiteCustomDomain
	domain, err := s.store.GetSiteCustomDomain(r.Context(), currentSite.ID)
	if err != nil {
		if !errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
	} else {
		customDomain = &domain
	}

	updatedSite, updatedUsage, err := s.store.UpdateSitePlan(r.Context(), store.UpdateSitePlanParams{
		OwnerUserID: user.ID,
		SiteID:      currentSite.ID,
		PlanCode:    targetPlan.Code,
	}, targetPlan, store.HostCapacityPolicy{
		StorageBytesLimit:  s.cfg.HostStorageBudgetBytes,
		CPUMillicoresLimit: s.cfg.HostCPUMillicoresBudget,
		MemoryMiBLimit:     s.cfg.HostMemoryMiBBudget,
	})
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Situs tidak ditemukan")
			return
		}
		if errors.Is(err, store.ErrCapacityExceeded) {
			writeError(w, http.StatusConflict, err.Error())
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if _, err := s.runtime.ReconcileSite(r.Context(), updatedSite, provisioningStatus.Job, provisioningStatus.Runtime, customDomain); err != nil {
		rollbackSite, rollbackUsage, rollbackErr := s.store.UpdateSitePlan(r.Context(), store.UpdateSitePlanParams{
			OwnerUserID: user.ID,
			SiteID:      currentSite.ID,
			PlanCode:    currentSite.PlanCode,
		}, store.Plan{
			Code:              currentSite.PlanCode,
			UsersActiveLimit:  currentSite.UsersActiveLimit,
			StorageBytesLimit: currentSite.StorageBytesLimit,
			WebCPUMillicores:  currentSite.WebCPUMillicores,
			WebMemoryMiB:      currentSite.WebMemoryMiB,
			CronCPUMillicores: currentSite.CronCPUMillicores,
			CronMemoryMiB:     currentSite.CronMemoryMiB,
		}, store.HostCapacityPolicy{
			StorageBytesLimit:  s.cfg.HostStorageBudgetBytes,
			CPUMillicoresLimit: s.cfg.HostCPUMillicoresBudget,
			MemoryMiBLimit:     s.cfg.HostMemoryMiBBudget,
		})
		if rollbackErr == nil {
			if _, runtimeRollbackErr := s.runtime.ReconcileSite(r.Context(), rollbackSite, provisioningStatus.Job, provisioningStatus.Runtime, customDomain); runtimeRollbackErr != nil {
				log.Printf("plan change runtime rollback failed for site=%s: %v", currentSite.Subdomain, runtimeRollbackErr)
			}
			_ = rollbackUsage
		}

		message := fmt.Sprintf("Upgrade paket gagal diterapkan: %v", err)
		if rollbackErr != nil {
			message = fmt.Sprintf("%s; rollback paket gagal: %v", message, rollbackErr)
		}
		writeError(w, http.StatusInternalServerError, message)
		return
	}

	if _, auditErr := s.store.CreateSitePlanChange(r.Context(), store.CreateSitePlanChangeParams{
		SiteID:       currentSite.ID,
		OwnerUserID:  user.ID,
		FromPlanCode: currentSite.PlanCode,
		ToPlanCode:   targetPlan.Code,
		Status:       "applied",
		AppliedAt:    time.Now().UTC(),
	}); auditErr != nil {
		log.Printf("site plan change audit failed site=%s: %v", currentSite.Subdomain, auditErr)
	}

	writeJSON(w, http.StatusOK, sitePlanChangeResponse{
		Site:    updatedSite,
		Usage:   updatedUsage,
		Message: fmt.Sprintf("Paket situs berhasil di-upgrade ke %s", targetPlan.Name),
	})
}
