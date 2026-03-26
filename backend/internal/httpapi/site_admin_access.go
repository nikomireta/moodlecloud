package httpapi

import (
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"moodlepilot/backend/internal/auth"
	"moodlepilot/backend/internal/config"
	"moodlepilot/backend/internal/provisioning"
	"moodlepilot/backend/internal/store"
)

const (
	siteAdminAccessCapability          = "admin_access_v1"
	siteAdminAccessTokenTTL            = 5 * time.Minute
	siteAdminAccessDefaultRedirectPath = "/login/change_password.php"
)

type siteAdminAccessLinkResponse struct {
	LoginURL  string `json:"login_url"`
	ExpiresAt string `json:"expires_at"`
	Message   string `json:"message"`
}

type siteAdminAccessRedeemRequest struct {
	SiteID         string `json:"site_id"`
	BootstrapToken string `json:"bootstrap_token"`
	AccessToken    string `json:"access_token"`
}

type siteAdminAccessRedeemResponse struct {
	Username     string `json:"username"`
	Email        string `json:"email"`
	RedirectPath string `json:"redirect_path"`
	Message      string `json:"message"`
}

func (s *Server) handleIssueSiteAdminAccessLink(w http.ResponseWriter, r *http.Request) {
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
	if strings.TrimSpace(site.Status) != "active" {
		writeError(w, http.StatusConflict, "Situs harus aktif sebelum akses admin dapat dibuat")
		return
	}

	provisioningStatus, err := s.store.GetProvisioningStatusBySiteID(r.Context(), user.ID, site.ID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusConflict, "Status provisioning situs belum lengkap untuk akses admin")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if strings.TrimSpace(provisioningStatus.Job.RuntimeMode) != "docker_local" {
		writeError(w, http.StatusConflict, "Akses admin sementara hanya tersedia untuk situs shared docker_local")
		return
	}

	connection, err := s.store.GetSiteReportConnectionBySiteIDForOwner(r.Context(), user.ID, site.ID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusConflict, "Plugin tenant belum siap untuk akses admin. Sinkronkan plugin dulu.")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if !siteReportConnectionHasCapability(connection, siteAdminAccessCapability) {
		writeError(w, http.StatusConflict, "Plugin tenant belum mendukung akses admin. Sinkronkan plugin terlebih dahulu.")
		return
	}

	rawToken, err := auth.NewOpaqueToken()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	loginURL := buildSiteAdminAccessLoginURL(s.cfg, site, rawToken)
	if strings.TrimSpace(loginURL) == "" {
		writeError(w, http.StatusConflict, "URL situs belum siap untuk akses admin")
		return
	}

	expiresAt := time.Now().UTC().Add(siteAdminAccessTokenTTL)
	if _, err := s.store.CreateSiteAdminAccessToken(r.Context(), store.CreateSiteAdminAccessTokenParams{
		SiteID:         site.ID,
		OwnerUserID:    user.ID,
		TargetUsername: firstNonEmpty(strings.TrimSpace(site.MoodleUsername), "admin"),
		TargetEmail:    strings.TrimSpace(site.AdminEmail),
		TokenHash:      auth.HashToken(rawToken),
		ExpiresAt:      expiresAt,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, siteAdminAccessLinkResponse{
		LoginURL:  loginURL,
		ExpiresAt: expiresAt.Format(timeRFC3339UTC),
		Message:   "Link akses admin siap digunakan selama 5 menit dan hanya berlaku sekali.",
	})
}

func (s *Server) handleRedeemSiteAdminAccess(w http.ResponseWriter, r *http.Request) {
	var req siteAdminAccessRedeemRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	siteID, err := uuid.Parse(strings.TrimSpace(req.SiteID))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Site ID tidak valid")
		return
	}

	site, err := s.store.GetSiteByID(r.Context(), siteID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Situs tidak ditemukan")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if strings.TrimSpace(site.Status) != "active" {
		writeError(w, http.StatusConflict, "Situs tidak aktif untuk akses admin")
		return
	}
	if !provisioning.ValidateReportBootstrapToken(s.cfg.SiteRuntimeSecret, site.ID.String(), req.BootstrapToken) {
		writeError(w, http.StatusUnauthorized, "Bootstrap token tidak valid")
		return
	}

	token, err := s.store.RedeemSiteAdminAccessToken(r.Context(), site.ID, req.AccessToken)
	if err != nil {
		switch {
		case errors.Is(err, store.ErrNotFound):
			writeError(w, http.StatusUnauthorized, "Link akses admin tidak valid")
		case errors.Is(err, store.ErrSiteAdminAccessTokenExpired):
			writeError(w, http.StatusGone, "Link akses admin sudah kedaluwarsa. Minta link baru dari Moodlepilot.")
		case errors.Is(err, store.ErrSiteAdminAccessTokenUsed):
			writeError(w, http.StatusGone, "Link akses admin ini sudah pernah digunakan. Minta link baru dari Moodlepilot.")
		default:
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	writeJSON(w, http.StatusOK, siteAdminAccessRedeemResponse{
		Username:     strings.TrimSpace(token.TargetUsername),
		Email:        strings.TrimSpace(token.TargetEmail),
		RedirectPath: siteAdminAccessDefaultRedirectPath,
		Message:      "Link akses admin tervalidasi.",
	})
}

func siteReportConnectionHasCapability(connection store.SiteReportConnection, capability string) bool {
	capability = strings.ToLower(strings.TrimSpace(capability))
	if capability == "" {
		return false
	}

	for _, current := range connection.Capabilities {
		if strings.ToLower(strings.TrimSpace(current)) == capability {
			return true
		}
	}

	return false
}

func buildSiteAdminAccessLoginURL(cfg config.Config, site store.Site, token string) string {
	baseURL := strings.TrimRight(strings.TrimSpace(site.SiteURL), "/")
	if baseURL == "" {
		fallbackSiteURL, _ := provisioning.BuildSiteURLs(cfg, site.Subdomain)
		baseURL = strings.TrimRight(strings.TrimSpace(fallbackSiteURL), "/")
	}
	if baseURL == "" {
		return ""
	}
	return baseURL + "/local/moodlepilot_report/admin_access.php?t=" + url.QueryEscape(strings.TrimSpace(token))
}
