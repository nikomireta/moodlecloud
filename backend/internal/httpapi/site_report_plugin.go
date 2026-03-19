package httpapi

import (
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"moodlepilot/backend/internal/auth"
	"moodlepilot/backend/internal/config"
	"moodlepilot/backend/internal/provisioning"
	"moodlepilot/backend/internal/store"
)

type siteReportPluginBootstrapResponse struct {
	Status       string    `json:"status"`
	SiteID       uuid.UUID `json:"site_id"`
	IngestToken  string    `json:"ingest_token"`
	IngestURL    string    `json:"ingest_url"`
	RegisteredAt string    `json:"registered_at"`
	Message      string    `json:"message"`
}

type siteReportPluginConnectTokenResponse struct {
	Status            string    `json:"status"`
	Mode              string    `json:"mode"`
	SiteID            uuid.UUID `json:"site_id"`
	RegistrationToken string    `json:"registration_token"`
	Message           string    `json:"message"`
}

type siteReportPluginRegistrationRequest struct {
	SiteID            string   `json:"site_id"`
	BootstrapToken    string   `json:"bootstrap_token"`
	RegistrationToken string   `json:"registration_token"`
	SiteURL           string   `json:"site_url"`
	PluginVersion     string   `json:"plugin_version"`
	MoodleVersion     string   `json:"moodle_version"`
	Capabilities      []string `json:"capabilities"`
}

func (s *Server) handleBootstrapSiteReportPlugin(w http.ResponseWriter, r *http.Request) {
	var req siteReportPluginRegistrationRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	s.handleRegisterSiteReportPlugin(w, r, req, "auto")
}

func (s *Server) handleConnectSiteReportPlugin(w http.ResponseWriter, r *http.Request) {
	var req siteReportPluginRegistrationRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	s.handleRegisterSiteReportPlugin(w, r, req, "manual")
}

func (s *Server) handleIssueSiteReportConnectToken(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	siteID, err := uuid.Parse(chi.URLParam(r, "siteID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Site ID tidak valid")
		return
	}
	if _, err := s.store.GetSiteByIDForOwner(r.Context(), user.ID, siteID); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Situs tidak ditemukan")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, siteReportPluginConnectTokenResponse{
		Status:            "ready",
		Mode:              "manual",
		SiteID:            siteID,
		RegistrationToken: provisioning.ReportConnectToken(s.cfg.SiteRuntimeSecret, siteID.String()),
		Message:           "Connect token plugin laporan berhasil dibuat",
	})
}

func (s *Server) handleRegisterSiteReportPlugin(w http.ResponseWriter, r *http.Request, req siteReportPluginRegistrationRequest, mode string) {
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

	switch mode {
	case "auto":
		if strings.TrimSpace(req.BootstrapToken) == "" {
			writeError(w, http.StatusBadRequest, "Bootstrap token wajib diisi")
			return
		}
		if !provisioning.ValidateReportBootstrapToken(s.cfg.SiteRuntimeSecret, site.ID.String(), req.BootstrapToken) {
			writeError(w, http.StatusUnauthorized, "Bootstrap token tidak valid")
			return
		}
	case "manual":
		if strings.TrimSpace(req.RegistrationToken) == "" {
			writeError(w, http.StatusBadRequest, "Registration token wajib diisi")
			return
		}
		if !provisioning.ValidateReportConnectToken(s.cfg.SiteRuntimeSecret, site.ID.String(), req.RegistrationToken) {
			writeError(w, http.StatusUnauthorized, "Registration token tidak valid")
			return
		}
	default:
		writeError(w, http.StatusBadRequest, "Mode registrasi tidak valid")
		return
	}

	ingestToken, err := auth.NewOpaqueToken()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	connection, err := s.store.UpsertSiteReportConnection(r.Context(), store.UpsertSiteReportConnectionParams{
		SiteID:          site.ID,
		IngestTokenHash: auth.HashToken(ingestToken),
		SiteURLSnapshot: firstNonEmpty(strings.TrimSpace(req.SiteURL), strings.TrimSpace(site.SiteURL)),
		PluginVersion:   strings.TrimSpace(req.PluginVersion),
		MoodleVersion:   strings.TrimSpace(req.MoodleVersion),
		Capabilities:    normalizeCapabilities(req.Capabilities),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	message := "Plugin laporan berhasil diotorisasi"
	if mode == "manual" {
		message = "Plugin laporan berhasil dihubungkan"
	}

	writeJSON(w, http.StatusOK, siteReportPluginBootstrapResponse{
		Status:       "registered",
		SiteID:       site.ID,
		IngestToken:  ingestToken,
		IngestURL:    reportIngestURL(s.cfg),
		RegisteredAt: connection.RegisteredAt.Format(timeRFC3339UTC),
		Message:      message,
	})
}

const timeRFC3339UTC = "2006-01-02T15:04:05Z07:00"

func reportIngestURL(cfg config.Config) string {
	base := strings.TrimRight(strings.TrimSpace(cfg.SiteInternalAPIBaseURL), "/")
	return base + "/v1/internal/moodle/report/ingest"
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func normalizeCapabilities(values []string) []string {
	if len(values) == 0 {
		return []string{"summary_metrics_v1"}
	}
	seen := make(map[string]struct{}, len(values))
	normalized := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.ToLower(strings.TrimSpace(value))
		if value == "" {
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		normalized = append(normalized, value)
	}
	if len(normalized) == 0 {
		return []string{"summary_metrics_v1"}
	}
	return normalized
}
