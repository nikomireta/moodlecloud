package httpapi

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"moodlepilot/backend/internal/store"
)

const reportDetailPageSize = 25

type siteReportDetailResponse struct {
	Connection siteReportConnectionStatus `json:"connection"`
	Snapshot   *siteReportDetailSnapshot  `json:"snapshot,omitempty"`
	Highlight  siteReportHighlight        `json:"highlight"`
}

type siteReportDetailSnapshot struct {
	ID            uuid.UUID               `json:"id"`
	SiteID        uuid.UUID               `json:"site_id"`
	SnapshotKey   string                  `json:"snapshot_key"`
	PeriodKey     string                  `json:"period_key"`
	PeriodStart   timeRangeValue          `json:"period_start"`
	PeriodEnd     timeRangeValue          `json:"period_end"`
	Payload       siteReportDetailPayload `json:"payload"`
	PluginVersion string                  `json:"plugin_version"`
	MoodleVersion string                  `json:"moodle_version"`
	GeneratedAt   timeRangeValue          `json:"generated_at"`
	ReceivedAt    timeRangeValue          `json:"received_at"`
	CreatedAt     timeRangeValue          `json:"created_at"`
	UpdatedAt     timeRangeValue          `json:"updated_at"`
}

type timeRangeValue string

type siteReportDetailPayload struct {
	Section            string                       `json:"section"`
	SectionTitle       string                       `json:"section_title"`
	SectionDescription string                       `json:"section_description"`
	Page               int                          `json:"page"`
	PageSize           int                          `json:"page_size"`
	TotalCount         int                          `json:"total_count"`
	TotalPages         int                          `json:"total_pages"`
	SelectedCourseID   *int                         `json:"selected_course_id,omitempty"`
	AvailableCourses   []siteReportDetailCourseItem `json:"available_courses"`
	Rows               any                          `json:"rows"`
}

type siteReportDetailCourseItem struct {
	CourseID   int    `json:"course_id"`
	CourseName string `json:"course_name"`
}

type siteReportDetailMetadata struct {
	Title            string
	Description      string
	SelectedCourseID *int
	AvailableCourses []siteReportDetailCourseItem
	TotalCount       int
	TotalPages       int
	Rows             any
	AllRows          any
}

func (t timeRangeValue) MarshalJSON() ([]byte, error) {
	return []byte(strconv.Quote(string(t))), nil
}

func (s *Server) handleGetSiteReportDetail(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	siteID, err := uuid.Parse(chi.URLParam(r, "siteID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Site ID tidak valid")
		return
	}

	section := normalizeSiteReportDetailSection(r.URL.Query().Get("section"))
	if section == "" {
		writeError(w, http.StatusBadRequest, "Section laporan tidak valid")
		return
	}

	page := normalizeDetailPage(r.URL.Query().Get("page"))
	courseID, err := parseOptionalPositiveInt(r.URL.Query().Get("course_id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Course ID tidak valid")
		return
	}

	exportFormat := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("export")))
	if exportFormat != "" && exportFormat != "csv" {
		writeError(w, http.StatusBadRequest, "Format export tidak didukung")
		return
	}

	view, err := s.buildSiteReportView(r, user.ID, siteID)
	if err != nil {
		if err == store.ErrNotFound {
			writeError(w, http.StatusNotFound, "Situs tidak ditemukan")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if exportFormat == "csv" {
		if view.Snapshot == nil {
			writeError(w, http.StatusNotFound, "Snapshot laporan belum tersedia")
			return
		}
		metadata, buildErr := buildSiteReportDetailMetadata(view.Payload, section, 1, courseID)
		if buildErr != nil {
			writeError(w, http.StatusBadRequest, buildErr.Error())
			return
		}
		if err := writeSiteReportDetailCSV(w, view.Snapshot, section, metadata); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	snapshot, err := buildSiteReportDetailSnapshot(view.Snapshot, view.Payload, section, page, courseID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, siteReportDetailResponse{
		Connection: view.Connection,
		Snapshot:   snapshot,
		Highlight:  view.Highlight,
	})
}

func buildSiteReportDetailSnapshot(snapshot *store.SiteReportSnapshot, payload siteReportSnapshotPayload, section string, page int, courseID *int) (*siteReportDetailSnapshot, error) {
	if snapshot == nil {
		return nil, nil
	}

	metadata, err := buildSiteReportDetailMetadata(payload, section, page, courseID)
	if err != nil {
		return nil, err
	}

	return &siteReportDetailSnapshot{
		ID:          snapshot.ID,
		SiteID:      snapshot.SiteID,
		SnapshotKey: snapshot.SnapshotKey,
		PeriodKey:   snapshot.PeriodKey,
		PeriodStart: timeRangeValue(snapshot.PeriodStart.Format(timeRFC3339UTC)),
		PeriodEnd:   timeRangeValue(snapshot.PeriodEnd.Format(timeRFC3339UTC)),
		Payload: siteReportDetailPayload{
			Section:            section,
			SectionTitle:       metadata.Title,
			SectionDescription: metadata.Description,
			Page:               page,
			PageSize:           reportDetailPageSize,
			TotalCount:         metadata.TotalCount,
			TotalPages:         metadata.TotalPages,
			SelectedCourseID:   metadata.SelectedCourseID,
			AvailableCourses:   metadata.AvailableCourses,
			Rows:               metadata.Rows,
		},
		PluginVersion: snapshot.PluginVersion,
		MoodleVersion: snapshot.MoodleVersion,
		GeneratedAt:   timeRangeValue(snapshot.GeneratedAt.Format(timeRFC3339UTC)),
		ReceivedAt:    timeRangeValue(snapshot.ReceivedAt.Format(timeRFC3339UTC)),
		CreatedAt:     timeRangeValue(snapshot.CreatedAt.Format(timeRFC3339UTC)),
		UpdatedAt:     timeRangeValue(snapshot.UpdatedAt.Format(timeRFC3339UTC)),
	}, nil
}

func normalizeSiteReportDetailSection(value string) string {
	switch strings.TrimSpace(strings.ToLower(value)) {
	case "at-risk-users",
		"user-activity-summary",
		"course-completion-summary",
		"assignment-submission-detail",
		"forum-engagement-summary",
		"gradebook-detail",
		"activity-completion-detail",
		"quiz-activity-detail",
		"quiz-question-analysis",
		"recent-activity",
		"grade-recap",
		"activity-stats-summary",
		"user-status":
		return strings.TrimSpace(strings.ToLower(value))
	default:
		return ""
	}
}

func normalizeDetailPage(value string) int {
	page, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil || page < 1 {
		return 1
	}
	return page
}

func parseOptionalPositiveInt(value string) (*int, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil, nil
	}
	parsed, err := strconv.Atoi(trimmed)
	if err != nil || parsed < 1 {
		return nil, fmt.Errorf("invalid")
	}
	return &parsed, nil
}

func buildSiteReportDetailMetadata(payload siteReportSnapshotPayload, section string, page int, courseID *int) (siteReportDetailMetadata, error) {
	switch section {
	case "at-risk-users":
		rows, totalCount, totalPages := paginateItems(payload.AtRiskUsers, page, reportDetailPageSize)
		return siteReportDetailMetadata{
			Title:       "At-Risk Users",
			Description: "Daftar peserta yang perlu ditindaklanjuti pada periode aktif.",
			Rows:        rows,
			AllRows:     append([]siteReportAtRiskUserItem(nil), payload.AtRiskUsers...),
			TotalCount:  totalCount,
			TotalPages:  totalPages,
		}, nil
	case "user-activity-summary":
		rows, totalCount, totalPages := paginateItems(payload.UserActivitySummary, page, reportDetailPageSize)
		return siteReportDetailMetadata{
			Title:       "User Activity Summary",
			Description: "Ringkasan aktivitas per pengguna pada periode aktif.",
			Rows:        rows,
			AllRows:     append([]siteReportUserActivityItem(nil), payload.UserActivitySummary...),
			TotalCount:  totalCount,
			TotalPages:  totalPages,
		}, nil
	case "course-completion-summary":
		filtered := filterRowsByCourse(payload.CourseCompletionSummary, courseID, func(item siteReportCourseCompletionItem) int { return item.CourseID })
		rows, totalCount, totalPages := paginateItems(filtered, page, reportDetailPageSize)
		return siteReportDetailMetadata{
			Title:            "Course Completion Summary",
			Description:      "Ringkasan progres penyelesaian per kursus.",
			SelectedCourseID: courseID,
			AvailableCourses: buildCourseOptions(payload.CourseCompletionSummary, func(item siteReportCourseCompletionItem) (int, string) { return item.CourseID, item.CourseName }),
			Rows:             rows,
			AllRows:          filtered,
			TotalCount:       totalCount,
			TotalPages:       totalPages,
		}, nil
	case "assignment-submission-detail":
		filtered := filterRowsByCourse(payload.AssignmentSubmissionDetail, courseID, func(item siteReportAssignmentSubmissionItem) int { return item.CourseID })
		rows, totalCount, totalPages := paginateItems(filtered, page, reportDetailPageSize)
		return siteReportDetailMetadata{
			Title:            "Assignment Submission Detail",
			Description:      "Status submission assignment yang memerlukan tindak lanjut.",
			SelectedCourseID: courseID,
			AvailableCourses: buildCourseOptions(payload.AssignmentSubmissionDetail, func(item siteReportAssignmentSubmissionItem) (int, string) { return item.CourseID, item.CourseName }),
			Rows:             rows,
			AllRows:          filtered,
			TotalCount:       totalCount,
			TotalPages:       totalPages,
		}, nil
	case "forum-engagement-summary":
		filtered := filterRowsByCourse(payload.ForumEngagementSummary, courseID, func(item siteReportForumEngagementItem) int { return item.CourseID })
		rows, totalCount, totalPages := paginateItems(filtered, page, reportDetailPageSize)
		return siteReportDetailMetadata{
			Title:            "Forum Engagement Summary",
			Description:      "Forum dengan percakapan paling aktif pada periode aktif.",
			SelectedCourseID: courseID,
			AvailableCourses: buildCourseOptions(payload.ForumEngagementSummary, func(item siteReportForumEngagementItem) (int, string) { return item.CourseID, item.CourseName }),
			Rows:             rows,
			AllRows:          filtered,
			TotalCount:       totalCount,
			TotalPages:       totalPages,
		}, nil
	case "gradebook-detail":
		filtered := filterRowsByCourse(payload.GradebookDetail, courseID, func(item siteReportGradebookDetailItem) int { return item.CourseID })
		rows, totalCount, totalPages := paginateItems(filtered, page, reportDetailPageSize)
		return siteReportDetailMetadata{
			Title:            "Gradebook Detail",
			Description:      "Detail nilai per peserta dan grade item.",
			SelectedCourseID: courseID,
			AvailableCourses: buildCourseOptions(payload.GradebookDetail, func(item siteReportGradebookDetailItem) (int, string) { return item.CourseID, item.CourseName }),
			Rows:             rows,
			AllRows:          filtered,
			TotalCount:       totalCount,
			TotalPages:       totalPages,
		}, nil
	case "activity-completion-detail":
		filtered := filterRowsByCourse(payload.ActivityCompletionDetail, courseID, func(item siteReportActivityCompletionItem) int { return item.CourseID })
		rows, totalCount, totalPages := paginateItems(filtered, page, reportDetailPageSize)
		return siteReportDetailMetadata{
			Title:            "Activity Completion Detail",
			Description:      "Status completion activity per peserta.",
			SelectedCourseID: courseID,
			AvailableCourses: buildCourseOptions(payload.ActivityCompletionDetail, func(item siteReportActivityCompletionItem) (int, string) { return item.CourseID, item.CourseName }),
			Rows:             rows,
			AllRows:          filtered,
			TotalCount:       totalCount,
			TotalPages:       totalPages,
		}, nil
	case "quiz-activity-detail":
		filtered := filterRowsByCourse(payload.QuizActivityDetail, courseID, func(item siteReportQuizActivityItem) int { return item.CourseID })
		rows, totalCount, totalPages := paginateItems(filtered, page, reportDetailPageSize)
		return siteReportDetailMetadata{
			Title:            "Quiz Activity Detail",
			Description:      "Ringkasan percobaan quiz per peserta.",
			SelectedCourseID: courseID,
			AvailableCourses: buildCourseOptions(payload.QuizActivityDetail, func(item siteReportQuizActivityItem) (int, string) { return item.CourseID, item.CourseName }),
			Rows:             rows,
			AllRows:          filtered,
			TotalCount:       totalCount,
			TotalPages:       totalPages,
		}, nil
	case "quiz-question-analysis":
		filtered := filterRowsByCourse(payload.QuizQuestionAnalysis, courseID, func(item siteReportQuizQuestionAnalysisItem) int { return item.CourseID })
		rows, totalCount, totalPages := paginateItems(filtered, page, reportDetailPageSize)
		return siteReportDetailMetadata{
			Title:            "Quiz Question Analysis",
			Description:      "Analisis performa per soal quiz.",
			SelectedCourseID: courseID,
			AvailableCourses: buildCourseOptions(payload.QuizQuestionAnalysis, func(item siteReportQuizQuestionAnalysisItem) (int, string) { return item.CourseID, item.CourseName }),
			Rows:             rows,
			AllRows:          filtered,
			TotalCount:       totalCount,
			TotalPages:       totalPages,
		}, nil
	case "recent-activity":
		rows, totalCount, totalPages := paginateItems(payload.RecentActivity, page, reportDetailPageSize)
		return siteReportDetailMetadata{
			Title:       "Recent Activity",
			Description: "Aktivitas terbaru yang masuk ke snapshot tenant.",
			Rows:        rows,
			AllRows:     append([]siteReportRecentActivityItem(nil), payload.RecentActivity...),
			TotalCount:  totalCount,
			TotalPages:  totalPages,
		}, nil
	case "grade-recap":
		filtered := filterRowsByCourse(payload.GradeRecapPerCourse, courseID, func(item siteReportGradeRecapItem) int { return item.CourseID })
		rows, totalCount, totalPages := paginateItems(filtered, page, reportDetailPageSize)
		return siteReportDetailMetadata{
			Title:            "Grade Recap",
			Description:      "Ringkasan nilai per kursus untuk periode aktif.",
			SelectedCourseID: courseID,
			AvailableCourses: buildCourseOptions(payload.GradeRecapPerCourse, func(item siteReportGradeRecapItem) (int, string) { return item.CourseID, item.CourseName }),
			Rows:             rows,
			AllRows:          filtered,
			TotalCount:       totalCount,
			TotalPages:       totalPages,
		}, nil
	case "activity-stats-summary":
		filtered := filterRowsByCourse(payload.ActivityStatsSummary, courseID, func(item siteReportActivityStatsItem) int { return item.CourseID })
		rows, totalCount, totalPages := paginateItems(filtered, page, reportDetailPageSize)
		return siteReportDetailMetadata{
			Title:            "Activity Stats Summary",
			Description:      "Statistik aktivitas dan hotspot penggunaan tenant.",
			SelectedCourseID: courseID,
			AvailableCourses: buildCourseOptions(payload.ActivityStatsSummary, func(item siteReportActivityStatsItem) (int, string) { return item.CourseID, item.CourseName }),
			Rows:             rows,
			AllRows:          filtered,
			TotalCount:       totalCount,
			TotalPages:       totalPages,
		}, nil
	case "user-status":
		filtered := filterRowsByCourse(payload.UserStatus, courseID, func(item siteReportUserStatusItem) int { return item.CourseID })
		rows, totalCount, totalPages := paginateItems(filtered, page, reportDetailPageSize)
		return siteReportDetailMetadata{
			Title:            "User Status",
			Description:      "Distribusi status peserta per kursus.",
			SelectedCourseID: courseID,
			AvailableCourses: buildCourseOptions(payload.UserStatus, func(item siteReportUserStatusItem) (int, string) { return item.CourseID, item.CourseName }),
			Rows:             rows,
			AllRows:          filtered,
			TotalCount:       totalCount,
			TotalPages:       totalPages,
		}, nil
	default:
		return siteReportDetailMetadata{}, fmt.Errorf("section laporan tidak valid")
	}
}

func filterRowsByCourse[T any](items []T, courseID *int, getCourseID func(T) int) []T {
	if courseID == nil {
		return append([]T(nil), items...)
	}
	filtered := make([]T, 0, len(items))
	for _, item := range items {
		if getCourseID(item) == *courseID {
			filtered = append(filtered, item)
		}
	}
	return filtered
}

func buildCourseOptions[T any](items []T, extractor func(T) (int, string)) []siteReportDetailCourseItem {
	if len(items) == 0 {
		return []siteReportDetailCourseItem{}
	}
	grouped := map[int]string{}
	for _, item := range items {
		courseID, courseName := extractor(item)
		if courseID <= 0 {
			continue
		}
		if _, exists := grouped[courseID]; exists {
			continue
		}
		grouped[courseID] = firstNonEmpty(courseName, fmt.Sprintf("Course %d", courseID))
	}

	options := make([]siteReportDetailCourseItem, 0, len(grouped))
	for courseID, courseName := range grouped {
		options = append(options, siteReportDetailCourseItem{CourseID: courseID, CourseName: courseName})
	}
	sort.SliceStable(options, func(i, j int) bool {
		if options[i].CourseName != options[j].CourseName {
			return options[i].CourseName < options[j].CourseName
		}
		return options[i].CourseID < options[j].CourseID
	})
	return options
}

func paginateItems[T any](items []T, page, pageSize int) ([]T, int, int) {
	totalCount := len(items)
	if totalCount == 0 {
		return []T{}, 0, 0
	}
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = reportDetailPageSize
	}
	totalPages := (totalCount + pageSize - 1) / pageSize
	if page > totalPages {
		page = totalPages
	}
	start := (page - 1) * pageSize
	end := start + pageSize
	if end > totalCount {
		end = totalCount
	}
	return append([]T(nil), items[start:end]...), totalCount, totalPages
}

func writeSiteReportDetailCSV(w http.ResponseWriter, snapshot *store.SiteReportSnapshot, section string, metadata siteReportDetailMetadata) error {
	buffer := &bytes.Buffer{}
	writer := csv.NewWriter(buffer)

	write := func(record []string) error {
		return writer.Write(record)
	}

	switch section {
	case "at-risk-users":
		rows, _ := metadata.AllRows.([]siteReportAtRiskUserItem)
		if err := write([]string{"user_name", "email", "role_label", "course_name", "status_label", "average_grade", "last_action_at", "risk_score", "risk_reason"}); err != nil {
			return err
		}
		for _, row := range rows {
			if err := write([]string{row.UserName, row.Email, row.RoleLabel, row.CourseName, row.StatusLabel, nullableFloatString(row.AverageGrade), row.LastActionAt, strconv.Itoa(row.RiskScore), row.RiskReason}); err != nil {
				return err
			}
		}
	case "user-activity-summary":
		rows, _ := metadata.AllRows.([]siteReportUserActivityItem)
		if err := write([]string{"user_id", "user_name", "email", "role_label", "sessions", "total_online_seconds", "total_online_label", "submissions", "last_action_at"}); err != nil {
			return err
		}
		for _, row := range rows {
			if err := write([]string{strconv.Itoa(row.UserID), row.UserName, row.Email, row.RoleLabel, strconv.Itoa(row.Sessions), strconv.Itoa(row.TotalOnlineSeconds), row.TotalOnlineLabel, strconv.Itoa(row.Submissions), row.LastActionAt}); err != nil {
				return err
			}
		}
	case "course-completion-summary":
		rows, _ := metadata.AllRows.([]siteReportCourseCompletionItem)
		if err := write([]string{"course_id", "course_name", "enrolled", "completed", "in_progress", "not_started", "completion_rate"}); err != nil {
			return err
		}
		for _, row := range rows {
			if err := write([]string{strconv.Itoa(row.CourseID), row.CourseName, strconv.Itoa(row.Enrolled), strconv.Itoa(row.Completed), strconv.Itoa(row.InProgress), strconv.Itoa(row.NotStarted), strconv.Itoa(row.CompletionRate)}); err != nil {
				return err
			}
		}
	case "assignment-submission-detail":
		rows, _ := metadata.AllRows.([]siteReportAssignmentSubmissionItem)
		if err := write([]string{"course_id", "course_name", "assignment_id", "assignment_name", "user_id", "user_name", "email", "status_key", "status_label", "due_at", "submitted_at", "grade", "graded_at", "missing_grade", "late_by_seconds", "late_by_label"}); err != nil {
			return err
		}
		for _, row := range rows {
			if err := write([]string{strconv.Itoa(row.CourseID), row.CourseName, strconv.Itoa(row.AssignmentID), row.AssignmentName, strconv.Itoa(row.UserID), row.UserName, row.Email, row.StatusKey, row.StatusLabel, row.DueAt, row.SubmittedAt, nullableFloatString(row.Grade), row.GradedAt, yesNo(row.MissingGrade), strconv.Itoa(row.LateBySeconds), row.LateByLabel}); err != nil {
				return err
			}
		}
	case "forum-engagement-summary":
		rows, _ := metadata.AllRows.([]siteReportForumEngagementItem)
		if err := write([]string{"course_id", "course_name", "forum_id", "forum_name", "discussion_count", "post_count", "active_participants", "latest_post_at"}); err != nil {
			return err
		}
		for _, row := range rows {
			if err := write([]string{strconv.Itoa(row.CourseID), row.CourseName, strconv.Itoa(row.ForumID), row.ForumName, strconv.Itoa(row.DiscussionCount), strconv.Itoa(row.PostCount), strconv.Itoa(row.ActiveParticipants), row.LatestPostAt}); err != nil {
				return err
			}
		}
	case "gradebook-detail":
		rows, _ := metadata.AllRows.([]siteReportGradebookDetailItem)
		if err := write([]string{"course_id", "course_name", "user_id", "user_name", "email", "grade_item_id", "grade_item_name", "item_module", "item_instance", "final_grade", "pass_fail", "graded_at", "missing_grade"}); err != nil {
			return err
		}
		for _, row := range rows {
			if err := write([]string{strconv.Itoa(row.CourseID), row.CourseName, strconv.Itoa(row.UserID), row.UserName, row.Email, strconv.Itoa(row.GradeItemID), row.GradeItemName, row.ItemModule, strconv.Itoa(row.ItemInstance), nullableFloatString(row.FinalGrade), row.PassFail, row.GradedAt, yesNo(row.MissingGrade)}); err != nil {
				return err
			}
		}
	case "activity-completion-detail":
		rows, _ := metadata.AllRows.([]siteReportActivityCompletionItem)
		if err := write([]string{"course_id", "course_name", "activity_id", "activity_name", "module_type", "component_name", "user_id", "user_name", "email", "completion_state", "completion_state_key", "completion_state_label", "completion_at", "last_action_at"}); err != nil {
			return err
		}
		for _, row := range rows {
			if err := write([]string{strconv.Itoa(row.CourseID), row.CourseName, strconv.Itoa(row.ActivityID), row.ActivityName, row.ModuleType, row.ComponentName, strconv.Itoa(row.UserID), row.UserName, row.Email, strconv.Itoa(row.CompletionState), row.CompletionStateKey, row.CompletionStateLabel, row.CompletionAt, row.LastActionAt}); err != nil {
				return err
			}
		}
	case "quiz-activity-detail":
		rows, _ := metadata.AllRows.([]siteReportQuizActivityItem)
		if err := write([]string{"course_id", "course_name", "quiz_id", "quiz_name", "user_id", "user_name", "email", "attempts", "finished_attempts", "best_score", "average_score", "lowest_score", "time_spent_seconds", "time_spent_label", "status_label", "completion_at", "last_attempt_at"}); err != nil {
			return err
		}
		for _, row := range rows {
			if err := write([]string{strconv.Itoa(row.CourseID), row.CourseName, strconv.Itoa(row.QuizID), row.QuizName, strconv.Itoa(row.UserID), row.UserName, row.Email, strconv.Itoa(row.Attempts), strconv.Itoa(row.FinishedAttempts), floatString(row.BestScore), floatString(row.AverageScore), floatString(row.LowestScore), strconv.Itoa(row.TimeSpentSeconds), row.TimeSpentLabel, row.StatusLabel, row.CompletionAt, row.LastAttemptAt}); err != nil {
				return err
			}
		}
	case "quiz-question-analysis":
		rows, _ := metadata.AllRows.([]siteReportQuizQuestionAnalysisItem)
		if err := write([]string{"course_id", "course_name", "quiz_id", "quiz_name", "question_id", "question_name", "question_type", "attempts", "correct_rate", "average_score", "last_attempt_at"}); err != nil {
			return err
		}
		for _, row := range rows {
			if err := write([]string{strconv.Itoa(row.CourseID), row.CourseName, strconv.Itoa(row.QuizID), row.QuizName, strconv.Itoa(row.QuestionID), row.QuestionName, row.QuestionType, strconv.Itoa(row.Attempts), floatString(row.CorrectRate), floatString(row.AverageScore), row.LastAttemptAt}); err != nil {
				return err
			}
		}
	case "recent-activity":
		rows, _ := metadata.AllRows.([]siteReportRecentActivityItem)
		if err := write([]string{"user_name", "action", "occurred_at", "ip_address"}); err != nil {
			return err
		}
		for _, row := range rows {
			if err := write([]string{row.UserName, row.Action, row.OccurredAt, row.IPAddress}); err != nil {
				return err
			}
		}
	case "grade-recap":
		rows, _ := metadata.AllRows.([]siteReportGradeRecapItem)
		if err := write([]string{"course_id", "course_name", "average_grade", "highest_grade", "lowest_grade", "graded_count", "missing_grade_count", "passed", "failed"}); err != nil {
			return err
		}
		for _, row := range rows {
			if err := write([]string{strconv.Itoa(row.CourseID), row.CourseName, nullableFloatString(row.AverageGrade), nullableFloatString(row.HighestGrade), nullableFloatString(row.LowestGrade), strconv.Itoa(row.GradedCount), strconv.Itoa(row.MissingGradeCount), strconv.Itoa(row.Passed), strconv.Itoa(row.Failed)}); err != nil {
				return err
			}
		}
	case "activity-stats-summary":
		rows, _ := metadata.AllRows.([]siteReportActivityStatsItem)
		if err := write([]string{"course_id", "course_name", "activity_id", "activity_label", "module_type", "component_name", "visits", "time_spent_seconds", "time_spent_label", "num_completed", "total_events", "unique_users", "last_activity_at"}); err != nil {
			return err
		}
		for _, row := range rows {
			if err := write([]string{strconv.Itoa(row.CourseID), row.CourseName, strconv.Itoa(row.ActivityID), row.ActivityLabel, row.ModuleType, row.ComponentName, strconv.Itoa(row.Visits), strconv.Itoa(row.TimeSpentSeconds), row.TimeSpentLabel, strconv.Itoa(row.NumCompleted), strconv.Itoa(row.TotalEvents), strconv.Itoa(row.UniqueUsers), row.LastActivityAt}); err != nil {
				return err
			}
		}
	case "user-status":
		rows, _ := metadata.AllRows.([]siteReportUserStatusItem)
		if err := write([]string{"course_id", "course_name", "user_id", "user_name", "username", "email", "role_label", "enrolment_method", "enrolment_method_label", "enrolled_on", "status_key", "status_label", "average_grade", "last_action_at"}); err != nil {
			return err
		}
		for _, row := range rows {
			if err := write([]string{strconv.Itoa(row.CourseID), row.CourseName, strconv.Itoa(row.UserID), row.UserName, row.Username, row.Email, row.RoleLabel, row.EnrolmentMethod, row.EnrolmentMethodLabel, row.EnrolledOn, row.StatusKey, row.StatusLabel, nullableFloatString(row.AverageGrade), row.LastActionAt}); err != nil {
				return err
			}
		}
	default:
		return fmt.Errorf("section laporan tidak valid")
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		return err
	}

	filename := fmt.Sprintf("site-report-%s-%s.csv", section, normalizeReportPeriodKey(snapshot.PeriodKey))
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
	w.WriteHeader(http.StatusOK)
	_, err := w.Write(buffer.Bytes())
	return err
}

func nullableFloatString(value *float64) string {
	if value == nil {
		return ""
	}
	return strconv.FormatFloat(*value, 'f', 2, 64)
}

func floatString(value float64) string {
	return strconv.FormatFloat(value, 'f', 2, 64)
}

func yesNo(value bool) string {
	if value {
		return "ya"
	}
	return "tidak"
}
