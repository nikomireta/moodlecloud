"use client"

export const SITE_REPORT_SECTION_KEYS = [
  "daily-trend",
  "at-risk-users",
  "user-status",
  "activity-stats-summary",
  "assignment-submission-detail",
  "forum-engagement-summary",
  "gradebook-detail",
  "activity-completion-detail",
  "quiz-activity-detail",
  "quiz-question-analysis",
  "course-completion-summary",
  "grade-recap",
  "user-activity-summary",
  "recent-activity",
] as const

export type SiteReportSectionKey = (typeof SITE_REPORT_SECTION_KEYS)[number]

export const SITE_REPORT_INSIGHT_KEYS = [
  "people",
  "tasks",
  "courses",
  "engagement",
] as const

export type SiteReportInsightKey = (typeof SITE_REPORT_INSIGHT_KEYS)[number]

export type SiteReportFocusParams = {
  dayBucket?: number | null
  courseId?: number | null
  userId?: number | null
  quizId?: number | null
  activityId?: number | null
  assignmentId?: number | null
  forumId?: number | null
  gradeItemId?: number | null
  questionId?: number | null
  courseName?: string | null
  userName?: string | null
  occurredAt?: string | null
  action?: string | null
}

export function normalizeSiteReportSectionKey(value?: string | null): SiteReportSectionKey | null {
  if (!value) {
    return null
  }

  return SITE_REPORT_SECTION_KEYS.includes(value as SiteReportSectionKey)
    ? (value as SiteReportSectionKey)
    : null
}

export function normalizeSiteReportInsightKey(
  value?: string | null,
  fallback?: SiteReportInsightKey,
): SiteReportInsightKey | null {
  if (!value) {
    return fallback ?? null
  }

  return SITE_REPORT_INSIGHT_KEYS.includes(value as SiteReportInsightKey)
    ? (value as SiteReportInsightKey)
    : (fallback ?? null)
}

function normalizeIntegerParam(value?: string | null): number | null {
  if (!value) {
    return null
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

function setIfPresent(params: URLSearchParams, key: string, value?: string | number | null) {
  if (value === undefined || value === null || value === "") {
    return
  }

  params.set(key, String(value))
}

export function hasSiteReportFocusParams(focus: SiteReportFocusParams): boolean {
  return Object.values(focus).some((value) => value !== undefined && value !== null && value !== "")
}

export function readSiteReportFocusParams(searchParams: Pick<URLSearchParams, "get">): SiteReportFocusParams {
  return {
    dayBucket: normalizeIntegerParam(searchParams.get("focus_day_bucket")),
    courseId: normalizeIntegerParam(searchParams.get("focus_course_id")),
    userId: normalizeIntegerParam(searchParams.get("focus_user_id")),
    quizId: normalizeIntegerParam(searchParams.get("focus_quiz_id")),
    activityId: normalizeIntegerParam(searchParams.get("focus_activity_id")),
    assignmentId: normalizeIntegerParam(searchParams.get("focus_assignment_id")),
    forumId: normalizeIntegerParam(searchParams.get("focus_forum_id")),
    gradeItemId: normalizeIntegerParam(searchParams.get("focus_grade_item_id")),
    questionId: normalizeIntegerParam(searchParams.get("focus_question_id")),
    courseName: searchParams.get("focus_course_name"),
    userName: searchParams.get("focus_user_name"),
    occurredAt: searchParams.get("focus_occurred_at"),
    action: searchParams.get("focus_action"),
  }
}

function appendFocusParams(params: URLSearchParams, focus?: SiteReportFocusParams) {
  setIfPresent(params, "focus_day_bucket", focus?.dayBucket)
  setIfPresent(params, "focus_course_id", focus?.courseId)
  setIfPresent(params, "focus_user_id", focus?.userId)
  setIfPresent(params, "focus_quiz_id", focus?.quizId)
  setIfPresent(params, "focus_activity_id", focus?.activityId)
  setIfPresent(params, "focus_assignment_id", focus?.assignmentId)
  setIfPresent(params, "focus_forum_id", focus?.forumId)
  setIfPresent(params, "focus_grade_item_id", focus?.gradeItemId)
  setIfPresent(params, "focus_question_id", focus?.questionId)
  setIfPresent(params, "focus_course_name", focus?.courseName)
  setIfPresent(params, "focus_user_name", focus?.userName)
  setIfPresent(params, "focus_occurred_at", focus?.occurredAt)
  setIfPresent(params, "focus_action", focus?.action)
}

export function buildSiteFullReportHref(
  subdomain: string,
  periodKey: string,
  courseId?: number | null,
  insight?: SiteReportInsightKey | null,
): string {
  const params = new URLSearchParams()
  params.set("period_key", periodKey)
  if (courseId && courseId > 0) {
    params.set("course_id", String(courseId))
  }
  if (insight) {
    params.set("insight", insight)
  }
  return `/situs/${subdomain}/laporan?${params.toString()}`
}

export function buildSiteReportTabHref(
  subdomain: string,
  insight?: SiteReportInsightKey | null,
): string {
  const params = new URLSearchParams()
  params.set("tab", "laporan")
  if (insight) {
    params.set("insight", insight)
  }
  return `/situs/${subdomain}?${params.toString()}`
}

export function buildSiteReportDetailHref(
  subdomain: string,
  periodKey: string,
  options: {
    section: SiteReportSectionKey
    page?: number | null
    courseId?: number | null
    insight?: SiteReportInsightKey | null
    focus?: SiteReportFocusParams
  },
): string {
  const params = new URLSearchParams()
  params.set("period_key", periodKey)
  params.set("section", options.section)

  if (options.page && options.page > 1) {
    params.set("page", String(options.page))
  }
  if (options.courseId && options.courseId > 0) {
    params.set("course_id", String(options.courseId))
  }
  if (options.insight) {
    params.set("insight", options.insight)
  }

  appendFocusParams(params, options.focus)

  return `/situs/${subdomain}/laporan/detail?${params.toString()}`
}
