'use client'

import Link from "next/link"
import { use, useCallback, useEffect, useState } from "react"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  Info,
  Loader2,
  RefreshCw,
  Users,
} from "lucide-react"
import {
  api,
  type SiteReportConnectionStatus,
  type SiteReportFullResponse,
  type SiteSummary,
} from "@/lib/api"

const REPORT_SNAPSHOT_KEY = "reports_summary_v1"
const DEFAULT_PERIOD_KEY = "last_7_days"

const PERIOD_OPTIONS = [
  { value: "last_7_days", label: "7 Hari Terakhir" },
  { value: "last_30_days", label: "30 Hari Terakhir" },
  { value: "this_month", label: "Bulan Ini" },
  { value: "last_month", label: "Bulan Lalu" },
]

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

function formatRelativeTime(isoStr?: string | null): string {
  if (!isoStr) return "-"
  const now = new Date()
  const d = new Date(isoStr)
  const diffMs = now.getTime() - d.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "Baru saja"
  if (mins < 60) return `${mins} menit lalu`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.floor(hours / 24)
  return `${days} hari lalu`
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

function highlightCardStyle(tone: SiteReportFullResponse["highlight"]["tone"]) {
  switch (tone) {
    case "success":
      return "border-green-600/30 bg-green-500/5"
    case "warning":
      return "border-amber-600/30 bg-amber-500/5"
    case "danger":
      return "border-red-600/30 bg-red-500/5"
    default:
      return "border-blue-600/30 bg-blue-500/5"
  }
}

function EmptyTableMessage() {
  return <p className="text-sm text-muted-foreground">Belum ada data untuk periode ini.</p>
}

export default function SiteFullReportPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  const [site, setSite] = useState<SiteSummary | null>(null)
  const [report, setReport] = useState<SiteReportFullResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [periodKey, setPeriodKey] = useState(DEFAULT_PERIOD_KEY)

  const loadReport = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const siteResponse = await api.getSiteBySubdomain(subdomain)
      const reportResponse = await api.getSiteFullReport(siteResponse.site.id, {
        snapshotKey: REPORT_SNAPSHOT_KEY,
        periodKey,
      })
      setSite(siteResponse.site)
      setReport(reportResponse)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat laporan lengkap")
    } finally {
      setLoading(false)
    }
  }, [periodKey, subdomain])

  useEffect(() => {
    void loadReport()
  }, [loadReport])

  const connection = report?.connection ?? null
  const snapshot = report?.snapshot ?? null
  const payload = snapshot?.payload
  const badgeConfig = connection ? connectionBadge(connection) : null
  const BadgeIcon = badgeConfig?.icon
  const activePeriodOption = PERIOD_OPTIONS.find((option) => option.value === periodKey) ?? PERIOD_OPTIONS[0]

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
                    <Link href={`/situs/${subdomain}?tab=laporan`}>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Kembali ke Detail Situs
                    </Link>
                  </Button>
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight">Laporan Lengkap Situs</h1>
                    <p className="text-sm text-muted-foreground">
                      {site?.name ?? subdomain} · dashboard analytics milik Moodlepilot untuk tenant ini
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Select value={periodKey} onValueChange={(value) => setPeriodKey(value)}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PERIOD_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={() => void loadReport()} disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Refresh
                  </Button>
                </div>
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
                  <h3 className="text-lg font-semibold">Gagal Memuat Laporan Lengkap</h3>
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
                    {BadgeIcon && (
                      <Badge variant="outline" className={`gap-1 ${badgeConfig?.className ?? ""}`}>
                        <BadgeIcon className="h-3 w-3" />
                        {connection.state_label}
                      </Badge>
                    )}
                    {connection.plugin_version ? <Badge variant="outline">Plugin v{connection.plugin_version}</Badge> : null}
                    <Badge variant="outline">{activePeriodOption.label}</Badge>
                    <span>Last seen: {formatRelativeTime(connection.last_seen_at)}</span>
                    <span>Tracking: {connection.tracking_state_label}</span>
                    <span>Last tracking: {formatRelativeTime(connection.tracking_last_seen_at)}</span>
                    <span>Last sync: {formatRelativeTime(connection.last_sync_at)}</span>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Activity className="h-4 w-4" />
                          Health Koneksi Plugin
                        </CardTitle>
                        <CardDescription>{connection.state_message}</CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
                        <div className="rounded-lg border bg-muted/20 p-3">
                          <p className="text-xs text-muted-foreground">Site URL Snapshot</p>
                          <p className="mt-1 break-all font-medium">{connection.site_url_snapshot || "-"}</p>
                        </div>
                        <div className="rounded-lg border bg-muted/20 p-3">
                          <p className="text-xs text-muted-foreground">Capabilities</p>
                          <p className="mt-1 font-medium">{connection.capabilities.join(", ") || "-"}</p>
                        </div>
                        <div className="rounded-lg border bg-muted/20 p-3">
                          <p className="text-xs text-muted-foreground">Tracking Status</p>
                          <p className="mt-1 font-medium">{connection.tracking_state_label}</p>
                        </div>
                        <div className="rounded-lg border bg-muted/20 p-3">
                          <p className="text-xs text-muted-foreground">Tracking Terakhir</p>
                          <p className="mt-1 font-medium">{formatReportClock(connection.tracking_last_seen_at)}</p>
                        </div>
                        <div className="rounded-lg border bg-muted/20 p-3">
                          <p className="text-xs text-muted-foreground">Registered</p>
                          <p className="mt-1 font-medium">{formatReportClock(connection.registered_at)}</p>
                        </div>
                        <div className="rounded-lg border bg-muted/20 p-3">
                          <p className="text-xs text-muted-foreground">Snapshot Terakhir</p>
                          <p className="mt-1 font-medium">{formatReportClock(connection.last_sync_at)}</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className={highlightCardStyle(report.highlight.tone)}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <BarChart3 className="h-4 w-4" />
                          Highlight
                        </CardTitle>
                        <CardDescription>Insight utama untuk permukaan laporan penuh</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="font-medium">{report.highlight.title}</p>
                        <p className="mt-2 text-sm text-muted-foreground">{report.highlight.message}</p>
                        <div className="mt-4 rounded-lg border bg-muted/20 p-3 text-sm">
                          <p className="text-xs text-muted-foreground">Tracking Mode</p>
                          <p className="mt-1 font-medium">{connection.tracking_mode || "-"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{connection.tracking_state_message}</p>
                        </div>
                        {connection.last_error ? (
                          <div className="mt-4 rounded-lg border border-red-600/20 bg-red-500/5 p-3 text-sm text-red-700">
                            <p className="font-medium">Last error</p>
                            <p className="mt-1">{connection.last_error}</p>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  </div>

                  {!snapshot ? (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <Clock className="mb-4 h-8 w-8 text-blue-500" />
                        <h3 className="text-lg font-semibold">Snapshot laporan belum tersedia</h3>
                        <p className="mt-2 max-w-xl text-sm text-muted-foreground">{connection.state_message}</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <Card>
                          <CardContent className="flex items-center gap-3 p-4">
                            <div className="rounded-lg bg-blue-500/10 p-2">
                              <Users className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-2xl font-bold">{payload?.summary_metrics?.login_count ?? 0}</p>
                              <p className="text-xs text-muted-foreground">Total Login</p>
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="flex items-center gap-3 p-4">
                            <div className="rounded-lg bg-green-500/10 p-2">
                              <Activity className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                              <p className="text-2xl font-bold">{payload?.summary_metrics?.active_users ?? 0}</p>
                              <p className="text-xs text-muted-foreground">Pengguna Aktif</p>
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="flex items-center gap-3 p-4">
                            <div className="rounded-lg bg-purple-500/10 p-2">
                              <FileText className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                              <p className="text-2xl font-bold">{payload?.summary_metrics?.submissions ?? 0}</p>
                              <p className="text-xs text-muted-foreground">Submissions</p>
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="flex items-center gap-3 p-4">
                            <div className="rounded-lg bg-amber-500/10 p-2">
                              <Clock className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                              <p className="text-2xl font-bold">{payload?.summary_metrics?.avg_online_label ?? "0 m"}</p>
                              <p className="text-xs text-muted-foreground">Rata-rata Sesi</p>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Users className="h-4 w-4" />
                            User Status
                          </CardTitle>
                          <CardDescription>Ringkasan status pengguna per enrollments, completion, dan grade</CardDescription>
                        </CardHeader>
                        <CardContent>
                          {(payload?.user_status?.length ?? 0) > 0 ? (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Pengguna</TableHead>
                                  <TableHead>Username</TableHead>
                                  <TableHead>Email</TableHead>
                                  <TableHead>Role</TableHead>
                                  <TableHead>Kursus</TableHead>
                                  <TableHead>Enrolment</TableHead>
                                  <TableHead>Enrolled On</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead className="text-right">Avg Grade</TableHead>
                                  <TableHead>Last Action</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {payload!.user_status.map((row, index) => (
                                  <TableRow key={`${row.user_id}-${row.course_id}-${index}`}>
                                    <TableCell className="font-medium">{row.user_name}</TableCell>
                                    <TableCell>{row.username || "-"}</TableCell>
                                    <TableCell>{row.email || "-"}</TableCell>
                                    <TableCell>{row.role_label}</TableCell>
                                    <TableCell>{row.course_name}</TableCell>
                                    <TableCell>{row.enrolment_method_label}</TableCell>
                                    <TableCell>{formatReportClock(row.enrolled_on)}</TableCell>
                                    <TableCell>{row.status_label}</TableCell>
                                    <TableCell className="text-right">{row.average_grade.toFixed(1)}</TableCell>
                                    <TableCell>{formatReportClock(row.last_action_at)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          ) : (
                            <EmptyTableMessage />
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <BookOpen className="h-4 w-4" />
                            Activity Stats Summary
                          </CardTitle>
                          <CardDescription>Agregasi aktivitas tenant per kursus dan komponen</CardDescription>
                        </CardHeader>
                        <CardContent>
                          {(payload?.activity_stats_summary?.length ?? 0) > 0 ? (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Kursus</TableHead>
                                  <TableHead>Module</TableHead>
                                  <TableHead>Komponen</TableHead>
                                  <TableHead>Aktivitas</TableHead>
                                  <TableHead className="text-right">Visits</TableHead>
                                  <TableHead className="text-right">Time Spent</TableHead>
                                  <TableHead>First Access</TableHead>
                                  <TableHead>Created</TableHead>
                                  <TableHead className="text-right">Completed</TableHead>
                                  <TableHead className="text-right">Events</TableHead>
                                  <TableHead className="text-right">Users</TableHead>
                                  <TableHead>Last Activity</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {payload!.activity_stats_summary.map((row, index) => (
                                  <TableRow key={`${row.course_id}-${row.activity_label}-${index}`}>
                                    <TableCell className="font-medium">{row.course_name || "Situs"}</TableCell>
                                    <TableCell>{row.module_type || "-"}</TableCell>
                                    <TableCell>{row.component_name}</TableCell>
                                    <TableCell>{row.activity_label}</TableCell>
                                    <TableCell className="text-right">{row.visits}</TableCell>
                                    <TableCell className="text-right">{row.time_spent_label}</TableCell>
                                    <TableCell>{formatReportClock(row.first_access_at)}</TableCell>
                                    <TableCell>{formatReportClock(row.created_at)}</TableCell>
                                    <TableCell className="text-right">{row.num_completed}</TableCell>
                                    <TableCell className="text-right">{row.total_events}</TableCell>
                                    <TableCell className="text-right">{row.unique_users}</TableCell>
                                    <TableCell>{formatReportClock(row.last_activity_at)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          ) : (
                            <EmptyTableMessage />
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <GraduationCap className="h-4 w-4" />
                            Quiz Activity Detail
                          </CardTitle>
                          <CardDescription>Detail attempt quiz per pengguna pada periode aktif</CardDescription>
                        </CardHeader>
                        <CardContent>
                          {(payload?.quiz_activity_detail?.length ?? 0) > 0 ? (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Quiz</TableHead>
                                  <TableHead>Kursus</TableHead>
                                  <TableHead>Pengguna</TableHead>
                                  <TableHead>Email</TableHead>
                                  <TableHead className="text-right">Attempts</TableHead>
                                  <TableHead className="text-right">Finished</TableHead>
                                  <TableHead className="text-right">Best</TableHead>
                                  <TableHead className="text-right">Average</TableHead>
                                  <TableHead className="text-right">Lowest</TableHead>
                                  <TableHead className="text-right">Time Spent</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Completed At</TableHead>
                                  <TableHead>Last Attempt</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {payload!.quiz_activity_detail.map((row, index) => (
                                  <TableRow key={`${row.quiz_id}-${row.user_id}-${index}`}>
                                    <TableCell className="font-medium">{row.quiz_name}</TableCell>
                                    <TableCell>{row.course_name}</TableCell>
                                    <TableCell>{row.user_name}</TableCell>
                                    <TableCell>{row.email || "-"}</TableCell>
                                    <TableCell className="text-right">{row.attempts}</TableCell>
                                    <TableCell className="text-right">{row.finished_attempts}</TableCell>
                                    <TableCell className="text-right">{Number(row.best_score ?? 0).toFixed(1)}</TableCell>
                                    <TableCell className="text-right">{Number(row.average_score ?? 0).toFixed(1)}</TableCell>
                                    <TableCell className="text-right">{Number(row.lowest_score ?? 0).toFixed(1)}</TableCell>
                                    <TableCell className="text-right">{row.time_spent_label || "0 m"}</TableCell>
                                    <TableCell>{row.status_label}</TableCell>
                                    <TableCell>{formatReportClock(row.completion_at)}</TableCell>
                                    <TableCell>{formatReportClock(row.last_attempt_at)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          ) : (
                            <EmptyTableMessage />
                          )}
                        </CardContent>
                      </Card>

                      <div className="grid gap-4 xl:grid-cols-2">
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Course Completion Summary</CardTitle>
                            <CardDescription>Progres penyelesaian per kursus</CardDescription>
                          </CardHeader>
                          <CardContent>
                            {(payload?.course_completion_summary?.length ?? 0) > 0 ? (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Kursus</TableHead>
                                    <TableHead className="text-right">Enrolled</TableHead>
                                    <TableHead className="text-right">Completed</TableHead>
                                    <TableHead className="text-right">In Progress</TableHead>
                                    <TableHead className="text-right">Belum Mulai</TableHead>
                                    <TableHead className="text-right">Rate</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {payload!.course_completion_summary.map((row) => (
                                    <TableRow key={row.course_id}>
                                      <TableCell className="font-medium">{row.course_name}</TableCell>
                                      <TableCell className="text-right">{row.enrolled}</TableCell>
                                      <TableCell className="text-right">{row.completed}</TableCell>
                                      <TableCell className="text-right">{row.in_progress}</TableCell>
                                      <TableCell className="text-right">{row.not_started}</TableCell>
                                      <TableCell className="text-right">{row.completion_rate}%</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            ) : (
                              <EmptyTableMessage />
                            )}
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Grade Recap</CardTitle>
                            <CardDescription>Rekap nilai per kursus</CardDescription>
                          </CardHeader>
                          <CardContent>
                            {(payload?.grade_recap_per_course?.length ?? 0) > 0 ? (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Kursus</TableHead>
                                    <TableHead className="text-right">Rata-rata</TableHead>
                                    <TableHead className="text-right">Tertinggi</TableHead>
                                    <TableHead className="text-right">Terendah</TableHead>
                                    <TableHead className="text-right">Lulus</TableHead>
                                    <TableHead className="text-right">Gagal</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {payload!.grade_recap_per_course.map((row) => (
                                    <TableRow key={row.course_id}>
                                      <TableCell className="font-medium">{row.course_name}</TableCell>
                                      <TableCell className="text-right">{row.average_grade.toFixed(1)}</TableCell>
                                      <TableCell className="text-right">{row.highest_grade.toFixed(1)}</TableCell>
                                      <TableCell className="text-right">{row.lowest_grade.toFixed(1)}</TableCell>
                                      <TableCell className="text-right">{row.passed}</TableCell>
                                      <TableCell className="text-right">{row.failed}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            ) : (
                              <EmptyTableMessage />
                            )}
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">User Activity Summary</CardTitle>
                            <CardDescription>Ringkasan aktivitas per pengguna</CardDescription>
                          </CardHeader>
                          <CardContent>
                            {(payload?.user_activity_summary?.length ?? 0) > 0 ? (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Pengguna</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead className="text-right">Sesi</TableHead>
                                    <TableHead className="text-right">Online</TableHead>
                                    <TableHead className="text-right">Submissions</TableHead>
                                    <TableHead>Last Action</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {payload!.user_activity_summary.map((row) => (
                                    <TableRow key={row.user_id}>
                                      <TableCell className="font-medium">{row.user_name}</TableCell>
                                      <TableCell>{row.role_label}</TableCell>
                                      <TableCell className="text-right">{row.sessions}</TableCell>
                                      <TableCell className="text-right">{row.total_online_label}</TableCell>
                                      <TableCell className="text-right">{row.submissions}</TableCell>
                                      <TableCell>{formatReportClock(row.last_action_at)}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            ) : (
                              <EmptyTableMessage />
                            )}
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Recent Activity</CardTitle>
                            <CardDescription>Log aktivitas terbaru dari snapshot tenant</CardDescription>
                          </CardHeader>
                          <CardContent>
                            {(payload?.recent_activity?.length ?? 0) > 0 ? (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Pengguna</TableHead>
                                    <TableHead>Aksi</TableHead>
                                    <TableHead>Waktu</TableHead>
                                    <TableHead>IP</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {payload!.recent_activity.map((row, index) => (
                                    <TableRow key={`${row.user_name}-${row.occurred_at}-${index}`}>
                                      <TableCell className="font-medium">{row.user_name}</TableCell>
                                      <TableCell>{row.action}</TableCell>
                                      <TableCell>{formatReportClock(row.occurred_at)}</TableCell>
                                      <TableCell>{row.ip_address || "-"}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            ) : (
                              <EmptyTableMessage />
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    </>
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
