"use client"

import type {
  SiteReportCourseCompletionItem,
  SiteReportDailyTrendItem,
  SiteReportUserStatusDistributionItem,
} from "@/lib/api"

export type SiteReportActivityTrendPoint = {
  dayLabel: string
  loginCount: number
  activeUsers: number
  submissionCount: number
  completionCount: number
}

export type SiteReportSessionTimePoint = {
  dayLabel: string
  sessionTimeSeconds: number
  sessionTimeLabel: string
}

export type SiteReportCompletionChartPoint = {
  courseId: number
  courseName: string
  courseLabel: string
  enrolled: number
  completed: number
  inProgress: number
  notStarted: number
  completionRate: number
}

export type SiteReportStatusDistributionPoint = {
  statusKey: string
  statusLabel: string
  total: number
}

export type SiteReportActivityTrendSummary = {
  totalLogins: number
  totalActiveUsers: number
  totalSubmissions: number
  totalCompletions: number
  peakActiveUsers: number
  peakActiveDayLabel: string
}

export type SiteReportSessionTimeSummary = {
  totalSessionSeconds: number
  totalSessionLabel: string
  averageSessionSeconds: number
  averageSessionLabel: string
}

export type SiteReportCourseCompletionSummaryStats = {
  courseCount: number
  totalEnrolled: number
  totalCompleted: number
  averageCompletionRate: number
}

export type SiteReportStatusDistributionSummary = {
  totalTracked: number
  dominantStatusKey: string
  dominantStatusLabel: string
  dominantStatusTotal: number
}

function truncateLabel(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
}

export function formatDurationShort(seconds?: number | null): string {
  const safeSeconds = Math.max(0, Number(seconds) || 0)
  if (safeSeconds < 60) {
    return `${safeSeconds} dtk`
  }

  const totalMinutes = Math.round(safeSeconds / 60)
  if (totalMinutes < 60) {
    return `${totalMinutes} m`
  }

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (minutes === 0) {
    return `${hours} j`
  }

  return `${hours} j ${minutes} m`
}

export function buildActivityTrendChartData(rows: SiteReportDailyTrendItem[]): SiteReportActivityTrendPoint[] {
  return rows.map((row) => ({
    dayLabel: row.day_label,
    loginCount: row.login_count,
    activeUsers: row.active_users,
    submissionCount: row.submission_count,
    completionCount: row.completion_count,
  }))
}

export function buildSessionTimeChartData(rows: SiteReportDailyTrendItem[]): SiteReportSessionTimePoint[] {
  return rows.map((row) => ({
    dayLabel: row.day_label,
    sessionTimeSeconds: row.session_time_seconds,
    sessionTimeLabel: row.session_time_label || formatDurationShort(row.session_time_seconds),
  }))
}

export function buildCourseCompletionChartData(
  rows: SiteReportCourseCompletionItem[],
  options?: {
    limit?: number
    labelLength?: number
  },
): SiteReportCompletionChartPoint[] {
  const limit = options?.limit ?? rows.length
  const labelLength = options?.labelLength ?? 26

  return rows.slice(0, limit).map((row) => ({
    courseId: row.course_id,
    courseName: row.course_name || "Tanpa nama kursus",
    courseLabel: truncateLabel(row.course_name || "Tanpa nama kursus", labelLength),
    enrolled: row.enrolled,
    completed: row.completed,
    inProgress: row.in_progress,
    notStarted: row.not_started,
    completionRate: row.completion_rate,
  }))
}

export function buildUserStatusDistributionData(rows: SiteReportUserStatusDistributionItem[]): SiteReportStatusDistributionPoint[] {
  return rows.map((row) => ({
    statusKey: row.status_key || "not_started",
    statusLabel: row.status_label || "Lainnya",
    total: row.total,
  }))
}

export function buildActivityTrendSummary(rows: SiteReportDailyTrendItem[]): SiteReportActivityTrendSummary {
  return rows.reduce<SiteReportActivityTrendSummary>(
    (summary, row) => {
      summary.totalLogins += row.login_count
      summary.totalActiveUsers += row.active_users
      summary.totalSubmissions += row.submission_count
      summary.totalCompletions += row.completion_count

      if (row.active_users >= summary.peakActiveUsers) {
        summary.peakActiveUsers = row.active_users
        summary.peakActiveDayLabel = row.day_label
      }

      return summary
    },
    {
      totalLogins: 0,
      totalActiveUsers: 0,
      totalSubmissions: 0,
      totalCompletions: 0,
      peakActiveUsers: 0,
      peakActiveDayLabel: rows.at(-1)?.day_label ?? "-",
    },
  )
}

export function buildSessionTimeSummary(rows: SiteReportDailyTrendItem[]): SiteReportSessionTimeSummary {
  const totalSessionSeconds = rows.reduce((sum, row) => sum + row.session_time_seconds, 0)
  const averageSessionSeconds = rows.length > 0 ? Math.round(totalSessionSeconds / rows.length) : 0

  return {
    totalSessionSeconds,
    totalSessionLabel: formatDurationShort(totalSessionSeconds),
    averageSessionSeconds,
    averageSessionLabel: formatDurationShort(averageSessionSeconds),
  }
}

export function buildCourseCompletionSummaryStats(
  rows: SiteReportCourseCompletionItem[],
  options?: {
    limit?: number
  },
): SiteReportCourseCompletionSummaryStats {
  const limit = options?.limit ?? rows.length
  const visibleRows = rows.slice(0, limit)
  const totalEnrolled = visibleRows.reduce((sum, row) => sum + row.enrolled, 0)
  const totalCompleted = visibleRows.reduce((sum, row) => sum + row.completed, 0)
  const averageCompletionRate = visibleRows.length > 0
    ? Math.round((visibleRows.reduce((sum, row) => sum + row.completion_rate, 0) / visibleRows.length) * 10) / 10
    : 0

  return {
    courseCount: visibleRows.length,
    totalEnrolled,
    totalCompleted,
    averageCompletionRate,
  }
}

export function buildUserStatusDistributionSummary(rows: SiteReportUserStatusDistributionItem[]): SiteReportStatusDistributionSummary {
  const distribution = buildUserStatusDistributionData(rows)
  const dominant = distribution[0]

  return {
    totalTracked: distribution.reduce((sum, row) => sum + row.total, 0),
    dominantStatusKey: dominant?.statusKey ?? "not_started",
    dominantStatusLabel: dominant?.statusLabel ?? "Belum Mulai",
    dominantStatusTotal: dominant?.total ?? 0,
  }
}
