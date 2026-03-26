'use client'

import Link from "next/link"
import { use, useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Footer } from "@/components/layout/footer"
import { Header } from "@/components/layout/header"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
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
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock,
  FileText,
  HelpCircle,
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
import {
  SiteReportActivityTrendChart,
  SiteReportCourseCompletionChart,
  SiteReportUserStatusDistributionChart,
} from "@/components/dashboard/site-report-charts"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  buildSiteFullReportHref,
  buildSiteReportDetailHref,
  normalizeSiteReportInsightKey,
  type SiteReportInsightKey,
} from "@/lib/site-report-sections"

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
      return "Cocok untuk monitoring ujian, kelas live, atau deadline yang sedang berjalan hari ini."
    case "last_30_days":
      return "Cocok untuk melihat tren belajar yang lebih panjang dan perubahan perilaku tenant."
    case "this_month":
      return "Cocok untuk memantau performa bulan berjalan tanpa menunggu bulan selesai."
    case "last_month":
      return "Cocok untuk evaluasi bulanan dan perbandingan dengan kondisi saat ini."
    default:
      return "Pilihan paling stabil untuk overview tenant karena tidak terlalu sempit dan tidak terlalu panjang."
  }
}

function normalizePeriodKey(value?: string | null) {
  return PERIOD_OPTIONS.some((option) => option.value === value) ? value! : DEFAULT_PERIOD_KEY
}

function normalizeCourseID(value?: string | null) {
  if (!value) {
    return null
  }
  const parsed = Number.parseInt(value, 10)
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

function formatGradeValue(value?: number | null): string {
  return typeof value === "number" ? value.toFixed(1) : "-"
}

function formatPercentageValue(value?: number | null): string {
  return typeof value === "number" ? `${value.toFixed(1)}%` : "-"
}

function formatCount(value: number): string {
  return value.toLocaleString("id-ID")
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

function shouldExpandDiagnostics(connection?: SiteReportConnectionStatus | null) {
  if (!connection) {
    return false
  }

  switch (connection.state) {
    case "synced":
    case "tracking_active":
    case "synced_no_activity":
      return false
    default:
      return true
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

function ReportEmptyState({
  state,
  connection,
  periodLabel,
}: {
  state: "no_snapshot" | "no_activity"
  connection: SiteReportConnectionStatus
  periodLabel: string
}) {
  const configs = {
    no_snapshot: {
      icon: connection.state === "not_connected" ? AlertCircle : Clock,
      title: connection.state === "not_connected" ? "Plugin laporan belum terhubung" : "Snapshot laporan belum tersedia",
      description: connection.state_message,
      color: connection.state === "not_connected" ? "text-amber-500" : "text-blue-500",
    },
    no_activity: {
      icon: Info,
      title: "Belum Ada Aktivitas",
      description: `Sinkronisasi berhasil, tetapi belum ada aktivitas terukur pada ${periodLabel.toLowerCase()}. Halaman overview akan lebih informatif ketika tenant mulai aktif digunakan.`,
      color: "text-muted-foreground",
    },
  }

  const config = configs[state]
  const Icon = config.icon

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className={`mb-4 rounded-full bg-muted p-4 ${config.color}`}>
        <Icon className="h-8 w-8" />
      </div>
      <h3 className="text-lg font-semibold">{config.title}</h3>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">{config.description}</p>
    </div>
  )
}

function MetricCard({
  icon: Icon,
  iconClassName,
  iconWrapperClassName,
  value,
  label,
  helperText,
}: {
  icon: typeof Users
  iconClassName: string
  iconWrapperClassName: string
  value: string | number
  label: string
  helperText: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`rounded-lg p-2 ${iconWrapperClassName}`}>
          <Icon className={`h-5 w-5 ${iconClassName}`} />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <p>{label}</p>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="inline-flex items-center rounded-sm text-muted-foreground transition-colors hover:text-foreground" aria-label={`Penjelasan ${label}`}>
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8} className="max-w-56">
                {helperText}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function PreviewHeader({
  title,
  description,
  href,
}: {
  title: string
  description: string
  href: string
}) {
  return (
    <CardHeader>
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Button asChild variant="link" size="sm" className="h-auto px-0 text-xs">
          <Link href={href} aria-label={`Lihat detail ${title}`}>
            Lihat detail
          </Link>
        </Button>
      </div>
    </CardHeader>
  )
}

function OperationalCountCard({
  label,
  count,
  href,
}: {
  label: string
  count: number
  href: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold">{formatCount(count)}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={href}>Buka detail</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function CompactDetailLink({
  label,
  count,
  href,
}: {
  label: string
  count: number
  href: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2 text-sm transition-colors hover:bg-muted/40"
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{formatCount(count)}</span>
    </Link>
  )
}

export default function SiteFullReportPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const [site, setSite] = useState<SiteSummary | null>(null)
  const [report, setReport] = useState<SiteReportFullResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [periodKey, setPeriodKey] = useState(() => normalizePeriodKey(searchParams.get("period_key")))
  const [courseID, setCourseID] = useState<number | null>(() => normalizeCourseID(searchParams.get("course_id")))
  const [activeInsight, setActiveInsight] = useState<SiteReportInsightKey>(
    () => normalizeSiteReportInsightKey(searchParams.get("insight"), DEFAULT_INSIGHT_CATEGORY) ?? DEFAULT_INSIGHT_CATEGORY,
  )
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)

  useEffect(() => {
    const nextPeriodKey = normalizePeriodKey(searchParams.get("period_key"))
    setPeriodKey((current) => (current === nextPeriodKey ? current : nextPeriodKey))
    const nextCourseID = normalizeCourseID(searchParams.get("course_id"))
    setCourseID((current) => (current === nextCourseID ? current : nextCourseID))
    const nextInsight = normalizeSiteReportInsightKey(searchParams.get("insight"), DEFAULT_INSIGHT_CATEGORY) ?? DEFAULT_INSIGHT_CATEGORY
    setActiveInsight((current) => (current === nextInsight ? current : nextInsight))
  }, [searchParams])

  useEffect(() => {
    if (searchParams.get("insight")) {
      return
    }
    router.replace(buildSiteFullReportHref(subdomain, periodKey, courseID, activeInsight), { scroll: false })
  }, [activeInsight, courseID, periodKey, router, searchParams, subdomain])

  const loadReport = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const siteResponse = await api.getSiteBySubdomain(subdomain)
      const reportResponse = await api.getSiteFullReport(siteResponse.site.id, {
        snapshotKey: REPORT_SNAPSHOT_KEY,
        periodKey,
        courseID: courseID ?? undefined,
      })
      setSite(siteResponse.site)
      setReport(reportResponse)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat laporan lengkap")
    } finally {
      setLoading(false)
    }
  }, [courseID, periodKey, subdomain])

  const updateFilters = useCallback((next: { periodKey?: string; courseID?: number | null; insight?: SiteReportInsightKey | null }) => {
    const nextPeriodKey = next.periodKey ?? periodKey
    const nextCourseID = next.courseID === undefined ? courseID : next.courseID
    const nextInsight = next.insight === undefined ? activeInsight : (next.insight ?? DEFAULT_INSIGHT_CATEGORY)
    setPeriodKey(nextPeriodKey)
    setCourseID(nextCourseID)
    setActiveInsight(nextInsight)
    router.replace(buildSiteFullReportHref(subdomain, nextPeriodKey, nextCourseID, nextInsight), { scroll: false })
  }, [activeInsight, courseID, periodKey, router, subdomain])

  useEffect(() => {
    void loadReport()
  }, [loadReport])

  const handlePeriodChange = useCallback((value: string) => {
    updateFilters({ periodKey: normalizePeriodKey(value) })
  }, [updateFilters])

  const connection = report?.connection ?? null
  const snapshot = report?.snapshot ?? null
  const payload = snapshot?.payload
  const activePeriodOption = PERIOD_OPTIONS.find((option) => option.value === periodKey) ?? PERIOD_OPTIONS[0]
  const availableCourses = payload?.available_courses ?? []
  const selectedCourseID = payload?.selected_course_id ?? courseID
  const selectedCourseValue = selectedCourseID ? String(selectedCourseID) : "all"
  const selectedCourse = availableCourses.find((course) => course.course_id === selectedCourseID) ?? null

  useEffect(() => {
    setDiagnosticsOpen(shouldExpandDiagnostics(connection))
  }, [connection?.state])

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
                    <h1 className="text-2xl font-bold tracking-tight">Laporan Tenant</h1>
                    <p className="text-sm text-muted-foreground">
                      {site?.name ?? subdomain} · dashboard keputusan untuk melihat kesehatan tenant, tren belajar, dan area yang paling perlu tindakan.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Select value={periodKey} onValueChange={handlePeriodChange}>
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
                  {availableCourses.length > 0 ? (
                    <Select value={selectedCourseValue} onValueChange={(value) => updateFilters({ courseID: value === "all" ? null : Number(value) })}>
                      <SelectTrigger className="w-[220px]">
                        <SelectValue placeholder="Semua kursus" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua kursus</SelectItem>
                        {availableCourses.map((course) => (
                          <SelectItem key={course.course_id} value={String(course.course_id)}>
                            {course.course_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                  <Button variant="outline" onClick={() => void loadReport()} disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Refresh
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
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>Periode: <span className="font-medium text-foreground">{activePeriodOption.label}</span></span>
                    <span>&bull;</span>
                    <span>
                      Kursus:{" "}
                      <span className="font-medium text-foreground">
                        {selectedCourse ? selectedCourse.course_name : "Semua kursus"}
                      </span>
                    </span>
                    <span>&bull;</span>
                    <span>Data diperbarui {formatRelativeTime(connection.last_sync_at)}</span>
                    <span>&bull;</span>
                    <span>Pelacakan browser {connection.tracking_state_label.toLowerCase()}</span>
                  </div>

                  {selectedCourse && payload?.course_filter_scope_note ? (
                    <p className="text-xs text-muted-foreground">
                      Filter kursus aktif: <span className="font-medium text-foreground">{selectedCourse.course_name}</span>.{" "}
                      {payload.course_filter_scope_note}
                    </p>
                  ) : null}

                  <Card className={highlightCardStyle(report.highlight.tone)}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <BarChart3 className="h-4 w-4" />
                        Prioritas Saat Ini
                      </CardTitle>
                      <CardDescription>Ringkasan paling penting untuk dibaca lebih dulu</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="font-medium">{report.highlight.title}</p>
                      <p className="mt-2 text-sm text-muted-foreground">{report.highlight.message}</p>
                    </CardContent>
                  </Card>

                  {!snapshot ? (
                    <ReportEmptyState state="no_snapshot" connection={connection} periodLabel={activePeriodOption.label} />
                  ) : (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <MetricCard icon={Users} iconClassName="text-blue-600" iconWrapperClassName="bg-blue-500/10" value={payload?.summary_metrics?.login_count ?? 0} label="Total Login" helperText="Jumlah login yang tercatat selama periode yang dipilih." />
                        <MetricCard icon={Activity} iconClassName="text-green-600" iconWrapperClassName="bg-green-500/10" value={payload?.summary_metrics?.active_users ?? 0} label="Pengguna Aktif" helperText="Jumlah pengguna unik yang melakukan aktivitas terlacak pada periode ini." />
                        <MetricCard icon={FileText} iconClassName="text-violet-600" iconWrapperClassName="bg-violet-500/10" value={payload?.summary_metrics?.submissions ?? 0} label="Pengumpulan Tugas" helperText="Jumlah submission tugas yang tercatat pada periode ini." />
                        <MetricCard icon={CheckCircle2} iconClassName="text-emerald-600" iconWrapperClassName="bg-emerald-500/10" value={payload?.summary_metrics?.completions ?? 0} label="Penyelesaian" helperText="Jumlah aktivitas atau progres belajar yang tercatat selesai." />
                      </div>

                      {!connection.has_activity ? (
                        <ReportEmptyState state="no_activity" connection={connection} periodLabel={activePeriodOption.label} />
                      ) : (
                        <>
                          <div className="grid gap-4 xl:grid-cols-2">
                            <Card>
                              <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                  <Activity className="h-4 w-4" />
                                  Tren Aktivitas Harian
                                </CardTitle>
                                <CardDescription>Perubahan login, pengguna aktif, submissions, dan completions selama periode aktif</CardDescription>
                              </CardHeader>
                              <CardContent>
                                {(payload?.daily_trend?.length ?? 0) > 0 ? (
                                  <SiteReportActivityTrendChart rows={payload?.daily_trend ?? []} />
                                ) : (
                                  <p className="text-sm text-muted-foreground">Belum ada tren aktivitas harian.</p>
                                )}
                              </CardContent>
                            </Card>

                            <Card>
                              <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                  <BookOpen className="h-4 w-4" />
                                  Progres Per Kursus
                                </CardTitle>
                                <CardDescription>Distribusi progres kursus yang paling penting untuk dipantau</CardDescription>
                              </CardHeader>
                              <CardContent>
                                {(payload?.course_completion_summary?.length ?? 0) > 0 ? (
                                  <SiteReportCourseCompletionChart rows={payload?.course_completion_summary ?? []} limit={4} />
                                ) : (
                                  <p className="text-sm text-muted-foreground">Belum ada data completion kursus.</p>
                                )}
                              </CardContent>
                            </Card>
                          </div>

                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base">Fokus Insight</CardTitle>
                              <CardDescription>Pilih kategori yang ingin dibaca lebih dalam tanpa membuka semua preview sekaligus.</CardDescription>
                            </CardHeader>
                            <CardContent>
                              <Tabs
                                value={activeInsight}
                                onValueChange={(value) =>
                                  updateFilters({
                                    insight:
                                      normalizeSiteReportInsightKey(value, DEFAULT_INSIGHT_CATEGORY) ?? DEFAULT_INSIGHT_CATEGORY,
                                  })
                                }
                                className="space-y-4"
                              >
                                <TabsList className="grid h-auto w-full grid-cols-2 lg:grid-cols-4">
                                  <TabsTrigger value="people">Orang</TabsTrigger>
                                  <TabsTrigger value="tasks">Tugas</TabsTrigger>
                                  <TabsTrigger value="courses">Kursus</TabsTrigger>
                                  <TabsTrigger value="engagement">Engagement</TabsTrigger>
                                </TabsList>

                                <TabsContent value="people" className="space-y-4">
                                  <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                                    <Card>
                                      <PreviewHeader
                                        title="Peserta Perlu Perhatian"
                                        description="Peserta dengan sinyal risiko tertinggi pada periode aktif."
                                        href={buildSiteReportDetailHref(subdomain, periodKey, { section: "at-risk-users", courseId: selectedCourseID, insight: "people" })}
                                      />
                                      <CardContent>
                                        {(payload?.at_risk_users?.length ?? 0) > 0 ? (
                                          <div className="space-y-3 text-sm">
                                            {payload!.at_risk_users.slice(0, 3).map((row, index) => (
                                              <div key={`${row.user_name}-${row.course_name}-${index}`} className="rounded-lg border bg-muted/20 p-3">
                                                <div className="flex items-start justify-between gap-3">
                                                  <div>
                                                    <p className="font-medium">{row.user_name}</p>
                                                    <p className="text-xs text-muted-foreground">{row.course_name || "Tanpa kursus"}</p>
                                                  </div>
                                                  <Badge variant="outline" className={riskBadgeClass(row.risk_score)}>
                                                    Risiko {row.risk_score}
                                                  </Badge>
                                                </div>
                                                <p className="mt-2 text-xs text-muted-foreground">{row.risk_reason}</p>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-sm text-muted-foreground">Belum ada peserta berisiko pada periode ini.</p>
                                        )}
                                      </CardContent>
                                    </Card>

                                    <Card>
                                      <PreviewHeader
                                        title="Distribusi Status Peserta"
                                        description="Komposisi progres peserta dan akses cepat ke detail orang."
                                        href={buildSiteReportDetailHref(subdomain, periodKey, { section: "user-status", courseId: selectedCourseID, insight: "people" })}
                                      />
                                      <CardContent className="space-y-4">
                                        {(payload?.user_status_distribution?.length ?? 0) > 0 ? (
                                          <SiteReportUserStatusDistributionChart rows={payload?.user_status_distribution ?? []} />
                                        ) : (
                                          <p className="text-sm text-muted-foreground">Belum ada distribusi status peserta.</p>
                                        )}
                                        <div className="space-y-2 border-t pt-3">
                                          <CompactDetailLink
                                            label="Detail status peserta"
                                            count={payload?.section_counts?.user_status ?? 0}
                                            href={buildSiteReportDetailHref(subdomain, periodKey, { section: "user-status", courseId: selectedCourseID, insight: "people" })}
                                          />
                                          <p className="text-xs text-muted-foreground">
                                            Aktivitas pengguna tersedia untuk tindak lanjut operasional:{" "}
                                            <Link
                                              href={buildSiteReportDetailHref(subdomain, periodKey, { section: "user-activity-summary", courseId: selectedCourseID, insight: "people" })}
                                              className="font-medium text-foreground underline-offset-4 hover:underline"
                                            >
                                              {formatCount(payload?.section_counts?.user_activity_summary ?? 0)} baris aktivitas
                                            </Link>
                                            .
                                          </p>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  </div>
                                </TabsContent>

                                <TabsContent value="tasks" className="space-y-4">
                                  <Card>
                                    <PreviewHeader
                                      title="Tugas Perlu Tindak Lanjut"
                                      description="Pengumpulan tugas yang terlambat, kosong, atau perlu tindak lanjut."
                                      href={buildSiteReportDetailHref(subdomain, periodKey, { section: "assignment-submission-detail", courseId: selectedCourseID, insight: "tasks" })}
                                    />
                                    <CardContent>
                                      {(payload?.assignment_submission_detail?.length ?? 0) > 0 ? (
                                        <div className="space-y-3 text-sm">
                                          {payload!.assignment_submission_detail.slice(0, 3).map((row, index) => (
                                            <div key={`${row.assignment_id}-${row.user_id}-${index}`} className="rounded-lg border bg-muted/20 p-3">
                                              <div className="flex items-start justify-between gap-3">
                                                <div>
                                                  <p className="font-medium">{row.assignment_name}</p>
                                                  <p className="text-xs text-muted-foreground">{row.user_name} · {row.course_name}</p>
                                                </div>
                                                <Badge variant="outline" className={assignmentStatusBadgeClass(row.status_key)}>
                                                  {row.status_label}
                                                </Badge>
                                              </div>
                                              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                                                <span>Due: {formatReportClock(row.due_at)}</span>
                                                <span>Submit: {formatReportClock(row.submitted_at)}</span>
                                                <span>Nilai: {formatGradeValue(row.grade)}</span>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-sm text-muted-foreground">Belum ada assignment yang perlu ditindaklanjuti.</p>
                                      )}
                                    </CardContent>
                                  </Card>
                                </TabsContent>

                                <TabsContent value="courses" className="space-y-4">
                                  <div className="grid gap-4 xl:grid-cols-2">
                                    <Card>
                                      <PreviewHeader
                                        title="Kesehatan Kursus"
                                        description="Kursus dengan progres yang paling perlu dipantau."
                                        href={buildSiteReportDetailHref(subdomain, periodKey, { section: "course-completion-summary", courseId: selectedCourseID, insight: "courses" })}
                                      />
                                      <CardContent>
                                        {(payload?.course_completion_summary?.length ?? 0) > 0 ? (
                                          <div className="space-y-3 text-sm">
                                            {payload!.course_completion_summary.slice(0, 3).map((row) => (
                                              <div key={row.course_id} className="rounded-lg border bg-muted/20 p-3">
                                                <div className="flex items-center justify-between gap-3">
                                                  <p className="font-medium">{row.course_name}</p>
                                                  <Badge variant="outline">{row.completion_rate}%</Badge>
                                                </div>
                                                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                                  <span>Enrolled: {row.enrolled}</span>
                                                  <span>Completed: {row.completed}</span>
                                                  <span>In progress: {row.in_progress}</span>
                                                  <span>Belum mulai: {row.not_started}</span>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-sm text-muted-foreground">Belum ada data course health.</p>
                                        )}
                                      </CardContent>
                                    </Card>

                                    <Card>
                                      <PreviewHeader
                                        title="Aktivitas Terpadat"
                                        description="Aktivitas dengan traffic dan event tertinggi."
                                        href={buildSiteReportDetailHref(subdomain, periodKey, { section: "activity-stats-summary", courseId: selectedCourseID, insight: "courses" })}
                                      />
                                      <CardContent>
                                        {(payload?.activity_stats_summary?.length ?? 0) > 0 ? (
                                          <div className="space-y-3 text-sm">
                                            {payload!.activity_stats_summary.slice(0, 3).map((row, index) => (
                                              <div key={`${row.activity_id}-${index}`} className="rounded-lg border bg-muted/20 p-3">
                                                <p className="font-medium">{row.activity_label}</p>
                                                <p className="text-xs text-muted-foreground">{row.course_name || "Situs"}</p>
                                                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                                                  <span>Visits: {row.visits}</span>
                                                  <span>Events: {row.total_events}</span>
                                                  <span>Users: {row.unique_users}</span>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-sm text-muted-foreground">Belum ada hotspot aktivitas pada periode ini.</p>
                                        )}
                                      </CardContent>
                                    </Card>
                                  </div>
                                </TabsContent>

                                <TabsContent value="engagement" className="space-y-4">
                                  <div className="grid gap-4 xl:grid-cols-2">
                                    <Card>
                                      <PreviewHeader
                                        title="Percakapan Forum"
                                        description="Forum dengan interaksi paling aktif pada periode ini."
                                        href={buildSiteReportDetailHref(subdomain, periodKey, { section: "forum-engagement-summary", courseId: selectedCourseID, insight: "engagement" })}
                                      />
                                      <CardContent>
                                        {(payload?.forum_engagement_summary?.length ?? 0) > 0 ? (
                                          <div className="space-y-3 text-sm">
                                            {payload!.forum_engagement_summary.slice(0, 3).map((row, index) => (
                                              <div key={`${row.forum_id}-${index}`} className="rounded-lg border bg-muted/20 p-3">
                                                <p className="font-medium">{row.forum_name}</p>
                                                <p className="text-xs text-muted-foreground">{row.course_name || "Tanpa kursus"}</p>
                                                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                                                  <span>Diskusi: {row.discussion_count}</span>
                                                  <span>Post: {row.post_count}</span>
                                                  <span>Peserta aktif: {row.active_participants}</span>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-sm text-muted-foreground">Belum ada insight forum pada periode ini.</p>
                                        )}
                                      </CardContent>
                                    </Card>

                                    <Card>
                                      <PreviewHeader
                                        title="Kualitas Quiz"
                                        description="Pertanyaan quiz yang paling menonjol dan akses cepat ke detail attempt."
                                        href={buildSiteReportDetailHref(subdomain, periodKey, { section: "quiz-question-analysis", courseId: selectedCourseID, insight: "engagement" })}
                                      />
                                      <CardContent className="space-y-4">
                                        {(payload?.quiz_question_analysis?.length ?? 0) > 0 ? (
                                          <div className="space-y-3 text-sm">
                                            {payload!.quiz_question_analysis.slice(0, 3).map((row, index) => (
                                              <div key={`${row.quiz_id}-${row.question_id}-${index}`} className="rounded-lg border bg-muted/20 p-3">
                                                <p className="font-medium">{row.question_name}</p>
                                                <p className="text-xs text-muted-foreground">{row.quiz_name} · {row.course_name}</p>
                                                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                                                  <span>Attempts: {row.attempts}</span>
                                                  <span>Correct rate: {formatPercentageValue(row.correct_rate)}</span>
                                                  <span>Average: {formatPercentageValue(row.average_score)}</span>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-sm text-muted-foreground">Belum ada insight quiz pada periode ini.</p>
                                        )}
                                        <CompactDetailLink
                                          label="Aktivitas quiz"
                                          count={payload?.section_counts?.quiz_activity_detail ?? 0}
                                          href={buildSiteReportDetailHref(subdomain, periodKey, { section: "quiz-activity-detail", courseId: selectedCourseID, insight: "engagement" })}
                                        />
                                      </CardContent>
                                    </Card>
                                  </div>
                                </TabsContent>
                              </Tabs>
                            </CardContent>
                          </Card>

                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <AlertTriangle className="h-4 w-4 text-amber-600" />
                              Detail Operasional
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                              <OperationalCountCard label="Aktivitas Pengguna" count={payload?.section_counts?.user_activity_summary ?? 0} href={buildSiteReportDetailHref(subdomain, periodKey, { section: "user-activity-summary", courseId: selectedCourseID, insight: activeInsight })} />
                              <OperationalCountCard label="Detail Nilai" count={payload?.section_counts?.gradebook_detail ?? 0} href={buildSiteReportDetailHref(subdomain, periodKey, { section: "gradebook-detail", courseId: selectedCourseID, insight: activeInsight })} />
                              <OperationalCountCard label="Penyelesaian Aktivitas" count={payload?.section_counts?.activity_completion_detail ?? 0} href={buildSiteReportDetailHref(subdomain, periodKey, { section: "activity-completion-detail", courseId: selectedCourseID, insight: activeInsight })} />
                              <OperationalCountCard label="Aktivitas Quiz" count={payload?.section_counts?.quiz_activity_detail ?? 0} href={buildSiteReportDetailHref(subdomain, periodKey, { section: "quiz-activity-detail", courseId: selectedCourseID, insight: activeInsight })} />
                              <OperationalCountCard label="Aktivitas Terbaru" count={payload?.section_counts?.recent_activity ?? 0} href={buildSiteReportDetailHref(subdomain, periodKey, { section: "recent-activity", courseId: selectedCourseID, insight: activeInsight })} />
                            </div>
                          </div>
                        </>
                      )}

                          <Card>
                            <Accordion
                              type="single"
                          collapsible
                          value={diagnosticsOpen ? "diagnostics" : ""}
                          onValueChange={(value) => setDiagnosticsOpen(value === "diagnostics")}
                          className="w-full"
                        >
                          <AccordionItem value="diagnostics" className="border-b-0">
                            <AccordionTrigger className="px-6 hover:no-underline">
                              <div className="space-y-1">
                                <p className="text-base font-semibold">Status Data & Diagnostik</p>
                                <p className="text-sm font-normal text-muted-foreground">Gunakan bagian ini saat perlu mengecek koneksi plugin dan kesegaran data laporan.</p>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-6">
                              <div className="space-y-4 text-sm">
                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                  <div className="rounded-lg border bg-muted/20 p-3">
                                    <p className="text-xs text-muted-foreground">Status sinkronisasi</p>
                                    <p className="mt-1 font-medium">{connection.state_label}</p>
                                  </div>
                                  <div className="rounded-lg border bg-muted/20 p-3">
                                    <p className="text-xs text-muted-foreground">Versi plugin</p>
                                    <p className="mt-1 font-medium">{connection.plugin_version ? `v${connection.plugin_version}` : "-"}</p>
                                  </div>
                                  <div className="rounded-lg border bg-muted/20 p-3">
                                    <p className="text-xs text-muted-foreground">Pelacakan browser</p>
                                    <p className="mt-1 font-medium">{connection.tracking_state_label}</p>
                                  </div>
                                  <div className="rounded-lg border bg-muted/20 p-3">
                                    <p className="text-xs text-muted-foreground">Data diperbarui</p>
                                    <p className="mt-1 font-medium">{formatReportClock(connection.last_sync_at)}</p>
                                  </div>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div className="rounded-lg border bg-muted/20 p-3">
                                    <p className="text-xs text-muted-foreground">Data laporan dibuat</p>
                                    <p className="mt-1 font-medium">{formatReportClock(snapshot?.generated_at)}</p>
                                  </div>
                                  <div className="rounded-lg border bg-muted/20 p-3">
                                    <p className="text-xs text-muted-foreground">Aktivitas terakhir</p>
                                    <p className="mt-1 font-medium">{formatReportClock(connection.tracking_last_seen_at)}</p>
                                  </div>
                                </div>
                                {connection.state === "not_connected" ? (
                                  <div className="rounded-lg border border-amber-600/20 bg-amber-500/5 p-3">
                                    <p className="font-medium text-amber-800">Plugin laporan belum terhubung</p>
                                    <p className="mt-1 text-sm text-amber-700">
                                      Buka tab detail situs untuk melanjutkan setup koneksi dan mengambil connect token.
                                    </p>
                                    <Button asChild variant="outline" size="sm" className="mt-3">
                                      <Link href={`/situs/${subdomain}?tab=laporan`}>Buka Detail Situs</Link>
                                    </Button>
                                  </div>
                                ) : null}
                                <div className="space-y-3 border-t pt-3">
                                  <div className="rounded-lg border bg-muted/20 p-3">
                                    <p className="text-xs text-muted-foreground">Ringkasan data laporan</p>
                                    <p className="mt-1 font-medium">{connection.state_message}</p>
                                  </div>
                                  <div className="rounded-lg border bg-muted/20 p-3">
                                    <p className="text-xs text-muted-foreground">Site snapshot URL</p>
                                    <p className="mt-1 break-all font-medium">{connection.site_url_snapshot || "-"}</p>
                                  </div>
                                  <div className="rounded-lg border bg-muted/20 p-3">
                                    <p className="text-xs text-muted-foreground">Data diterima</p>
                                    <p className="mt-1 font-medium">{formatReportClock(snapshot?.received_at)}</p>
                                  </div>
                                </div>
                                {connection.last_error ? (
                                  <div className="rounded-lg border border-red-600/20 bg-red-500/5 p-3 text-sm text-red-700">
                                    <p className="font-medium">Error sinkronisasi terakhir</p>
                                    <p className="mt-1">{connection.last_error}</p>
                                  </div>
                                ) : null}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </Card>
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
