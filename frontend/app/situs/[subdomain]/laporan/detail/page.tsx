'use client'

import Link from "next/link"
import { use, useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Footer } from "@/components/layout/footer"
import { Header } from "@/components/layout/header"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  Info,
  Loader2,
  RefreshCw,
} from "lucide-react"
import {
  api,
  type SiteReportAssignmentSubmissionItem,
  type SiteReportAtRiskUserItem,
  type SiteReportActivityCompletionItem,
  type SiteReportActivityStatsItem,
  type SiteReportConnectionStatus,
  type SiteReportCourseCompletionItem,
  type SiteReportDetailResponse,
  type SiteReportForumEngagementItem,
  type SiteReportGradeRecapItem,
  type SiteReportGradebookDetailItem,
  type SiteReportQuizActivityItem,
  type SiteReportQuizQuestionAnalysisItem,
  type SiteReportRecentActivityItem,
  type SiteReportUserActivityItem,
  type SiteReportUserStatusItem,
  type SiteSummary,
} from "@/lib/api"
import {
  buildSiteFullReportHref,
  buildSiteReportDetailHref,
  hasSiteReportFocusParams,
  normalizeSiteReportInsightKey,
  normalizeSiteReportSectionKey,
  readSiteReportFocusParams,
  type SiteReportInsightKey,
  type SiteReportFocusParams,
  type SiteReportSectionKey,
} from "@/lib/site-report-sections"
import { cn } from "@/lib/utils"

const REPORT_SNAPSHOT_KEY = "reports_summary_v1"
const DEFAULT_PERIOD_KEY = "last_7_days"
const PERIOD_OPTIONS = [
  { value: "today", label: "Hari Ini" },
  { value: "last_7_days", label: "7 Hari Terakhir" },
  { value: "last_30_days", label: "30 Hari Terakhir" },
  { value: "this_month", label: "Bulan Ini" },
  { value: "last_month", label: "Bulan Lalu" },
]
const DEFAULT_INSIGHT_CATEGORY: SiteReportInsightKey = "tasks"

function periodUsageHint(periodKey: string): string {
  switch (periodKey) {
    case "today":
      return "Gunakan untuk monitoring operasional yang sedang berlangsung, misalnya ujian hari ini."
    case "last_30_days":
      return "Gunakan saat perlu konteks yang lebih panjang sebelum menindaklanjuti detail."
    case "this_month":
      return "Gunakan untuk menilai detail yang terjadi sepanjang bulan berjalan."
    case "last_month":
      return "Gunakan untuk audit detail periode bulan lalu."
    default:
      return "Pilihan paling stabil untuk tindak lanjut detail tanpa terlalu banyak noise harian."
  }
}

function normalizePeriodKey(value?: string | null) {
  return PERIOD_OPTIONS.some((option) => option.value === value) ? value! : DEFAULT_PERIOD_KEY
}

function normalizePage(value?: string | null) {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

function normalizeCourseID(value?: string | null) {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function formatReportClock(isoStr?: string | null): string {
  if (!isoStr) return "-"
  try {
    const d = new Date(isoStr)
    return d.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return isoStr
  }
}

function formatGradeValue(value?: number | null): string {
  return typeof value === "number" ? value.toFixed(1) : "-"
}

function formatPercentageValue(value?: number | null): string {
  return typeof value === "number" ? `${value.toFixed(1)}%` : "-"
}

function connectionBadge(connection: SiteReportConnectionStatus) {
  switch (connection.state) {
    case "tracking_active":
    case "synced":
      return {
        className: "text-green-600 border-green-600/50 bg-green-500/10",
        icon: CheckCircle2,
      }
    case "tracking_stale":
      return {
        className: "text-amber-600 border-amber-600/50 bg-amber-500/10",
        icon: AlertCircle,
      }
    case "synced_no_activity":
      return {
        className: "text-blue-600 border-blue-600/50 bg-blue-500/10",
        icon: Info,
      }
    case "connected_waiting_sync":
      return {
        className: "text-amber-600 border-amber-600/50 bg-amber-500/10",
        icon: Clock,
      }
    case "sync_error":
      return {
        className: "text-red-600 border-red-600/50 bg-red-500/10",
        icon: AlertCircle,
      }
    default:
      return {
        className: "text-slate-600 border-slate-600/50 bg-slate-500/10",
        icon: Info,
      }
  }
}

function riskBadgeClass(score: number) {
  if (score >= 80) {
    return "border-red-600/40 bg-red-500/10 text-red-700"
  }
  if (score >= 50) {
    return "border-amber-600/40 bg-amber-500/10 text-amber-700"
  }
  return "border-blue-600/40 bg-blue-500/10 text-blue-700"
}

function assignmentStatusBadgeClass(statusKey: string) {
  switch (statusKey) {
    case "missing":
      return "border-red-600/40 bg-red-500/10 text-red-700"
    case "late":
      return "border-amber-600/40 bg-amber-500/10 text-amber-700"
    case "graded":
      return "border-green-600/40 bg-green-500/10 text-green-700"
    case "submitted":
      return "border-blue-600/40 bg-blue-500/10 text-blue-700"
    default:
      return "border-slate-600/40 bg-slate-500/10 text-slate-700"
  }
}

function completionStateBadgeClass(stateKey: string) {
  switch (stateKey) {
    case "completed_fail":
      return "border-red-600/40 bg-red-500/10 text-red-700"
    case "completed_pass":
      return "border-green-600/40 bg-green-500/10 text-green-700"
    case "completed":
      return "border-emerald-600/40 bg-emerald-500/10 text-emerald-700"
    default:
      return "border-amber-600/40 bg-amber-500/10 text-amber-700"
  }
}

function focusedRowClass(isFocused: boolean) {
  return cn(
    isFocused && "bg-sky-500/10 shadow-[inset_4px_0_0_0_rgba(14,165,233,0.9)] hover:bg-sky-500/10",
  )
}

function EmptyTableMessage({ message = "Belum ada data untuk filter ini." }: { message?: string }) {
  return <p className="text-sm text-muted-foreground">{message}</p>
}

function rowMatchesFocus(section: SiteReportSectionKey, row: unknown, focus: SiteReportFocusParams) {
  switch (section) {
    case "at-risk-users": {
      const item = row as SiteReportAtRiskUserItem
      return (!focus.userName || focus.userName === item.user_name) && (!focus.email || focus.email === item.email)
    }
    case "user-activity-summary": {
      const item = row as SiteReportUserActivityItem
      return (!focus.userId || focus.userId === item.user_id) && (!focus.email || focus.email === item.email) && (!focus.userName || focus.userName === item.user_name)
    }
    case "course-completion-summary": {
      const item = row as SiteReportCourseCompletionItem
      return !focus.courseId || focus.courseId === item.course_id
    }
    case "assignment-submission-detail": {
      const item = row as SiteReportAssignmentSubmissionItem
      return (!focus.assignmentId || focus.assignmentId === item.assignment_id) && (!focus.userId || focus.userId === item.user_id) && (!focus.courseId || focus.courseId === item.course_id)
    }
    case "forum-engagement-summary": {
      const item = row as SiteReportForumEngagementItem
      return (!focus.forumId || focus.forumId === item.forum_id) && (!focus.activityId || focus.activityId === item.activity_id) && (!focus.courseId || focus.courseId === item.course_id)
    }
    case "gradebook-detail": {
      const item = row as SiteReportGradebookDetailItem
      return (!focus.gradeItemId || focus.gradeItemId === item.grade_item_id) && (!focus.userId || focus.userId === item.user_id) && (!focus.courseId || focus.courseId === item.course_id)
    }
    case "activity-completion-detail": {
      const item = row as SiteReportActivityCompletionItem
      return (!focus.activityId || focus.activityId === item.activity_id) && (!focus.userId || focus.userId === item.user_id) && (!focus.courseId || focus.courseId === item.course_id)
    }
    case "quiz-activity-detail": {
      const item = row as SiteReportQuizActivityItem
      return (!focus.quizId || focus.quizId === item.quiz_id) && (!focus.userId || focus.userId === item.user_id) && (!focus.courseId || focus.courseId === item.course_id)
    }
    case "quiz-question-analysis": {
      const item = row as SiteReportQuizQuestionAnalysisItem
      return (!focus.quizId || focus.quizId === item.quiz_id) && (!focus.questionId || focus.questionId === item.question_id) && (!focus.courseId || focus.courseId === item.course_id)
    }
    case "recent-activity": {
      const item = row as SiteReportRecentActivityItem
      return (!focus.occurredAt || focus.occurredAt === item.occurred_at) && (!focus.action || focus.action === item.action) && (!focus.userName || focus.userName === item.user_name)
    }
    case "grade-recap": {
      const item = row as SiteReportGradeRecapItem
      return !focus.courseId || focus.courseId === item.course_id
    }
    case "activity-stats-summary": {
      const item = row as SiteReportActivityStatsItem
      return (!focus.activityId || focus.activityId === item.activity_id) && (!focus.courseId || focus.courseId === item.course_id)
    }
    case "user-status": {
      const item = row as SiteReportUserStatusItem
      return (!focus.userId || focus.userId === item.user_id) && (!focus.courseId || focus.courseId === item.course_id) && (!focus.email || focus.email === item.email) && (!focus.userName || focus.userName === item.user_name)
    }
    case "daily-trend":
    default:
      return false
  }
}

function renderDetailTable(section: SiteReportSectionKey, rows: unknown[], focus: SiteReportFocusParams) {
  switch (section) {
    case "at-risk-users": {
      const items = rows as SiteReportAtRiskUserItem[]
      return items.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pengguna</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Kursus</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Risiko</TableHead>
              <TableHead>Alasan</TableHead>
              <TableHead>Last Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((row, index) => {
              const isFocused = rowMatchesFocus(section, row, focus)
              return (
                <TableRow key={`${row.email}-${index}`} className={focusedRowClass(isFocused)} data-report-focus-target={isFocused || undefined}>
                  <TableCell className="font-medium">{row.user_name}</TableCell>
                  <TableCell>{row.email || "-"}</TableCell>
                  <TableCell>{row.course_name || "-"}</TableCell>
                  <TableCell>{row.status_label || "-"}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className={riskBadgeClass(row.risk_score)}>Risiko {row.risk_score}</Badge>
                  </TableCell>
                  <TableCell>{row.risk_reason}</TableCell>
                  <TableCell>{formatReportClock(row.last_action_at)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      ) : <EmptyTableMessage />
    }
    case "user-activity-summary": {
      const items = rows as SiteReportUserActivityItem[]
      return items.length > 0 ? (
        <Table>
          <TableHeader><TableRow><TableHead>Pengguna</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead className="text-right">Sesi</TableHead><TableHead className="text-right">Online</TableHead><TableHead className="text-right">Submissions</TableHead><TableHead>Last Action</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.map((row) => {
              const isFocused = rowMatchesFocus(section, row, focus)
              return <TableRow key={row.user_id} className={focusedRowClass(isFocused)} data-report-focus-target={isFocused || undefined}><TableCell className="font-medium">{row.user_name}</TableCell><TableCell>{row.email || "-"}</TableCell><TableCell>{row.role_label || "-"}</TableCell><TableCell className="text-right">{row.sessions}</TableCell><TableCell className="text-right">{row.total_online_label}</TableCell><TableCell className="text-right">{row.submissions}</TableCell><TableCell>{formatReportClock(row.last_action_at)}</TableCell></TableRow>
            })}
          </TableBody>
        </Table>
      ) : <EmptyTableMessage />
    }
    case "course-completion-summary": {
      const items = rows as SiteReportCourseCompletionItem[]
      return items.length > 0 ? (
        <Table>
          <TableHeader><TableRow><TableHead>Kursus</TableHead><TableHead className="text-right">Enrolled</TableHead><TableHead className="text-right">Completed</TableHead><TableHead className="text-right">In Progress</TableHead><TableHead className="text-right">Belum Mulai</TableHead><TableHead className="text-right">Completion Rate</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.map((row) => {
              const isFocused = rowMatchesFocus(section, row, focus)
              return <TableRow key={row.course_id} className={focusedRowClass(isFocused)} data-report-focus-target={isFocused || undefined}><TableCell className="font-medium">{row.course_name}</TableCell><TableCell className="text-right">{row.enrolled}</TableCell><TableCell className="text-right">{row.completed}</TableCell><TableCell className="text-right">{row.in_progress}</TableCell><TableCell className="text-right">{row.not_started}</TableCell><TableCell className="text-right">{row.completion_rate}%</TableCell></TableRow>
            })}
          </TableBody>
        </Table>
      ) : <EmptyTableMessage />
    }
    case "assignment-submission-detail": {
      const items = rows as SiteReportAssignmentSubmissionItem[]
      return items.length > 0 ? (
        <Table>
          <TableHeader><TableRow><TableHead>Kursus</TableHead><TableHead>Assignment</TableHead><TableHead>Pengguna</TableHead><TableHead>Status</TableHead><TableHead>Due</TableHead><TableHead>Submitted</TableHead><TableHead className="text-right">Nilai</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.map((row, index) => {
              const isFocused = rowMatchesFocus(section, row, focus)
              return <TableRow key={`${row.assignment_id}-${row.user_id}-${index}`} className={focusedRowClass(isFocused)} data-report-focus-target={isFocused || undefined}><TableCell>{row.course_name || "-"}</TableCell><TableCell className="font-medium">{row.assignment_name}</TableCell><TableCell>{row.user_name}</TableCell><TableCell><Badge variant="outline" className={assignmentStatusBadgeClass(row.status_key)}>{row.status_label}</Badge></TableCell><TableCell>{formatReportClock(row.due_at)}</TableCell><TableCell>{formatReportClock(row.submitted_at)}</TableCell><TableCell className="text-right">{formatGradeValue(row.grade)}</TableCell></TableRow>
            })}
          </TableBody>
        </Table>
      ) : <EmptyTableMessage />
    }
    case "forum-engagement-summary": {
      const items = rows as SiteReportForumEngagementItem[]
      return items.length > 0 ? (
        <Table>
          <TableHeader><TableRow><TableHead>Kursus</TableHead><TableHead>Forum</TableHead><TableHead className="text-right">Diskusi</TableHead><TableHead className="text-right">Post</TableHead><TableHead className="text-right">Peserta Aktif</TableHead><TableHead>Terakhir</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.map((row, index) => {
              const isFocused = rowMatchesFocus(section, row, focus)
              return <TableRow key={`${row.forum_id}-${index}`} className={focusedRowClass(isFocused)} data-report-focus-target={isFocused || undefined}><TableCell>{row.course_name || "-"}</TableCell><TableCell className="font-medium">{row.forum_name}</TableCell><TableCell className="text-right">{row.discussion_count}</TableCell><TableCell className="text-right">{row.post_count}</TableCell><TableCell className="text-right">{row.active_participants}</TableCell><TableCell>{formatReportClock(row.latest_post_at)}</TableCell></TableRow>
            })}
          </TableBody>
        </Table>
      ) : <EmptyTableMessage />
    }
    case "gradebook-detail": {
      const items = rows as SiteReportGradebookDetailItem[]
      return items.length > 0 ? (
        <Table>
          <TableHeader><TableRow><TableHead>Kursus</TableHead><TableHead>Grade Item</TableHead><TableHead>Pengguna</TableHead><TableHead>Email</TableHead><TableHead className="text-right">Nilai</TableHead><TableHead>Pass/Fail</TableHead><TableHead>Graded At</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.map((row, index) => {
              const isFocused = rowMatchesFocus(section, row, focus)
              return <TableRow key={`${row.grade_item_id}-${row.user_id}-${index}`} className={focusedRowClass(isFocused)} data-report-focus-target={isFocused || undefined}><TableCell>{row.course_name || "-"}</TableCell><TableCell className="font-medium">{row.grade_item_name}</TableCell><TableCell>{row.user_name}</TableCell><TableCell>{row.email || "-"}</TableCell><TableCell className="text-right">{formatGradeValue(row.final_grade)}</TableCell><TableCell>{row.pass_fail}</TableCell><TableCell>{formatReportClock(row.graded_at)}</TableCell></TableRow>
            })}
          </TableBody>
        </Table>
      ) : <EmptyTableMessage />
    }
    case "activity-completion-detail": {
      const items = rows as SiteReportActivityCompletionItem[]
      return items.length > 0 ? (
        <Table>
          <TableHeader><TableRow><TableHead>Kursus</TableHead><TableHead>Aktivitas</TableHead><TableHead>Pengguna</TableHead><TableHead>Email</TableHead><TableHead>Status</TableHead><TableHead>Completed At</TableHead><TableHead>Last Action</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.map((row, index) => {
              const isFocused = rowMatchesFocus(section, row, focus)
              return <TableRow key={`${row.activity_id}-${row.user_id}-${index}`} className={focusedRowClass(isFocused)} data-report-focus-target={isFocused || undefined}><TableCell>{row.course_name || "-"}</TableCell><TableCell className="font-medium">{row.activity_name}</TableCell><TableCell>{row.user_name}</TableCell><TableCell>{row.email || "-"}</TableCell><TableCell><Badge variant="outline" className={completionStateBadgeClass(row.completion_state_key)}>{row.completion_state_label}</Badge></TableCell><TableCell>{formatReportClock(row.completion_at)}</TableCell><TableCell>{formatReportClock(row.last_action_at)}</TableCell></TableRow>
            })}
          </TableBody>
        </Table>
      ) : <EmptyTableMessage />
    }
    case "quiz-activity-detail": {
      const items = rows as SiteReportQuizActivityItem[]
      return items.length > 0 ? (
        <Table>
          <TableHeader><TableRow><TableHead>Quiz</TableHead><TableHead>Kursus</TableHead><TableHead>Pengguna</TableHead><TableHead className="text-right">Attempts</TableHead><TableHead className="text-right">Finished</TableHead><TableHead className="text-right">Best</TableHead><TableHead className="text-right">Average</TableHead><TableHead>Last Attempt</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.map((row, index) => {
              const isFocused = rowMatchesFocus(section, row, focus)
              return <TableRow key={`${row.quiz_id}-${row.user_id}-${index}`} className={focusedRowClass(isFocused)} data-report-focus-target={isFocused || undefined}><TableCell className="font-medium">{row.quiz_name}</TableCell><TableCell>{row.course_name || "-"}</TableCell><TableCell>{row.user_name}</TableCell><TableCell className="text-right">{row.attempts}</TableCell><TableCell className="text-right">{row.finished_attempts}</TableCell><TableCell className="text-right">{row.best_score.toFixed(1)}</TableCell><TableCell className="text-right">{row.average_score.toFixed(1)}</TableCell><TableCell>{formatReportClock(row.last_attempt_at)}</TableCell></TableRow>
            })}
          </TableBody>
        </Table>
      ) : <EmptyTableMessage />
    }
    case "quiz-question-analysis": {
      const items = rows as SiteReportQuizQuestionAnalysisItem[]
      return items.length > 0 ? (
        <Table>
          <TableHeader><TableRow><TableHead>Quiz</TableHead><TableHead>Kursus</TableHead><TableHead>Pertanyaan</TableHead><TableHead>Tipe</TableHead><TableHead className="text-right">Attempts</TableHead><TableHead className="text-right">Correct Rate</TableHead><TableHead className="text-right">Average Score</TableHead><TableHead>Last Attempt</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.map((row, index) => {
              const isFocused = rowMatchesFocus(section, row, focus)
              return <TableRow key={`${row.quiz_id}-${row.question_id}-${index}`} className={focusedRowClass(isFocused)} data-report-focus-target={isFocused || undefined}><TableCell className="font-medium">{row.quiz_name}</TableCell><TableCell>{row.course_name || "-"}</TableCell><TableCell>{row.question_name}</TableCell><TableCell>{row.question_type || "-"}</TableCell><TableCell className="text-right">{row.attempts}</TableCell><TableCell className="text-right">{formatPercentageValue(row.correct_rate)}</TableCell><TableCell className="text-right">{formatPercentageValue(row.average_score)}</TableCell><TableCell>{formatReportClock(row.last_attempt_at)}</TableCell></TableRow>
            })}
          </TableBody>
        </Table>
      ) : <EmptyTableMessage />
    }
    case "recent-activity": {
      const items = rows as SiteReportRecentActivityItem[]
      return items.length > 0 ? (
        <Table>
          <TableHeader><TableRow><TableHead>Pengguna</TableHead><TableHead>Aksi</TableHead><TableHead>Waktu</TableHead><TableHead>IP</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.map((row, index) => {
              const isFocused = rowMatchesFocus(section, row, focus)
              return <TableRow key={`${row.user_name}-${row.occurred_at}-${index}`} className={focusedRowClass(isFocused)} data-report-focus-target={isFocused || undefined}><TableCell className="font-medium">{row.user_name}</TableCell><TableCell>{row.action}</TableCell><TableCell>{formatReportClock(row.occurred_at)}</TableCell><TableCell>{row.ip_address || "-"}</TableCell></TableRow>
            })}
          </TableBody>
        </Table>
      ) : <EmptyTableMessage />
    }
    case "grade-recap": {
      const items = rows as SiteReportGradeRecapItem[]
      return items.length > 0 ? (
        <Table>
          <TableHeader><TableRow><TableHead>Kursus</TableHead><TableHead className="text-right">Average</TableHead><TableHead className="text-right">Highest</TableHead><TableHead className="text-right">Lowest</TableHead><TableHead className="text-right">Passed</TableHead><TableHead className="text-right">Failed</TableHead><TableHead className="text-right">Missing</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.map((row) => {
              const isFocused = rowMatchesFocus(section, row, focus)
              return <TableRow key={row.course_id} className={focusedRowClass(isFocused)} data-report-focus-target={isFocused || undefined}><TableCell className="font-medium">{row.course_name}</TableCell><TableCell className="text-right">{formatGradeValue(row.average_grade)}</TableCell><TableCell className="text-right">{formatGradeValue(row.highest_grade)}</TableCell><TableCell className="text-right">{formatGradeValue(row.lowest_grade)}</TableCell><TableCell className="text-right">{row.passed}</TableCell><TableCell className="text-right">{row.failed}</TableCell><TableCell className="text-right">{row.missing_grade_count}</TableCell></TableRow>
            })}
          </TableBody>
        </Table>
      ) : <EmptyTableMessage />
    }
    case "activity-stats-summary": {
      const items = rows as SiteReportActivityStatsItem[]
      return items.length > 0 ? (
        <Table>
          <TableHeader><TableRow><TableHead>Kursus</TableHead><TableHead>Aktivitas</TableHead><TableHead>Modul</TableHead><TableHead className="text-right">Visits</TableHead><TableHead className="text-right">Events</TableHead><TableHead className="text-right">Users</TableHead><TableHead className="text-right">Completion</TableHead><TableHead>Last Activity</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.map((row, index) => {
              const isFocused = rowMatchesFocus(section, row, focus)
              return <TableRow key={`${row.activity_id}-${index}`} className={focusedRowClass(isFocused)} data-report-focus-target={isFocused || undefined}><TableCell>{row.course_name || "-"}</TableCell><TableCell className="font-medium">{row.activity_label}</TableCell><TableCell>{row.component_name || row.module_type || "-"}</TableCell><TableCell className="text-right">{row.visits}</TableCell><TableCell className="text-right">{row.total_events}</TableCell><TableCell className="text-right">{row.unique_users}</TableCell><TableCell className="text-right">{row.num_completed}</TableCell><TableCell>{formatReportClock(row.last_activity_at)}</TableCell></TableRow>
            })}
          </TableBody>
        </Table>
      ) : <EmptyTableMessage />
    }
    case "user-status": {
      const items = rows as SiteReportUserStatusItem[]
      return items.length > 0 ? (
        <Table>
          <TableHeader><TableRow><TableHead>Pengguna</TableHead><TableHead>Email</TableHead><TableHead>Kursus</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Avg Grade</TableHead><TableHead>Last Action</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.map((row) => {
              const isFocused = rowMatchesFocus(section, row, focus)
              return <TableRow key={`${row.user_id}-${row.course_id}`} className={focusedRowClass(isFocused)} data-report-focus-target={isFocused || undefined}><TableCell className="font-medium">{row.user_name}</TableCell><TableCell>{row.email || "-"}</TableCell><TableCell>{row.course_name || "-"}</TableCell><TableCell>{row.role_label || "-"}</TableCell><TableCell>{row.status_label}</TableCell><TableCell className="text-right">{formatGradeValue(row.average_grade)}</TableCell><TableCell>{formatReportClock(row.last_action_at)}</TableCell></TableRow>
            })}
          </TableBody>
        </Table>
      ) : <EmptyTableMessage />
    }
    default:
      return <EmptyTableMessage message="Section detail ini belum tersedia." />
  }
}

export default function SiteReportDetailPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const section = normalizeSiteReportSectionKey(searchParams.get("section"))
  const focus = readSiteReportFocusParams(searchParams)
  const [site, setSite] = useState<SiteSummary | null>(null)
  const [report, setReport] = useState<SiteReportDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const periodKey = normalizePeriodKey(searchParams.get("period_key"))
  const page = normalizePage(searchParams.get("page"))
  const courseID = normalizeCourseID(searchParams.get("course_id"))
  const insight = normalizeSiteReportInsightKey(searchParams.get("insight"), DEFAULT_INSIGHT_CATEGORY)

  const loadReport = useCallback(async () => {
    if (!section) {
      setLoading(false)
      setError("Section laporan tidak valid")
      return
    }

    setLoading(true)
    setError(null)
    try {
      const siteResponse = await api.getSiteBySubdomain(subdomain)
      const reportResponse = await api.getSiteReportDetail(siteResponse.site.id, {
        section,
        snapshotKey: REPORT_SNAPSHOT_KEY,
        periodKey,
        courseID: courseID ?? undefined,
        page,
      })
      setSite(siteResponse.site)
      setReport(reportResponse)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat detail laporan")
    } finally {
      setLoading(false)
    }
  }, [courseID, page, periodKey, section, subdomain])

  useEffect(() => {
    void loadReport()
  }, [loadReport])

  useEffect(() => {
    if (!report || loading || !section || !hasSiteReportFocusParams(focus)) {
      return
    }

    const timer = window.setTimeout(() => {
      const target = document.querySelector('[data-report-focus-target="true"]')
      if (target instanceof HTMLElement) {
        target.scrollIntoView({ behavior: "smooth", block: "center" })
      }
    }, 220)

    return () => window.clearTimeout(timer)
  }, [focus, loading, report, section])

  const payload = report?.snapshot?.payload
  const connection = report?.connection ?? null
  const badgeConfig = connection ? connectionBadge(connection) : null
  const BadgeIcon = badgeConfig?.icon
  const activePeriodOption = PERIOD_OPTIONS.find((option) => option.value === periodKey) ?? PERIOD_OPTIONS[0]
  const availableCourses = payload?.available_courses ?? []
  const selectedCourseValue = payload?.selected_course_id ? String(payload.selected_course_id) : "all"
  const selectedCourse = availableCourses.find((course) => course.course_id === payload?.selected_course_id) ?? null
  const rows = useMemo(() => (Array.isArray(payload?.rows) ? payload.rows : []), [payload?.rows])

  const updateQuery = useCallback((next: { periodKey?: string; page?: number; courseID?: number | null }) => {
    if (!section) {
      return
    }
    const href = buildSiteReportDetailHref(subdomain, next.periodKey ?? periodKey, {
      section,
      page: next.page ?? page,
      courseId: next.courseID === undefined ? courseID : next.courseID,
      insight,
      focus,
    })
    router.replace(href, { scroll: false })
  }, [courseID, focus, insight, page, periodKey, router, section, subdomain])

  const handleExport = useCallback(async () => {
    if (!site || !section) {
      return
    }
    setExporting(true)
    try {
      const blob = await api.downloadSiteReportDetailCSV(site.id, {
        section,
        snapshotKey: REPORT_SNAPSHOT_KEY,
        periodKey,
        courseID: courseID ?? undefined,
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `site-report-${section}-${periodKey}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengunduh CSV")
    } finally {
      setExporting(false)
    }
  }, [courseID, periodKey, section, site])

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 py-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="space-y-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <Button variant="ghost" size="sm" asChild className="w-fit px-0">
                    <Link href={buildSiteFullReportHref(subdomain, periodKey, courseID, insight)}>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Kembali ke Overview Laporan
                    </Link>
                  </Button>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Detail operasional</p>
                    <h1 className="text-2xl font-bold tracking-tight">{payload?.section_title ?? "Detail Laporan"}</h1>
                    <p className="text-sm text-muted-foreground">
                      Gunakan halaman ini saat Anda sudah tahu area yang ingin ditindaklanjuti. Filter periode dan kursus akan menjaga tabel tetap fokus.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Select value={periodKey} onValueChange={(value) => updateQuery({ periodKey: normalizePeriodKey(value), page: 1 })}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PERIOD_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {availableCourses.length > 0 ? (
                    <Select value={selectedCourseValue} onValueChange={(value) => updateQuery({ courseID: value === "all" ? null : Number(value), page: 1 })}>
                      <SelectTrigger className="w-[220px]">
                        <SelectValue placeholder="Semua kursus" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua kursus</SelectItem>
                        {availableCourses.map((course) => (
                          <SelectItem key={course.course_id} value={String(course.course_id)}>{course.course_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                  <Button variant="outline" onClick={() => void loadReport()} disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Refresh
                  </Button>
                  <Button variant="outline" onClick={() => void handleExport()} disabled={exporting || !payload}>
                    {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    Export CSV
                  </Button>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p>
                  <span className="font-medium text-foreground">{activePeriodOption.label}:</span> {periodUsageHint(periodKey)}
                </p>
              </div>

              {loading && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="h-28 animate-pulse rounded-lg border bg-muted" />
                  ))}
                </div>
              )}

              {!loading && error && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <AlertCircle className="mb-4 h-8 w-8 text-destructive" />
                  <h3 className="text-lg font-semibold">Gagal Memuat Detail Laporan</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{error}</p>
                  <Button variant="outline" className="mt-4" onClick={() => void loadReport()}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Coba Lagi
                  </Button>
                </div>
              )}

              {!loading && !error && report && connection && (
                <>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {BadgeIcon && <Badge variant="outline" className={`gap-1 ${badgeConfig?.className ?? ""}`}><BadgeIcon className="h-3 w-3" />{connection.state_label}</Badge>}
                    <Badge variant="outline">{activePeriodOption.label}</Badge>
                    {selectedCourse ? <Badge variant="outline">Kursus: {selectedCourse.course_name}</Badge> : null}
                    <span>Status sinkronisasi: {connection.state_label}</span>
                    <span>Halaman {payload?.page ?? 1} / {payload?.total_pages ?? 0}</span>
                    <span>Total baris: {payload?.total_count ?? 0}</span>
                  </div>

                  {!report.snapshot || !payload ? (
                    <Card>
                      <CardContent className="py-16">
                        <EmptyTableMessage message="Snapshot laporan belum tersedia untuk section ini." />
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardHeader>
                        <CardTitle>{payload?.section_title}</CardTitle>
                        <CardDescription>{payload?.section_description}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {renderDetailTable(section!, rows, focus)}

                        {payload.total_pages > 1 ? (
                          <Pagination>
                            <PaginationContent>
                              <PaginationItem>
                                <PaginationPrevious
                                  href={payload.page > 1 ? buildSiteReportDetailHref(subdomain, periodKey, { section: section!, page: payload.page - 1, courseId: courseID, insight, focus }) : "#"}
                                  aria-disabled={payload.page <= 1}
                                  className={payload.page <= 1 ? "pointer-events-none opacity-50" : undefined}
                                />
                              </PaginationItem>
                              <PaginationItem>
                                <PaginationLink href="#" isActive size="default">
                                  {payload.page} / {payload.total_pages}
                                </PaginationLink>
                              </PaginationItem>
                              <PaginationItem>
                                <PaginationNext
                                  href={payload.page < payload.total_pages ? buildSiteReportDetailHref(subdomain, periodKey, { section: section!, page: payload.page + 1, courseId: courseID, insight, focus }) : "#"}
                                  aria-disabled={payload.page >= payload.total_pages}
                                  className={payload.page >= payload.total_pages ? "pointer-events-none opacity-50" : undefined}
                                />
                              </PaginationItem>
                            </PaginationContent>
                          </Pagination>
                        ) : null}
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  )
}
