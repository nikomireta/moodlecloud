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

	currentSite, targetPlan, err := s.validatePlanChangeRequest(r, user.ID, siteID, req.PlanCode)
	if err != nil {
		status := http.StatusInternalServerError
		switch {
		case errors.Is(err, store.ErrNotFound):
			status = http.StatusNotFound
		case errors.Is(err, store.ErrConflict):
			status = http.StatusConflict
		}
		writeError(w, status, err.Error())
		return
	}

	amountSubtotal, err := planAmountForCycle(targetPlan, "monthly")
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if amountSubtotal > 0 {
		writeJSON(w, http.StatusAccepted, map[string]any{
			"site":             currentSite,
			"checkout_required": true,
			"message":          "Upgrade berbayar memerlukan checkout. Lanjutkan dari halaman checkout atau endpoint /billing/checkouts.",
		})
		return
	}

	updatedSite, updatedUsage, err := s.applySitePlanChange(r.Context(), user.ID, currentSite, targetPlan)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if _, auditErr := s.store.CreateSitePlanChange(r.Context(), store.CreateSitePlanChangeParams{
		SiteID:        &currentSite.ID,
		SiteName:      currentSite.Name,
		SiteSubdomain: currentSite.Subdomain,
		OwnerUserID:   user.ID,
		FromPlanCode:  currentSite.PlanCode,
		ToPlanCode:    targetPlan.Code,
		Status:        "applied",
		AppliedAt:     time.Now().UTC(),
	}); auditErr != nil {
		log.Printf("site plan change audit failed site=%s: %v", currentSite.Subdomain, auditErr)
	}

	writeJSON(w, http.StatusOK, sitePlanChangeResponse{
		Site:    updatedSite,
		Usage:   updatedUsage,
		Message: fmt.Sprintf("Paket situs berhasil di-upgrade ke %s", targetPlan.Name),
	})
}
