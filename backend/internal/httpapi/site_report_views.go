package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"moodlepilot/backend/internal/store"
)

type siteReportConnectionResponse struct {
	Connection siteReportConnectionStatus `json:"connection"`
}

type siteReportSummaryResponse struct {
	Connection siteReportConnectionStatus `json:"connection"`
	Snapshot   *store.SiteReportSnapshot  `json:"snapshot,omitempty"`
	Highlight  siteReportHighlight        `json:"highlight"`
}

type siteReportFullResponse struct {
	Connection siteReportConnectionStatus `json:"connection"`
	Snapshot   *store.SiteReportSnapshot  `json:"snapshot,omitempty"`
	Highlight  siteReportHighlight        `json:"highlight"`
}

type siteReportConnectionStatus struct {
	SiteID               uuid.UUID  `json:"site_id"`
	State                string     `json:"state"`
	StateLabel           string     `json:"state_label"`
	StateMessage         string     `json:"state_message"`
	SiteURLSnapshot      string     `json:"site_url_snapshot"`
	PluginVersion        string     `json:"plugin_version"`
	MoodleVersion        string     `json:"moodle_version"`
	Capabilities         []string   `json:"capabilities"`
	TrackingMode         string     `json:"tracking_mode"`
	TrackingLastSeenAt   *timeValue `json:"tracking_last_seen_at,omitempty"`
	TrackingState        string     `json:"tracking_state"`
	TrackingStateLabel   string     `json:"tracking_state_label"`
	TrackingStateMessage string     `json:"tracking_state_message"`
	LastError            string     `json:"last_error"`
	RegisteredAt         *timeValue `json:"registered_at,omitempty"`
	LastSeenAt           *timeValue `json:"last_seen_at,omitempty"`
	LastSyncAt           *timeValue `json:"last_sync_at,omitempty"`
	HasSnapshot          bool       `json:"has_snapshot"`
	HasActivity          bool       `json:"has_activity"`
	SnapshotKey          string     `json:"snapshot_key,omitempty"`
	PeriodKey            string     `json:"period_key,omitempty"`
}

type siteReportHighlight struct {
	Title   string `json:"title"`
	Message string `json:"message"`
	Tone    string `json:"tone"`
}

type siteReportPayloadPreview struct {
	SummaryMetrics struct {
		LoginCount      int    `json:"login_count"`
		ActiveUsers     int    `json:"active_users"`
		Submissions     int    `json:"submissions"`
		AvgOnlineLabel  string `json:"avg_online_label"`
		AvgOnlineSecond int    `json:"avg_online_seconds"`
	} `json:"summary_metrics"`
	RecentActivity          []json.RawMessage `json:"recent_activity"`
	CourseCompletionSummary []struct {
		CourseName     string `json:"course_name"`
		Enrolled       int    `json:"enrolled"`
		Completed      int    `json:"completed"`
		CompletionRate int    `json:"completion_rate"`
	} `json:"course_completion_summary"`
	GradeRecapPerCourse []json.RawMessage `json:"grade_recap_per_course"`
	UserActivitySummary []struct {
		UserName         string `json:"user_name"`
		RoleLabel        string `json:"role_label"`
		Sessions         int    `json:"sessions"`
		Submissions      int    `json:"submissions"`
		TotalOnlineLabel string `json:"total_online_label"`
	} `json:"user_activity_summary"`
	UserStatus           []json.RawMessage `json:"user_status"`
	ActivityStatsSummary []struct {
		CourseName    string `json:"course_name"`
		ActivityLabel string `json:"activity_label"`
		TotalEvents   int    `json:"total_events"`
		UniqueUsers   int    `json:"unique_users"`
	} `json:"activity_stats_summary"`
	QuizActivityDetail []json.RawMessage `json:"quiz_activity_detail"`
}

type timeValue struct {
	value string
}

const reportTrackingFreshThreshold = 45 * time.Minute

func newTimeValue(value string) *timeValue {
	if value == "" {
		return nil
	}
	return &timeValue{value: value}
}

func (t *timeValue) MarshalJSON() ([]byte, error) {
	return json.Marshal(t.value)
}

func (s *Server) handleGetSiteReportConnection(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	siteID, err := uuid.Parse(chi.URLParam(r, "siteID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Site ID tidak valid")
		return
	}

	view, err := s.buildSiteReportView(r, user.ID, siteID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Situs tidak ditemukan")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, siteReportConnectionResponse{Connection: view.Connection})
}

func (s *Server) handleGetSiteReportSummary(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	siteID, err := uuid.Parse(chi.URLParam(r, "siteID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Site ID tidak valid")
		return
	}

	view, err := s.buildSiteReportView(r, user.ID, siteID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Situs tidak ditemukan")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, siteReportSummaryResponse{
		Connection: view.Connection,
		Snapshot:   view.Snapshot,
		Highlight:  view.Highlight,
	})
}

func (s *Server) handleGetSiteFullReport(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	siteID, err := uuid.Parse(chi.URLParam(r, "siteID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Site ID tidak valid")
		return
	}

	view, err := s.buildSiteReportView(r, user.ID, siteID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Situs tidak ditemukan")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, siteReportFullResponse{
		Connection: view.Connection,
		Snapshot:   view.Snapshot,
		Highlight:  view.Highlight,
	})
}

type siteReportView struct {
	Connection siteReportConnectionStatus
	Snapshot   *store.SiteReportSnapshot
	Highlight  siteReportHighlight
}

func (s *Server) buildSiteReportView(r *http.Request, ownerUserID, siteID uuid.UUID) (siteReportView, error) {
	site, err := s.store.GetSiteByIDForOwner(r.Context(), ownerUserID, siteID)
	if err != nil {
		return siteReportView{}, err
	}

	snapshotKey := normalizeReportSnapshotKey(r.URL.Query().Get("snapshot_key"))
	periodKey := normalizeReportPeriodKey(r.URL.Query().Get("period_key"))

	var connection *store.SiteReportConnection
	rawConnection, err := s.store.GetSiteReportConnectionBySiteIDForOwner(r.Context(), ownerUserID, siteID)
	if err == nil {
		connection = &rawConnection
	} else if !errors.Is(err, store.ErrNotFound) {
		return siteReportView{}, err
	}

	var snapshot *store.SiteReportSnapshot
	rawSnapshot, err := s.store.GetLatestSiteReportSnapshotBySiteIDForOwner(r.Context(), ownerUserID, siteID, snapshotKey, periodKey)
	if err == nil {
		snapshot = &rawSnapshot
	} else if !errors.Is(err, store.ErrNotFound) {
		return siteReportView{}, err
	}

	payload := decodeReportPayload(snapshot)
	hasActivity := reportPayloadHasActivity(payload)
	status := deriveSiteReportConnectionStatus(site.ID, firstNonEmpty(site.SiteURL, site.AdminURL), connection, snapshot, hasActivity, periodKey)

	return siteReportView{
		Connection: status,
		Snapshot:   snapshot,
		Highlight:  buildSiteReportHighlight(status, payload, periodKey),
	}, nil
}

func deriveSiteReportConnectionStatus(siteID uuid.UUID, defaultSiteURL string, connection *store.SiteReportConnection, snapshot *store.SiteReportSnapshot, hasActivity bool, requestedPeriodKey string) siteReportConnectionStatus {
	periodLabel := humanizeReportPeriodKey(requestedPeriodKey)
	status := siteReportConnectionStatus{
		SiteID:               siteID,
		State:                "not_connected",
		StateLabel:           "Belum Terhubung",
		StateMessage:         "Plugin laporan tenant belum melakukan registrasi ke Moodlepilot.",
		SiteURLSnapshot:      defaultSiteURL,
		Capabilities:         []string{},
		TrackingState:        "not_connected",
		TrackingStateLabel:   "Belum Terhubung",
		TrackingStateMessage: "Tracking browser belum tersedia karena plugin laporan belum terhubung.",
		HasSnapshot:          snapshot != nil,
		HasActivity:          hasActivity,
	}

	if snapshot != nil {
		status.SnapshotKey = snapshot.SnapshotKey
		status.PeriodKey = snapshot.PeriodKey
		status.LastSyncAt = newTimeValue(snapshot.ReceivedAt.Format(timeRFC3339UTC))
	}

	if connection == nil {
		return status
	}

	status.SiteURLSnapshot = firstNonEmpty(connection.SiteURLSnapshot, defaultSiteURL)
	status.PluginVersion = connection.PluginVersion
	status.MoodleVersion = connection.MoodleVersion
	status.Capabilities = append([]string(nil), connection.Capabilities...)
	status.TrackingMode = connection.TrackingMode
	status.TrackingLastSeenAt = newTimeValue(timeToRFC3339(connection.TrackingLastSeenAt))
	status.LastError = connection.LastError
	status.RegisteredAt = newTimeValue(connection.RegisteredAt.Format(timeRFC3339UTC))
	status.LastSeenAt = newTimeValue(connection.LastSeenAt.Format(timeRFC3339UTC))

	now := time.Now().UTC()
	switch {
	case connection.TrackingMode == "":
		status.TrackingState = "disabled"
		status.TrackingStateLabel = "Belum Aktif"
		status.TrackingStateMessage = "Plugin belum mengirim metadata tracking browser."
	case connection.TrackingLastSeenAt == nil:
		status.TrackingState = "waiting"
		status.TrackingStateLabel = "Menunggu Tracking"
		status.TrackingStateMessage = "Tracking browser sudah didukung plugin, tetapi heartbeat pertama belum diterima."
	case now.Sub(connection.TrackingLastSeenAt.UTC()) <= reportTrackingFreshThreshold:
		status.TrackingState = "active"
		status.TrackingStateLabel = "Tracking Aktif"
		status.TrackingStateMessage = "Heartbeat browser terbaru masih segar dan tracking tenant terlihat aktif."
	default:
		status.TrackingState = "stale"
		status.TrackingStateLabel = "Tracking Stale"
		status.TrackingStateMessage = "Heartbeat browser tenant sudah lama tidak diterima. Periksa aktivitas pengguna atau cron tenant."
	}

	switch {
	case connection.LastError != "":
		status.State = "sync_error"
		status.StateLabel = "Sinkronisasi Bermasalah"
		status.StateMessage = connection.LastError
	case snapshot == nil:
		status.State = "connected_waiting_sync"
		status.StateLabel = "Menunggu Sinkronisasi"
		status.StateMessage = fmt.Sprintf("Plugin sudah terhubung, tetapi snapshot %s belum diterima.", periodLabel)
	case !hasActivity:
		status.State = "synced_no_activity"
		status.StateLabel = "Tersinkron"
		status.StateMessage = fmt.Sprintf("Snapshot %s diterima, tetapi belum ada aktivitas terukur pada periode ini.", periodLabel)
	case connection.TrackingMode != "" && connection.TrackingLastSeenAt != nil && now.Sub(connection.TrackingLastSeenAt.UTC()) <= reportTrackingFreshThreshold:
		status.State = "tracking_active"
		status.StateLabel = "Tracking Aktif"
		status.StateMessage = "Plugin terhubung, snapshot terbaru diterima, dan heartbeat browser tenant masih segar."
	case connection.TrackingMode != "" && (connection.TrackingLastSeenAt == nil || now.Sub(connection.TrackingLastSeenAt.UTC()) > reportTrackingFreshThreshold):
		status.State = "tracking_stale"
		status.StateLabel = "Tracking Stale"
		status.StateMessage = "Snapshot terbaru tersedia, tetapi heartbeat browser tenant sudah tidak segar."
	default:
		status.State = "synced"
		status.StateLabel = "Tersinkron"
		status.StateMessage = "Plugin terhubung dan snapshot terbaru sudah diterima."
	}

	return status
}

func buildSiteReportHighlight(status siteReportConnectionStatus, payload siteReportPayloadPreview, requestedPeriodKey string) siteReportHighlight {
	periodLabel := humanizeReportPeriodKey(requestedPeriodKey)
	switch status.State {
	case "not_connected":
		return siteReportHighlight{
			Title:   "Plugin laporan belum terhubung",
			Message: "Tenant ini belum menyelesaikan registrasi plugin laporan ke Moodlepilot.",
			Tone:    "warning",
		}
	case "connected_waiting_sync":
		return siteReportHighlight{
			Title:   "Menunggu snapshot pertama",
			Message: fmt.Sprintf("Plugin sudah terhubung, tetapi ringkasan %s belum diterima oleh Moodlepilot.", periodLabel),
			Tone:    "info",
		}
	case "sync_error":
		return siteReportHighlight{
			Title:   "Perlu perhatian",
			Message: firstNonEmpty(status.LastError, "Sinkronisasi laporan terakhir mengalami kendala."),
			Tone:    "danger",
		}
	case "tracking_stale":
		return siteReportHighlight{
			Title:   "Tracking perlu dicek",
			Message: firstNonEmpty(status.TrackingStateMessage, "Heartbeat browser tenant sudah tidak segar."),
			Tone:    "warning",
		}
	case "synced_no_activity":
		return siteReportHighlight{
			Title:   "Belum ada aktivitas",
			Message: fmt.Sprintf("Sinkronisasi berhasil, tetapi belum ada aktivitas yang tercatat pada periode %s.", periodLabel),
			Tone:    "info",
		}
	}

	if len(payload.ActivityStatsSummary) > 0 {
		top := payload.ActivityStatsSummary[0]
		for _, candidate := range payload.ActivityStatsSummary {
			if firstNonEmpty(candidate.CourseName, "") != "" {
				top = candidate
				break
			}
		}
		return siteReportHighlight{
			Title:   "Aktivitas tertinggi",
			Message: fmt.Sprintf("%s mencatat %d event dari %d pengguna di %s.", firstNonEmpty(top.ActivityLabel, "Aktivitas"), top.TotalEvents, top.UniqueUsers, firstNonEmpty(top.CourseName, "kursus tanpa nama")),
			Tone:    "success",
		}
	}
	if len(payload.CourseCompletionSummary) > 0 {
		top := payload.CourseCompletionSummary[0]
		return siteReportHighlight{
			Title:   "Progres kursus teratas",
			Message: fmt.Sprintf("%s mencapai %d%% completion dari %d peserta.", firstNonEmpty(top.CourseName, "Kursus"), top.CompletionRate, top.Enrolled),
			Tone:    "success",
		}
	}

	return siteReportHighlight{
		Title:   "Ringkasan periode aktif",
		Message: fmt.Sprintf("%d login, %d pengguna aktif, dan %d submission tercatat pada periode ini.", payload.SummaryMetrics.LoginCount, payload.SummaryMetrics.ActiveUsers, payload.SummaryMetrics.Submissions),
		Tone:    "success",
	}
}

func humanizeReportPeriodKey(value string) string {
	switch normalizeReportPeriodKey(value) {
	case "last_30_days":
		return "30 hari terakhir"
	case "this_month":
		return "bulan ini"
	case "last_month":
		return "bulan lalu"
	default:
		return "7 hari terakhir"
	}
}

func decodeReportPayload(snapshot *store.SiteReportSnapshot) siteReportPayloadPreview {
	var payload siteReportPayloadPreview
	if snapshot == nil || len(snapshot.Payload) == 0 {
		return payload
	}
	_ = json.Unmarshal(snapshot.Payload, &payload)
	return payload
}

func reportPayloadHasActivity(payload siteReportPayloadPreview) bool {
	if payload.SummaryMetrics.LoginCount > 0 || payload.SummaryMetrics.ActiveUsers > 0 || payload.SummaryMetrics.Submissions > 0 {
		return true
	}
	return len(payload.RecentActivity) > 0 ||
		len(payload.CourseCompletionSummary) > 0 ||
		len(payload.GradeRecapPerCourse) > 0 ||
		len(payload.UserActivitySummary) > 0 ||
		len(payload.UserStatus) > 0 ||
		len(payload.ActivityStatsSummary) > 0 ||
		len(payload.QuizActivityDetail) > 0
}

func timeToRFC3339(value *time.Time) string {
	if value == nil {
		return ""
	}
	return value.UTC().Format(timeRFC3339UTC)
}
