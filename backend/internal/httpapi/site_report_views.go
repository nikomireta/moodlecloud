package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"
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
	Snapshot   *siteReportSummarySnapshot `json:"snapshot,omitempty"`
	Highlight  siteReportHighlight        `json:"highlight"`
}

type siteReportFullResponse struct {
	Connection siteReportConnectionStatus `json:"connection"`
	Snapshot   *siteReportFullSnapshot    `json:"snapshot,omitempty"`
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

type siteReportSummarySnapshot struct {
	ID            uuid.UUID                `json:"id"`
	SiteID        uuid.UUID                `json:"site_id"`
	SnapshotKey   string                   `json:"snapshot_key"`
	PeriodKey     string                   `json:"period_key"`
	PeriodStart   time.Time                `json:"period_start"`
	PeriodEnd     time.Time                `json:"period_end"`
	Payload       siteReportSummaryPayload `json:"payload"`
	PluginVersion string                   `json:"plugin_version"`
	MoodleVersion string                   `json:"moodle_version"`
	GeneratedAt   time.Time                `json:"generated_at"`
	ReceivedAt    time.Time                `json:"received_at"`
	CreatedAt     time.Time                `json:"created_at"`
	UpdatedAt     time.Time                `json:"updated_at"`
}

type siteReportFullSnapshot struct {
	ID            uuid.UUID             `json:"id"`
	SiteID        uuid.UUID             `json:"site_id"`
	SnapshotKey   string                `json:"snapshot_key"`
	PeriodKey     string                `json:"period_key"`
	PeriodStart   time.Time             `json:"period_start"`
	PeriodEnd     time.Time             `json:"period_end"`
	Payload       siteReportFullPayload `json:"payload"`
	PluginVersion string                `json:"plugin_version"`
	MoodleVersion string                `json:"moodle_version"`
	GeneratedAt   time.Time             `json:"generated_at"`
	ReceivedAt    time.Time             `json:"received_at"`
	CreatedAt     time.Time             `json:"created_at"`
	UpdatedAt     time.Time             `json:"updated_at"`
}

type siteReportSummaryMetrics struct {
	LoginCount       int    `json:"login_count"`
	ActiveUsers      int    `json:"active_users"`
	Submissions      int    `json:"submissions"`
	Completions      int    `json:"completions"`
	SessionCount     int    `json:"session_count"`
	AvgOnlineSeconds int    `json:"avg_online_seconds"`
	AvgOnlineLabel   string `json:"avg_online_label"`
}

type siteReportDailyTrendItem struct {
	DayBucket          int    `json:"day_bucket"`
	DayLabel           string `json:"day_label"`
	LoginCount         int    `json:"login_count"`
	ActiveUsers        int    `json:"active_users"`
	SubmissionCount    int    `json:"submission_count"`
	CompletionCount    int    `json:"completion_count"`
	SessionTimeSeconds int    `json:"session_time_seconds"`
	SessionTimeLabel   string `json:"session_time_label"`
}

type siteReportRecentActivityItem struct {
	UserName   string `json:"user_name"`
	Action     string `json:"action"`
	OccurredAt string `json:"occurred_at"`
	IPAddress  string `json:"ip_address"`
}

type siteReportCourseCompletionItem struct {
	CourseID       int    `json:"course_id"`
	CourseName     string `json:"course_name"`
	Enrolled       int    `json:"enrolled"`
	Completed      int    `json:"completed"`
	InProgress     int    `json:"in_progress"`
	NotStarted     int    `json:"not_started"`
	CompletionRate int    `json:"completion_rate"`
}

type siteReportAssignmentSubmissionItem struct {
	AssignmentID   int      `json:"assignment_id"`
	ActivityID     int      `json:"activity_id"`
	GradeItemID    int      `json:"grade_item_id"`
	CourseID       int      `json:"course_id"`
	CourseName     string   `json:"course_name"`
	AssignmentName string   `json:"assignment_name"`
	UserID         int      `json:"user_id"`
	UserName       string   `json:"user_name"`
	Email          string   `json:"email"`
	DueAt          string   `json:"due_at"`
	SubmittedAt    string   `json:"submitted_at"`
	StatusKey      string   `json:"status_key"`
	StatusLabel    string   `json:"status_label"`
	Grade          *float64 `json:"grade"`
	GradedAt       string   `json:"graded_at"`
	MissingGrade   bool     `json:"missing_grade"`
	LateBySeconds  int      `json:"late_by_seconds"`
	LateByLabel    string   `json:"late_by_label"`
}

type siteReportForumEngagementItem struct {
	ForumID            int    `json:"forum_id"`
	ActivityID         int    `json:"activity_id"`
	CourseID           int    `json:"course_id"`
	CourseName         string `json:"course_name"`
	ForumName          string `json:"forum_name"`
	DiscussionCount    int    `json:"discussion_count"`
	PostCount          int    `json:"post_count"`
	ActiveParticipants int    `json:"active_participants"`
	LatestPostAt       string `json:"latest_post_at"`
}

type siteReportGradeRecapItem struct {
	CourseID          int      `json:"course_id"`
	CourseName        string   `json:"course_name"`
	AverageGrade      *float64 `json:"average_grade"`
	HighestGrade      *float64 `json:"highest_grade"`
	LowestGrade       *float64 `json:"lowest_grade"`
	GradedCount       int      `json:"graded_count"`
	MissingGradeCount int      `json:"missing_grade_count"`
	Passed            int      `json:"passed"`
	Failed            int      `json:"failed"`
}

type siteReportGradebookDetailItem struct {
	CourseID      int      `json:"course_id"`
	CourseName    string   `json:"course_name"`
	UserID        int      `json:"user_id"`
	UserName      string   `json:"user_name"`
	Email         string   `json:"email"`
	GradeItemID   int      `json:"grade_item_id"`
	GradeItemName string   `json:"grade_item_name"`
	ItemModule    string   `json:"item_module"`
	ItemInstance  int      `json:"item_instance"`
	FinalGrade    *float64 `json:"final_grade"`
	PassFail      string   `json:"pass_fail"`
	GradedAt      string   `json:"graded_at"`
	MissingGrade  bool     `json:"missing_grade"`
}

type siteReportUserActivityItem struct {
	UserID             int    `json:"user_id"`
	UserName           string `json:"user_name"`
	Email              string `json:"email"`
	RoleLabel          string `json:"role_label"`
	Sessions           int    `json:"sessions"`
	TotalOnlineSeconds int    `json:"total_online_seconds"`
	TotalOnlineLabel   string `json:"total_online_label"`
	Submissions        int    `json:"submissions"`
	LastActionAt       string `json:"last_action_at"`
}

type siteReportUserStatusItem struct {
	UserID               int      `json:"user_id"`
	UserName             string   `json:"user_name"`
	Username             string   `json:"username"`
	Email                string   `json:"email"`
	RoleLabel            string   `json:"role_label"`
	CourseID             int      `json:"course_id"`
	CourseName           string   `json:"course_name"`
	CourseShortName      string   `json:"course_short_name"`
	EnrolmentMethod      string   `json:"enrolment_method"`
	EnrolmentMethodLabel string   `json:"enrolment_method_label"`
	EnrolledOn           string   `json:"enrolled_on"`
	StatusKey            string   `json:"status_key"`
	StatusLabel          string   `json:"status_label"`
	AverageGrade         *float64 `json:"average_grade"`
	LastActionAt         string   `json:"last_action_at"`
}

type siteReportAtRiskUserItem struct {
	UserName     string   `json:"user_name"`
	Email        string   `json:"email"`
	RoleLabel    string   `json:"role_label"`
	CourseName   string   `json:"course_name"`
	StatusLabel  string   `json:"status_label"`
	AverageGrade *float64 `json:"average_grade"`
	LastActionAt string   `json:"last_action_at"`
	RiskScore    int      `json:"risk_score"`
	RiskReason   string   `json:"risk_reason"`
}

type siteReportActivityStatsItem struct {
	CourseID         int    `json:"course_id"`
	CourseName       string `json:"course_name"`
	ActivityID       int    `json:"activity_id"`
	ModuleType       string `json:"module_type"`
	ComponentName    string `json:"component_name"`
	ActivityLabel    string `json:"activity_label"`
	Visits           int    `json:"visits"`
	TimeSpentSeconds int    `json:"time_spent_seconds"`
	TimeSpentLabel   string `json:"time_spent_label"`
	FirstAccessAt    string `json:"first_access_at"`
	CreatedAt        string `json:"created_at"`
	NumCompleted     int    `json:"num_completed"`
	TotalEvents      int    `json:"total_events"`
	UniqueUsers      int    `json:"unique_users"`
	LastActivityAt   string `json:"last_activity_at"`
}

type siteReportActivityCompletionItem struct {
	CourseID             int    `json:"course_id"`
	CourseName           string `json:"course_name"`
	ActivityID           int    `json:"activity_id"`
	ActivityName         string `json:"activity_name"`
	ModuleType           string `json:"module_type"`
	ComponentName        string `json:"component_name"`
	UserID               int    `json:"user_id"`
	UserName             string `json:"user_name"`
	Email                string `json:"email"`
	CompletionState      int    `json:"completion_state"`
	CompletionStateKey   string `json:"completion_state_key"`
	CompletionStateLabel string `json:"completion_state_label"`
	CompletionAt         string `json:"completion_at"`
	LastActionAt         string `json:"last_action_at"`
}

type siteReportQuizActivityItem struct {
	QuizID           int     `json:"quiz_id"`
	QuizName         string  `json:"quiz_name"`
	CourseID         int     `json:"course_id"`
	CourseName       string  `json:"course_name"`
	UserID           int     `json:"user_id"`
	UserName         string  `json:"user_name"`
	Email            string  `json:"email"`
	Attempts         int     `json:"attempts"`
	FinishedAttempts int     `json:"finished_attempts"`
	BestScore        float64 `json:"best_score"`
	AverageScore     float64 `json:"average_score"`
	LowestScore      float64 `json:"lowest_score"`
	TimeSpentSeconds int     `json:"time_spent_seconds"`
	TimeSpentLabel   string  `json:"time_spent_label"`
	StatusLabel      string  `json:"status_label"`
	CompletionAt     string  `json:"completion_at"`
	LastAttemptAt    string  `json:"last_attempt_at"`
}

type siteReportQuizQuestionAnalysisItem struct {
	QuizID        int     `json:"quiz_id"`
	QuizName      string  `json:"quiz_name"`
	CourseID      int     `json:"course_id"`
	CourseName    string  `json:"course_name"`
	QuestionID    int     `json:"question_id"`
	QuestionName  string  `json:"question_name"`
	QuestionType  string  `json:"question_type"`
	Attempts      int     `json:"attempts"`
	CorrectRate   float64 `json:"correct_rate"`
	AverageScore  float64 `json:"average_score"`
	LastAttemptAt string  `json:"last_attempt_at"`
}

type siteReportSectionCounts struct {
	DailyTrend                 int `json:"daily_trend"`
	RecentActivity             int `json:"recent_activity"`
	CourseCompletionSummary    int `json:"course_completion_summary"`
	AssignmentSubmissionDetail int `json:"assignment_submission_detail"`
	ForumEngagementSummary     int `json:"forum_engagement_summary"`
	GradeRecapPerCourse        int `json:"grade_recap_per_course"`
	GradebookDetail            int `json:"gradebook_detail"`
	UserActivitySummary        int `json:"user_activity_summary"`
	UserStatus                 int `json:"user_status"`
	AtRiskUsers                int `json:"at_risk_users"`
	ActivityStatsSummary       int `json:"activity_stats_summary"`
	ActivityCompletionDetail   int `json:"activity_completion_detail"`
	QuizActivityDetail         int `json:"quiz_activity_detail"`
	QuizQuestionAnalysis       int `json:"quiz_question_analysis"`
}

type siteReportUserStatusDistributionItem struct {
	StatusKey   string `json:"status_key"`
	StatusLabel string `json:"status_label"`
	Total       int    `json:"total"`
}

type siteReportSummaryPayload struct {
	SummaryMetrics             siteReportSummaryMetrics               `json:"summary_metrics"`
	DailyTrend                 []siteReportDailyTrendItem             `json:"daily_trend"`
	SectionCounts              siteReportSectionCounts                `json:"section_counts"`
	UserStatusDistribution     []siteReportUserStatusDistributionItem `json:"user_status_distribution"`
	CourseCompletionSummary    []siteReportCourseCompletionItem       `json:"course_completion_summary"`
	AssignmentSubmissionDetail []siteReportAssignmentSubmissionItem   `json:"assignment_submission_detail"`
	ForumEngagementSummary     []siteReportForumEngagementItem        `json:"forum_engagement_summary"`
	AtRiskUsers                []siteReportAtRiskUserItem             `json:"at_risk_users"`
	ActivityStatsSummary       []siteReportActivityStatsItem          `json:"activity_stats_summary"`
	QuizQuestionAnalysis       []siteReportQuizQuestionAnalysisItem   `json:"quiz_question_analysis"`
}

type siteReportFullPayload struct {
	SummaryMetrics             siteReportSummaryMetrics               `json:"summary_metrics"`
	DailyTrend                 []siteReportDailyTrendItem             `json:"daily_trend"`
	SectionCounts              siteReportSectionCounts                `json:"section_counts"`
	SelectedCourseID           *int                                   `json:"selected_course_id,omitempty"`
	AvailableCourses           []siteReportDetailCourseItem           `json:"available_courses"`
	CourseFilterScopeNote      string                                 `json:"course_filter_scope_note,omitempty"`
	UserStatusDistribution     []siteReportUserStatusDistributionItem `json:"user_status_distribution"`
	CourseCompletionSummary    []siteReportCourseCompletionItem       `json:"course_completion_summary"`
	GradeRecapPerCourse        []siteReportGradeRecapItem             `json:"grade_recap_per_course"`
	AtRiskUsers                []siteReportAtRiskUserItem             `json:"at_risk_users"`
	AssignmentSubmissionDetail []siteReportAssignmentSubmissionItem   `json:"assignment_submission_detail"`
	ForumEngagementSummary     []siteReportForumEngagementItem        `json:"forum_engagement_summary"`
	ActivityStatsSummary       []siteReportActivityStatsItem          `json:"activity_stats_summary"`
	QuizActivityDetail         []siteReportQuizActivityItem           `json:"quiz_activity_detail"`
	QuizQuestionAnalysis       []siteReportQuizQuestionAnalysisItem   `json:"quiz_question_analysis"`
}

type siteReportSnapshotPayload struct {
	SummaryMetrics             siteReportSummaryMetrics             `json:"summary_metrics"`
	DailyTrend                 []siteReportDailyTrendItem           `json:"daily_trend"`
	RecentActivity             []siteReportRecentActivityItem       `json:"recent_activity"`
	CourseCompletionSummary    []siteReportCourseCompletionItem     `json:"course_completion_summary"`
	AssignmentSubmissionDetail []siteReportAssignmentSubmissionItem `json:"assignment_submission_detail"`
	ForumEngagementSummary     []siteReportForumEngagementItem      `json:"forum_engagement_summary"`
	GradeRecapPerCourse        []siteReportGradeRecapItem           `json:"grade_recap_per_course"`
	GradebookDetail            []siteReportGradebookDetailItem      `json:"gradebook_detail"`
	UserActivitySummary        []siteReportUserActivityItem         `json:"user_activity_summary"`
	UserStatus                 []siteReportUserStatusItem           `json:"user_status"`
	AtRiskUsers                []siteReportAtRiskUserItem           `json:"at_risk_users"`
	ActivityStatsSummary       []siteReportActivityStatsItem        `json:"activity_stats_summary"`
	ActivityCompletionDetail   []siteReportActivityCompletionItem   `json:"activity_completion_detail"`
	QuizActivityDetail         []siteReportQuizActivityItem         `json:"quiz_activity_detail"`
	QuizQuestionAnalysis       []siteReportQuizQuestionAnalysisItem `json:"quiz_question_analysis"`
}

type timeValue struct {
	value string
}

const (
	reportTrackingFreshThreshold = 45 * time.Minute
	reportPreviewListLimit       = 5
)

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
		Snapshot:   buildSiteReportSummarySnapshot(view.Snapshot, view.Payload),
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

	courseID, err := parseOptionalPositiveInt(r.URL.Query().Get("course_id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Course ID tidak valid")
		return
	}

	availableCourses := buildSiteReportAvailableCourses(view.Payload)
	selectedCourseID := normalizeSelectedReportCourseID(courseID, availableCourses)
	filteredPayload := filterSiteReportOverviewPayload(view.Payload, selectedCourseID, lookupReportCourseName(availableCourses, selectedCourseID))

	writeJSON(w, http.StatusOK, siteReportFullResponse{
		Connection: view.Connection,
		Snapshot:   buildSiteReportFullSnapshot(view.Snapshot, filteredPayload, selectedCourseID, availableCourses),
		Highlight:  view.Highlight,
	})
}

type siteReportView struct {
	Connection siteReportConnectionStatus
	Snapshot   *store.SiteReportSnapshot
	Payload    siteReportSnapshotPayload
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

	payload := decodeReportSnapshotPayload(snapshot)
	hasActivity := reportPayloadHasActivity(payload)
	status := deriveSiteReportConnectionStatus(site.ID, firstNonEmpty(site.SiteURL, site.AdminURL), connection, snapshot, hasActivity, periodKey)

	return siteReportView{
		Connection: status,
		Snapshot:   snapshot,
		Payload:    payload,
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
		status.TrackingStateLabel = "Belum aktif"
		status.TrackingStateMessage = "Plugin belum mengirim metadata pelacakan browser."
	case connection.TrackingLastSeenAt == nil:
		status.TrackingState = "waiting"
		status.TrackingStateLabel = "Menunggu heartbeat"
		status.TrackingStateMessage = "Pelacakan browser sudah didukung plugin, tetapi heartbeat pertama belum diterima."
	case now.Sub(connection.TrackingLastSeenAt.UTC()) <= reportTrackingFreshThreshold:
		status.TrackingState = "active"
		status.TrackingStateLabel = "Aktif"
		status.TrackingStateMessage = "Heartbeat browser terbaru masih segar dan pelacakan tenant terlihat aktif."
	default:
		status.TrackingState = "stale"
		status.TrackingStateLabel = "Perlu dicek"
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

func buildSiteReportHighlight(status siteReportConnectionStatus, payload siteReportSnapshotPayload, requestedPeriodKey string) siteReportHighlight {
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

	if len(payload.AtRiskUsers) > 0 {
		top := payload.AtRiskUsers[0]
		return siteReportHighlight{
			Title:   "Peserta berisiko perlu ditinjau",
			Message: fmt.Sprintf("%d peserta terdeteksi berisiko. Risiko tertinggi: %s di %s (%s).", len(payload.AtRiskUsers), firstNonEmpty(top.UserName, "Peserta"), firstNonEmpty(top.CourseName, "kursus tanpa nama"), firstNonEmpty(top.RiskReason, "perlu perhatian")),
			Tone:    "warning",
		}
	}

	if len(payload.AssignmentSubmissionDetail) > 0 {
		top := payload.AssignmentSubmissionDetail[0]
		return siteReportHighlight{
			Title:   "Tindak lanjut assignment tersedia",
			Message: fmt.Sprintf("%s untuk %s di %s berstatus %s.", firstNonEmpty(top.AssignmentName, "Assignment"), firstNonEmpty(top.UserName, "peserta"), firstNonEmpty(top.CourseName, "kursus tanpa nama"), firstNonEmpty(top.StatusLabel, "perlu ditinjau")),
			Tone:    "warning",
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

	if len(payload.ForumEngagementSummary) > 0 {
		top := payload.ForumEngagementSummary[0]
		return siteReportHighlight{
			Title:   "Forum paling aktif",
			Message: fmt.Sprintf("%s mencatat %d post dari %d peserta aktif di %s.", firstNonEmpty(top.ForumName, "Forum"), top.PostCount, top.ActiveParticipants, firstNonEmpty(top.CourseName, "kursus tanpa nama")),
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

	if trend, ok := latestNonZeroTrend(payload.DailyTrend); ok {
		return siteReportHighlight{
			Title:   "Aktivitas terbaru tenant",
			Message: fmt.Sprintf("Pada %s tercatat %d login, %d pengguna aktif, %d submission, dan %d completion.", trend.DayLabel, trend.LoginCount, trend.ActiveUsers, trend.SubmissionCount, trend.CompletionCount),
			Tone:    "success",
		}
	}

	return siteReportHighlight{
		Title:   "Ringkasan periode aktif",
		Message: fmt.Sprintf("%d login, %d pengguna aktif, %d submission, dan %d completion tercatat pada periode ini.", payload.SummaryMetrics.LoginCount, payload.SummaryMetrics.ActiveUsers, payload.SummaryMetrics.Submissions, payload.SummaryMetrics.Completions),
		Tone:    "success",
	}
}

func humanizeReportPeriodKey(value string) string {
	switch normalizeReportPeriodKey(value) {
	case "today":
		return "hari ini"
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

func decodeReportSnapshotPayload(snapshot *store.SiteReportSnapshot) siteReportSnapshotPayload {
	var payload siteReportSnapshotPayload
	if snapshot == nil || len(snapshot.Payload) == 0 {
		return payload
	}
	_ = json.Unmarshal(snapshot.Payload, &payload)
	return payload
}

func reportPayloadHasActivity(payload siteReportSnapshotPayload) bool {
	if payload.SummaryMetrics.LoginCount > 0 || payload.SummaryMetrics.ActiveUsers > 0 || payload.SummaryMetrics.Submissions > 0 || payload.SummaryMetrics.Completions > 0 || payload.SummaryMetrics.SessionCount > 0 {
		return true
	}

	for _, row := range payload.DailyTrend {
		if row.LoginCount > 0 || row.ActiveUsers > 0 || row.SubmissionCount > 0 || row.CompletionCount > 0 || row.SessionTimeSeconds > 0 {
			return true
		}
	}

	return len(payload.RecentActivity) > 0 ||
		len(payload.CourseCompletionSummary) > 0 ||
		len(payload.AssignmentSubmissionDetail) > 0 ||
		len(payload.ForumEngagementSummary) > 0 ||
		len(payload.GradeRecapPerCourse) > 0 ||
		len(payload.GradebookDetail) > 0 ||
		len(payload.UserActivitySummary) > 0 ||
		len(payload.UserStatus) > 0 ||
		len(payload.AtRiskUsers) > 0 ||
		len(payload.ActivityStatsSummary) > 0 ||
		len(payload.ActivityCompletionDetail) > 0 ||
		len(payload.QuizActivityDetail) > 0 ||
		len(payload.QuizQuestionAnalysis) > 0
}

func buildSiteReportSummarySnapshot(snapshot *store.SiteReportSnapshot, payload siteReportSnapshotPayload) *siteReportSummarySnapshot {
	if snapshot == nil {
		return nil
	}

	return &siteReportSummarySnapshot{
		ID:            snapshot.ID,
		SiteID:        snapshot.SiteID,
		SnapshotKey:   snapshot.SnapshotKey,
		PeriodKey:     snapshot.PeriodKey,
		PeriodStart:   snapshot.PeriodStart,
		PeriodEnd:     snapshot.PeriodEnd,
		Payload:       buildSiteReportSummaryPayload(payload),
		PluginVersion: snapshot.PluginVersion,
		MoodleVersion: snapshot.MoodleVersion,
		GeneratedAt:   snapshot.GeneratedAt,
		ReceivedAt:    snapshot.ReceivedAt,
		CreatedAt:     snapshot.CreatedAt,
		UpdatedAt:     snapshot.UpdatedAt,
	}
}

func buildSiteReportFullSnapshot(snapshot *store.SiteReportSnapshot, payload siteReportSnapshotPayload, selectedCourseID *int, availableCourses []siteReportDetailCourseItem) *siteReportFullSnapshot {
	if snapshot == nil {
		return nil
	}

	return &siteReportFullSnapshot{
		ID:            snapshot.ID,
		SiteID:        snapshot.SiteID,
		SnapshotKey:   snapshot.SnapshotKey,
		PeriodKey:     snapshot.PeriodKey,
		PeriodStart:   snapshot.PeriodStart,
		PeriodEnd:     snapshot.PeriodEnd,
		Payload:       buildSiteReportFullPayload(payload, selectedCourseID, availableCourses),
		PluginVersion: snapshot.PluginVersion,
		MoodleVersion: snapshot.MoodleVersion,
		GeneratedAt:   snapshot.GeneratedAt,
		ReceivedAt:    snapshot.ReceivedAt,
		CreatedAt:     snapshot.CreatedAt,
		UpdatedAt:     snapshot.UpdatedAt,
	}
}

func buildSiteReportSummaryPayload(payload siteReportSnapshotPayload) siteReportSummaryPayload {
	return siteReportSummaryPayload{
		SummaryMetrics:             payload.SummaryMetrics,
		DailyTrend:                 takeFirst(payload.DailyTrend, 30),
		SectionCounts:              buildSiteReportSectionCounts(payload),
		UserStatusDistribution:     buildSiteReportUserStatusDistribution(payload.UserStatus),
		CourseCompletionSummary:    takeFirst(payload.CourseCompletionSummary, reportPreviewListLimit),
		AssignmentSubmissionDetail: takeFirst(payload.AssignmentSubmissionDetail, reportPreviewListLimit),
		ForumEngagementSummary:     takeFirst(payload.ForumEngagementSummary, reportPreviewListLimit),
		AtRiskUsers:                takeFirst(payload.AtRiskUsers, reportPreviewListLimit),
		ActivityStatsSummary:       takeFirst(payload.ActivityStatsSummary, reportPreviewListLimit),
		QuizQuestionAnalysis:       takeFirst(payload.QuizQuestionAnalysis, reportPreviewListLimit),
	}
}

func buildSiteReportFullPayload(payload siteReportSnapshotPayload, selectedCourseID *int, availableCourses []siteReportDetailCourseItem) siteReportFullPayload {
	scopeNote := ""
	if selectedCourseID != nil {
		scopeNote = "Filter kursus diterapkan pada preview section dan detail operasional. KPI utama, tren harian, dan beberapa data lintas-kursus tetap ditampilkan pada level tenant."
	}

	return siteReportFullPayload{
		SummaryMetrics:             payload.SummaryMetrics,
		DailyTrend:                 takeFirst(payload.DailyTrend, 30),
		SectionCounts:              buildSiteReportSectionCounts(payload),
		SelectedCourseID:           selectedCourseID,
		AvailableCourses:           append([]siteReportDetailCourseItem(nil), availableCourses...),
		CourseFilterScopeNote:      scopeNote,
		UserStatusDistribution:     buildSiteReportUserStatusDistribution(payload.UserStatus),
		CourseCompletionSummary:    takeFirst(payload.CourseCompletionSummary, reportPreviewListLimit),
		GradeRecapPerCourse:        takeFirst(payload.GradeRecapPerCourse, reportPreviewListLimit),
		AtRiskUsers:                takeFirst(payload.AtRiskUsers, reportPreviewListLimit),
		AssignmentSubmissionDetail: takeFirst(payload.AssignmentSubmissionDetail, reportPreviewListLimit),
		ForumEngagementSummary:     takeFirst(payload.ForumEngagementSummary, reportPreviewListLimit),
		ActivityStatsSummary:       takeFirst(payload.ActivityStatsSummary, reportPreviewListLimit),
		QuizActivityDetail:         takeFirst(payload.QuizActivityDetail, reportPreviewListLimit),
		QuizQuestionAnalysis:       takeFirst(payload.QuizQuestionAnalysis, reportPreviewListLimit),
	}
}

func buildSiteReportAvailableCourses(payload siteReportSnapshotPayload) []siteReportDetailCourseItem {
	items := map[int]string{}

	appendCourse := func(courseID int, courseName string) {
		if courseID <= 0 {
			return
		}
		trimmed := firstNonEmpty(courseName, fmt.Sprintf("Course %d", courseID))
		if _, exists := items[courseID]; !exists {
			items[courseID] = trimmed
		}
	}

	for _, row := range payload.CourseCompletionSummary {
		appendCourse(row.CourseID, row.CourseName)
	}
	for _, row := range payload.AssignmentSubmissionDetail {
		appendCourse(row.CourseID, row.CourseName)
	}
	for _, row := range payload.ForumEngagementSummary {
		appendCourse(row.CourseID, row.CourseName)
	}
	for _, row := range payload.GradeRecapPerCourse {
		appendCourse(row.CourseID, row.CourseName)
	}
	for _, row := range payload.GradebookDetail {
		appendCourse(row.CourseID, row.CourseName)
	}
	for _, row := range payload.UserStatus {
		appendCourse(row.CourseID, row.CourseName)
	}
	for _, row := range payload.ActivityStatsSummary {
		appendCourse(row.CourseID, row.CourseName)
	}
	for _, row := range payload.ActivityCompletionDetail {
		appendCourse(row.CourseID, row.CourseName)
	}
	for _, row := range payload.QuizActivityDetail {
		appendCourse(row.CourseID, row.CourseName)
	}
	for _, row := range payload.QuizQuestionAnalysis {
		appendCourse(row.CourseID, row.CourseName)
	}

	courses := make([]siteReportDetailCourseItem, 0, len(items))
	for courseID, courseName := range items {
		courses = append(courses, siteReportDetailCourseItem{
			CourseID:   courseID,
			CourseName: courseName,
		})
	}

	sort.SliceStable(courses, func(i, j int) bool {
		return courses[i].CourseName < courses[j].CourseName
	})

	return courses
}

func normalizeSelectedReportCourseID(courseID *int, availableCourses []siteReportDetailCourseItem) *int {
	if courseID == nil {
		return nil
	}

	for _, course := range availableCourses {
		if course.CourseID == *courseID {
			selected := course.CourseID
			return &selected
		}
	}

	return nil
}

func lookupReportCourseName(availableCourses []siteReportDetailCourseItem, selectedCourseID *int) string {
	if selectedCourseID == nil {
		return ""
	}

	for _, course := range availableCourses {
		if course.CourseID == *selectedCourseID {
			return course.CourseName
		}
	}

	return ""
}

func filterRowsByCourseName[T any](items []T, courseName string, courseNameFn func(T) string) []T {
	if courseName == "" {
		return append([]T(nil), items...)
	}

	filtered := make([]T, 0, len(items))
	for _, item := range items {
		if strings.TrimSpace(courseNameFn(item)) == courseName {
			filtered = append(filtered, item)
		}
	}

	return filtered
}

func filterSiteReportOverviewPayload(payload siteReportSnapshotPayload, selectedCourseID *int, selectedCourseName string) siteReportSnapshotPayload {
	if selectedCourseID == nil {
		return payload
	}

	filtered := payload
	filtered.CourseCompletionSummary = filterRowsByCourse(payload.CourseCompletionSummary, selectedCourseID, func(item siteReportCourseCompletionItem) int { return item.CourseID })
	filtered.AssignmentSubmissionDetail = filterRowsByCourse(payload.AssignmentSubmissionDetail, selectedCourseID, func(item siteReportAssignmentSubmissionItem) int { return item.CourseID })
	filtered.ForumEngagementSummary = filterRowsByCourse(payload.ForumEngagementSummary, selectedCourseID, func(item siteReportForumEngagementItem) int { return item.CourseID })
	filtered.GradeRecapPerCourse = filterRowsByCourse(payload.GradeRecapPerCourse, selectedCourseID, func(item siteReportGradeRecapItem) int { return item.CourseID })
	filtered.GradebookDetail = filterRowsByCourse(payload.GradebookDetail, selectedCourseID, func(item siteReportGradebookDetailItem) int { return item.CourseID })
	filtered.UserStatus = filterRowsByCourse(payload.UserStatus, selectedCourseID, func(item siteReportUserStatusItem) int { return item.CourseID })
	filtered.AtRiskUsers = filterRowsByCourseName(payload.AtRiskUsers, selectedCourseName, func(item siteReportAtRiskUserItem) string { return item.CourseName })
	filtered.ActivityStatsSummary = filterRowsByCourse(payload.ActivityStatsSummary, selectedCourseID, func(item siteReportActivityStatsItem) int { return item.CourseID })
	filtered.ActivityCompletionDetail = filterRowsByCourse(payload.ActivityCompletionDetail, selectedCourseID, func(item siteReportActivityCompletionItem) int { return item.CourseID })
	filtered.QuizActivityDetail = filterRowsByCourse(payload.QuizActivityDetail, selectedCourseID, func(item siteReportQuizActivityItem) int { return item.CourseID })
	filtered.QuizQuestionAnalysis = filterRowsByCourse(payload.QuizQuestionAnalysis, selectedCourseID, func(item siteReportQuizQuestionAnalysisItem) int { return item.CourseID })

	return filtered
}

func buildSiteReportSectionCounts(payload siteReportSnapshotPayload) siteReportSectionCounts {
	return siteReportSectionCounts{
		DailyTrend:                 len(payload.DailyTrend),
		RecentActivity:             len(payload.RecentActivity),
		CourseCompletionSummary:    len(payload.CourseCompletionSummary),
		AssignmentSubmissionDetail: len(payload.AssignmentSubmissionDetail),
		ForumEngagementSummary:     len(payload.ForumEngagementSummary),
		GradeRecapPerCourse:        len(payload.GradeRecapPerCourse),
		GradebookDetail:            len(payload.GradebookDetail),
		UserActivitySummary:        len(payload.UserActivitySummary),
		UserStatus:                 len(payload.UserStatus),
		AtRiskUsers:                len(payload.AtRiskUsers),
		ActivityStatsSummary:       len(payload.ActivityStatsSummary),
		ActivityCompletionDetail:   len(payload.ActivityCompletionDetail),
		QuizActivityDetail:         len(payload.QuizActivityDetail),
		QuizQuestionAnalysis:       len(payload.QuizQuestionAnalysis),
	}
}

func buildSiteReportUserStatusDistribution(rows []siteReportUserStatusItem) []siteReportUserStatusDistributionItem {
	if len(rows) == 0 {
		return []siteReportUserStatusDistributionItem{}
	}

	grouped := make(map[string]siteReportUserStatusDistributionItem)
	order := []string{"completed", "in_progress", "not_started"}
	labels := map[string]string{
		"completed":   "Selesai",
		"in_progress": "Sedang Berjalan",
		"not_started": "Belum Mulai",
	}

	for _, row := range rows {
		statusKey := firstNonEmpty(row.StatusKey, "not_started")
		current := grouped[statusKey]
		current.StatusKey = statusKey
		current.StatusLabel = firstNonEmpty(current.StatusLabel, firstNonEmpty(row.StatusLabel, labels[statusKey], "Lainnya"))
		current.Total++
		grouped[statusKey] = current
	}

	items := make([]siteReportUserStatusDistributionItem, 0, len(grouped))
	for _, item := range grouped {
		items = append(items, item)
	}

	sortIndex := make(map[string]int, len(order))
	for index, key := range order {
		sortIndex[key] = index
	}

	sort.SliceStable(items, func(i, j int) bool {
		leftIndex, leftOK := sortIndex[items[i].StatusKey]
		rightIndex, rightOK := sortIndex[items[j].StatusKey]

		switch {
		case leftOK && rightOK && leftIndex != rightIndex:
			return leftIndex < rightIndex
		case leftOK != rightOK:
			return leftOK
		case items[i].Total != items[j].Total:
			return items[i].Total > items[j].Total
		default:
			return items[i].StatusLabel < items[j].StatusLabel
		}
	})

	return items
}

func latestNonZeroTrend(items []siteReportDailyTrendItem) (siteReportDailyTrendItem, bool) {
	for index := len(items) - 1; index >= 0; index-- {
		current := items[index]
		if current.LoginCount > 0 || current.ActiveUsers > 0 || current.SubmissionCount > 0 || current.CompletionCount > 0 || current.SessionTimeSeconds > 0 {
			return current, true
		}
	}
	return siteReportDailyTrendItem{}, false
}

func takeFirst[T any](items []T, limit int) []T {
	if len(items) == 0 {
		return []T{}
	}
	if limit <= 0 || len(items) <= limit {
		return append([]T(nil), items...)
	}
	return append([]T(nil), items[:limit]...)
}

func timeToRFC3339(value *time.Time) string {
	if value == nil {
		return ""
	}
	return value.UTC().Format(timeRFC3339UTC)
}
