package httpapi

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"moodlepilot/backend/internal/auth"
	"moodlepilot/backend/internal/store"
)

type siteReportSnapshotResponse struct {
	Snapshot store.SiteReportSnapshot `json:"snapshot"`
}

func (s *Server) handleIngestSiteReportSnapshot(w http.ResponseWriter, r *http.Request) {
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

	var req struct {
		SiteID             string          `json:"site_id"`
		SiteURL            string          `json:"site_url"`
		SnapshotKey        string          `json:"snapshot_key"`
		PeriodKey          string          `json:"period_key"`
		PeriodStart        string          `json:"period_start"`
		PeriodEnd          string          `json:"period_end"`
		GeneratedAt        string          `json:"generated_at"`
		TrackingMode       string          `json:"tracking_mode"`
		TrackingLastSeenAt string          `json:"tracking_last_seen_at"`
		Payload            json.RawMessage `json:"payload"`
		PluginVersion      string          `json:"plugin_version"`
		MoodleVersion      string          `json:"moodle_version"`
		Capabilities       []string        `json:"capabilities"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	siteID, err := uuid.Parse(strings.TrimSpace(req.SiteID))
	if err != nil {
		_, _ = s.store.UpdateSiteReportConnectionHeartbeat(r.Context(), store.UpdateSiteReportConnectionHeartbeatParams{
			SiteID:        connection.SiteID,
			PluginVersion: req.PluginVersion,
			MoodleVersion: req.MoodleVersion,
			LastError:     "Site ID ingest tidak valid",
			LastSeenAt:    time.Now().UTC(),
		})
		writeError(w, http.StatusBadRequest, "Site ID tidak valid")
		return
	}
	if siteID != connection.SiteID {
		_, _ = s.store.UpdateSiteReportConnectionHeartbeat(r.Context(), store.UpdateSiteReportConnectionHeartbeatParams{
			SiteID:        connection.SiteID,
			PluginVersion: req.PluginVersion,
			MoodleVersion: req.MoodleVersion,
			LastError:     "Site ID ingest tidak cocok dengan koneksi plugin",
			LastSeenAt:    time.Now().UTC(),
		})
		writeError(w, http.StatusUnauthorized, "Site ID tidak cocok dengan koneksi plugin")
		return
	}

	var trackingLastSeenAt *time.Time
	if strings.TrimSpace(req.TrackingLastSeenAt) != "" {
		parsed, err := time.Parse(timeRFC3339UTC, strings.TrimSpace(req.TrackingLastSeenAt))
		if err != nil {
			_, _ = s.store.UpdateSiteReportConnectionHeartbeat(r.Context(), store.UpdateSiteReportConnectionHeartbeatParams{
				SiteID:        connection.SiteID,
				PluginVersion: req.PluginVersion,
				MoodleVersion: req.MoodleVersion,
				LastError:     "Tracking last seen ingest tidak valid",
				LastSeenAt:    time.Now().UTC(),
			})
			writeError(w, http.StatusBadRequest, "Tracking last seen tidak valid")
			return
		}
		parsed = parsed.UTC()
		trackingLastSeenAt = &parsed
	}

	periodStart, err := time.Parse(timeRFC3339UTC, strings.TrimSpace(req.PeriodStart))
	if err != nil {
		_, _ = s.store.UpdateSiteReportConnectionHeartbeat(r.Context(), store.UpdateSiteReportConnectionHeartbeatParams{
			SiteID:        connection.SiteID,
			PluginVersion: req.PluginVersion,
			MoodleVersion: req.MoodleVersion,
			LastError:     "Period start ingest tidak valid",
			LastSeenAt:    time.Now().UTC(),
		})
		writeError(w, http.StatusBadRequest, "Period start tidak valid")
		return
	}
	periodEnd, err := time.Parse(timeRFC3339UTC, strings.TrimSpace(req.PeriodEnd))
	if err != nil {
		_, _ = s.store.UpdateSiteReportConnectionHeartbeat(r.Context(), store.UpdateSiteReportConnectionHeartbeatParams{
			SiteID:        connection.SiteID,
			PluginVersion: req.PluginVersion,
			MoodleVersion: req.MoodleVersion,
			LastError:     "Period end ingest tidak valid",
			LastSeenAt:    time.Now().UTC(),
		})
		writeError(w, http.StatusBadRequest, "Period end tidak valid")
		return
	}
	if periodEnd.Before(periodStart) {
		_, _ = s.store.UpdateSiteReportConnectionHeartbeat(r.Context(), store.UpdateSiteReportConnectionHeartbeatParams{
			SiteID:        connection.SiteID,
			PluginVersion: req.PluginVersion,
			MoodleVersion: req.MoodleVersion,
			LastError:     "Period ingest tidak valid",
			LastSeenAt:    time.Now().UTC(),
		})
		writeError(w, http.StatusBadRequest, "Rentang periode tidak valid")
		return
	}

	generatedAt := time.Now().UTC()
	if strings.TrimSpace(req.GeneratedAt) != "" {
		generatedAt, err = time.Parse(timeRFC3339UTC, strings.TrimSpace(req.GeneratedAt))
		if err != nil {
			_, _ = s.store.UpdateSiteReportConnectionHeartbeat(r.Context(), store.UpdateSiteReportConnectionHeartbeatParams{
				SiteID:        connection.SiteID,
				PluginVersion: req.PluginVersion,
				MoodleVersion: req.MoodleVersion,
				LastError:     "Generated at ingest tidak valid",
				LastSeenAt:    time.Now().UTC(),
			})
			writeError(w, http.StatusBadRequest, "Generated at tidak valid")
			return
		}
	}

	payload := bytes.TrimSpace(req.Payload)
	if len(payload) == 0 {
		payload = json.RawMessage(`{}`)
	}
	if !json.Valid(payload) {
		_, _ = s.store.UpdateSiteReportConnectionHeartbeat(r.Context(), store.UpdateSiteReportConnectionHeartbeatParams{
			SiteID:        connection.SiteID,
			PluginVersion: req.PluginVersion,
			MoodleVersion: req.MoodleVersion,
			LastError:     "Payload ingest tidak valid",
			LastSeenAt:    time.Now().UTC(),
		})
		writeError(w, http.StatusBadRequest, "Payload laporan tidak valid")
		return
	}

	receivedAt := time.Now().UTC()
	snapshot, err := s.store.UpsertSiteReportSnapshot(r.Context(), store.UpsertSiteReportSnapshotParams{
		SiteID:        connection.SiteID,
		SnapshotKey:   normalizeReportSnapshotKey(req.SnapshotKey),
		PeriodKey:     normalizeReportPeriodKey(req.PeriodKey),
		PeriodStart:   periodStart,
		PeriodEnd:     periodEnd,
		Payload:       payload,
		PluginVersion: firstNonEmpty(req.PluginVersion, connection.PluginVersion),
		MoodleVersion: firstNonEmpty(req.MoodleVersion, connection.MoodleVersion),
		GeneratedAt:   generatedAt,
		ReceivedAt:    receivedAt,
	})
	if err != nil {
		_, _ = s.store.UpdateSiteReportConnectionHeartbeat(r.Context(), store.UpdateSiteReportConnectionHeartbeatParams{
			SiteID:        connection.SiteID,
			PluginVersion: req.PluginVersion,
			MoodleVersion: req.MoodleVersion,
			LastError:     err.Error(),
			LastSeenAt:    receivedAt,
		})
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if _, err := s.store.UpsertSiteReportConnection(r.Context(), store.UpsertSiteReportConnectionParams{
		SiteID:             connection.SiteID,
		IngestTokenHash:    connection.IngestTokenHash,
		SiteURLSnapshot:    firstNonEmpty(strings.TrimSpace(req.SiteURL), connection.SiteURLSnapshot),
		PluginVersion:      snapshot.PluginVersion,
		MoodleVersion:      snapshot.MoodleVersion,
		Capabilities:       normalizeCapabilities(firstNonEmptyCapabilities(req.Capabilities, connection.Capabilities)),
		TrackingMode:       firstNonEmpty(strings.TrimSpace(req.TrackingMode), connection.TrackingMode),
		TrackingLastSeenAt: trackingLastSeenAt,
		LastError:          "",
	}); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusAccepted, map[string]any{
		"status":      "accepted",
		"site_id":     connection.SiteID,
		"snapshot_id": snapshot.ID,
		"received_at": snapshot.ReceivedAt.Format(timeRFC3339UTC),
	})
}

func firstNonEmptyCapabilities(values ...[]string) []string {
	for _, current := range values {
		if len(current) == 0 {
			continue
		}
		return current
	}
	return nil
}

func (s *Server) handleGetLatestSiteReportSnapshot(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	siteID, err := uuid.Parse(chi.URLParam(r, "siteID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Site ID tidak valid")
		return
	}

	snapshot, err := s.store.GetLatestSiteReportSnapshotBySiteIDForOwner(
		r.Context(),
		user.ID,
		siteID,
		r.URL.Query().Get("snapshot_key"),
		r.URL.Query().Get("period_key"),
	)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Snapshot laporan belum tersedia")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, siteReportSnapshotResponse{Snapshot: snapshot})
}

func reportIngestTokenFromRequest(r *http.Request) string {
	if token := strings.TrimSpace(r.Header.Get("X-Moodlepilot-Ingest-Token")); token != "" {
		return token
	}
	authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
	if authHeader == "" {
		return ""
	}
	if !strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		return ""
	}
	return strings.TrimSpace(authHeader[7:])
}

func normalizeReportSnapshotKey(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "" {
		return "reports_summary_v1"
	}
	return value
}

func normalizeReportPeriodKey(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	switch value {
	case "last_30_days", "this_month", "last_month":
		return value
	case "", "last_7_days":
		return "last_7_days"
	default:
		return "last_7_days"
	}
}
