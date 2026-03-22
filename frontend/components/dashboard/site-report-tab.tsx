"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
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
  BarChart3,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  HelpCircle,
  Info,
  Loader2,
  RefreshCw,
  Users,
} from "lucide-react"
import {
  api,
  getSiteReportPluginAPIBaseURL,
  type SiteReportConnectionStatus,
  type SiteReportHighlight,
  type SiteReportSummaryResponse,
} from "@/lib/api"
import {
  SiteReportActivityTrendChart,
  SiteReportCourseCompletionChart,
} from "@/components/dashboard/site-report-charts"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  buildSiteFullReportHref,
  buildSiteReportTabHref,
  buildSiteReportDetailHref,
  normalizeSiteReportInsightKey,
  type SiteReportInsightKey,
} from "@/lib/site-report-sections"

interface SiteReportTabProps {
  siteID: string
  siteName: string
  siteSubdomain: string
}

type PeriodOption = {
  value: string
  label: string
}

const REPORT_SNAPSHOT_KEY = "reports_summary_v1"
const DEFAULT_PERIOD_KEY = "last_7_days"
const PERIOD_OPTIONS: PeriodOption[] = [
  { value: "today", label: "Hari Ini" },
  { value: "last_7_days", label: "7 Hari Terakhir" },
  { value: "last_30_days", label: "30 Hari Terakhir" },
  { value: "this_month", label: "Bulan Ini" },
  { value: "last_month", label: "Bulan Lalu" },
]
const DEFAULT_INSIGHT_CATEGORY: SiteReportInsightKey = "people"

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

function formatCapabilities(connection: SiteReportConnectionStatus): string {
  if (connection.capabilities.length === 0) {
    return "Belum ada capability yang dilaporkan"
  }
  if (connection.capabilities.length <= 3) {
    return connection.capabilities.join(", ")
  }
  return `${connection.capabilities.slice(0, 3).join(", ")} +${connection.capabilities.length - 3} lainnya`
}

function formatCount(value: number): string {
  return value.toLocaleString("id-ID")
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

function highlightCardStyle(highlight: SiteReportHighlight) {
  switch (highlight.tone) {
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
      description: `Sinkronisasi berhasil, tetapi belum ada aktivitas terukur pada ${periodLabel.toLowerCase()}. Overview akan lebih kaya begitu tenant mulai aktif digunakan.`,
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
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{config.description}</p>
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
            <ExternalLink className="h-3.5 w-3.5" />
            Lihat detail
          </Link>
        </Button>
      </div>
    </CardHeader>
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

export function SiteReportTab({ siteID, siteName, siteSubdomain }: SiteReportTabProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [summary, setSummary] = useState<SiteReportSummaryResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [periodKey, setPeriodKey] = useState(DEFAULT_PERIOD_KEY)
  const [activeInsight, setActiveInsight] = useState<SiteReportInsightKey>(DEFAULT_INSIGHT_CATEGORY)
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)
  const [connectToken, setConnectToken] = useState("")
  const [connectTokenLoading, setConnectTokenLoading] = useState(false)
  const [connectTokenError, setConnectTokenError] = useState<string | null>(null)
  const pluginAPIBaseURL = getSiteReportPluginAPIBaseURL()

  const fetchReport = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.getSiteReportSummary(siteID, {
        snapshotKey: REPORT_SNAPSHOT_KEY,
        periodKey,
      })
      setSummary(response)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat laporan")
    } finally {
      setLoading(false)
    }
  }, [siteID, periodKey])

  const fetchConnectToken = useCallback(async () => {
    setConnectTokenLoading(true)
    setConnectTokenError(null)
    try {
      const response = await api.issueSiteReportConnectToken(siteID)
      setConnectToken(response.registration_token)
      toast.success("Connect token siap digunakan")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal membuat connect token"
      setConnectTokenError(message)
      toast.error(message)
    } finally {
      setConnectTokenLoading(false)
    }
  }, [siteID])

  const copyConnectToken = useCallback(async () => {
    if (!connectToken) {
      return
    }
    try {
      await navigator.clipboard.writeText(connectToken)
      toast.success("Connect token disalin")
    } catch {
      toast.error("Gagal menyalin connect token")
    }
  }, [connectToken])

  useEffect(() => {
    void fetchReport()
  }, [fetchReport])

  const connection = summary?.connection ?? null
  const snapshot = summary?.snapshot ?? null
  const payload = snapshot?.payload
  const badgeConfig = connection ? connectionBadge(connection) : null
  const BadgeIcon = badgeConfig?.icon
  const showManualConnect = connection?.state === "not_connected"
  const activePeriodOption = PERIOD_OPTIONS.find((option) => option.value === periodKey) ?? PERIOD_OPTIONS[0]
  const fullReportHref = buildSiteFullReportHref(siteSubdomain, periodKey, null, activeInsight)

  useEffect(() => {
    setDiagnosticsOpen(shouldExpandDiagnostics(connection))
  }, [connection?.state])

  useEffect(() => {
    const nextInsight = normalizeSiteReportInsightKey(searchParams.get("insight"), DEFAULT_INSIGHT_CATEGORY)
    if (nextInsight && nextInsight !== activeInsight) {
      setActiveInsight(nextInsight)
    }
  }, [activeInsight, searchParams])

  useEffect(() => {
    if (searchParams.get("tab") !== "laporan" || searchParams.get("insight")) {
      return
    }
    router.replace(buildSiteReportTabHref(siteSubdomain, activeInsight), { scroll: false })
  }, [activeInsight, router, searchParams, siteSubdomain])

  const handleInsightChange = useCallback((value: string) => {
    const nextInsight = normalizeSiteReportInsightKey(value, DEFAULT_INSIGHT_CATEGORY) ?? DEFAULT_INSIGHT_CATEGORY
    setActiveInsight(nextInsight)
    router.replace(buildSiteReportTabHref(siteSubdomain, nextInsight), { scroll: false })
  }, [router, siteSubdomain])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Ringkasan Laporan</h2>
          <p className="text-sm text-muted-foreground">
            Jawaban cepat untuk kondisi tenant {siteName}: kesiapan data, angka inti, tren penggunaan, dan area yang paling perlu ditindaklanjuti.
          </p>
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
          <Button variant="outline" size="icon" onClick={() => void fetchReport()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <div className="flex items-start gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>
          <span className="font-medium text-foreground">{activePeriodOption.label}:</span> {periodUsageHint(periodKey)}
        </p>
      </div>

      {loading && !summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-lg border bg-muted" />
          ))}
        </div>
      )}

      {!loading && error && !summary && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="mb-4 h-8 w-8 text-destructive" />
          <h3 className="text-lg font-semibold">Gagal Memuat Laporan</h3>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => void fetchReport()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Coba Lagi
          </Button>
        </div>
      )}

      {summary && connection && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {BadgeIcon && (
              <Badge variant="outline" className={`gap-1 ${badgeConfig?.className ?? ""}`}>
                <BadgeIcon className="h-3 w-3" />
                {connection.state_label}
              </Badge>
            )}
            <Badge variant="outline">{activePeriodOption.label}</Badge>
            <span>Data diperbarui: {formatRelativeTime(connection.last_sync_at)}</span>
            <span>Aktivitas terlacak: {connection.tracking_state_label}</span>
          </div>

          <Card className={highlightCardStyle(summary.highlight)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4" />
                Prioritas Saat Ini
              </CardTitle>
              <CardDescription>Hal paling penting dari data laporan {activePeriodOption.label.toLowerCase()}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{summary.highlight.title}</p>
              <p className="mt-2 text-sm text-muted-foreground">{summary.highlight.message}</p>
            </CardContent>
          </Card>

          {!snapshot && <ReportEmptyState state="no_snapshot" connection={connection} periodLabel={activePeriodOption.label} />}

          {snapshot && (
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
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Activity className="h-4 w-4" />
                        Tren Aktivitas
                      </CardTitle>
                      <CardDescription>Perubahan penggunaan tenant yang paling cepat terbaca</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {(payload?.daily_trend?.length ?? 0) > 0 ? (
                        <SiteReportActivityTrendChart rows={payload?.daily_trend ?? []} compact />
                      ) : (
                        <p className="text-sm text-muted-foreground">Belum ada trend aktivitas untuk periode ini.</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Fokus Insight</CardTitle>
                      <CardDescription>Pilih area yang ingin dibaca lebih dalam tanpa menampilkan semua section sekaligus.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Tabs value={activeInsight} onValueChange={handleInsightChange} className="space-y-4">
                        <TabsList className="grid h-auto w-full grid-cols-2 lg:grid-cols-4">
                          <TabsTrigger value="people">Orang</TabsTrigger>
                          <TabsTrigger value="tasks">Tugas</TabsTrigger>
                          <TabsTrigger value="courses">Kursus</TabsTrigger>
                          <TabsTrigger value="engagement">Engagement</TabsTrigger>
                        </TabsList>

                        <TabsContent value="people" className="space-y-4">
                          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                            <Card>
                              <PreviewHeader
                                title="Peserta Perlu Perhatian"
                                description="Peserta dengan sinyal risiko tertinggi pada periode aktif"
                                href={buildSiteReportDetailHref(siteSubdomain, periodKey, { section: "at-risk-users", insight: "people" })}
                              />
                              <CardContent>
                                {(payload?.at_risk_users?.length ?? 0) > 0 ? (
                                  <div className="space-y-3 text-sm">
                                    {payload!.at_risk_users.slice(0, 3).map((row, index) => (
                                      <div key={`${row.email}-${index}`} className="rounded-lg border bg-muted/20 p-3">
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
                                title="Status Peserta"
                                description="Komposisi progres peserta dan pintasan ke detail operasional."
                                href={buildSiteReportDetailHref(siteSubdomain, periodKey, { section: "user-status", insight: "people" })}
                              />
                              <CardContent className="space-y-4">
                                {(payload?.user_status_distribution?.length ?? 0) > 0 ? (
                                  <div className="space-y-2 text-sm">
                                    {payload!.user_status_distribution.slice(0, 3).map((row) => (
                                      <div key={row.status_key} className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
                                        <span>{row.status_label}</span>
                                        <span className="font-semibold">{formatCount(row.total)}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground">Belum ada distribusi status peserta.</p>
                                )}
                                <div className="space-y-2">
                                  <CompactDetailLink
                                    label="Status peserta"
                                    count={payload?.section_counts?.user_status ?? 0}
                                    href={buildSiteReportDetailHref(siteSubdomain, periodKey, { section: "user-status", insight: "people" })}
                                  />
                                  <CompactDetailLink
                                    label="Aktivitas pengguna"
                                    count={payload?.section_counts?.user_activity_summary ?? 0}
                                    href={buildSiteReportDetailHref(siteSubdomain, periodKey, { section: "user-activity-summary", insight: "people" })}
                                  />
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        </TabsContent>

                        <TabsContent value="tasks" className="space-y-4">
                          <Card>
                            <PreviewHeader
                              title="Tugas Perlu Tindak Lanjut"
                              description="Submission yang terlambat, kosong, atau perlu dicek lebih lanjut."
                              href={buildSiteReportDetailHref(siteSubdomain, periodKey, { section: "assignment-submission-detail", insight: "tasks" })}
                            />
                            <CardContent>
                              {(payload?.assignment_submission_detail?.length ?? 0) > 0 ? (
                                <div className="space-y-3 text-sm">
                                  {payload!.assignment_submission_detail.slice(0, 4).map((row, index) => (
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
                                        <span>Nilai: {formatGradeValue(row.grade)}</span>
                                        {row.late_by_seconds > 0 ? <span>Terlambat: {row.late_by_label}</span> : null}
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
                                href={buildSiteReportDetailHref(siteSubdomain, periodKey, { section: "course-completion-summary", insight: "courses" })}
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
                                  <p className="text-sm text-muted-foreground">Belum ada ringkasan course health.</p>
                                )}
                              </CardContent>
                            </Card>

                            <Card>
                              <PreviewHeader
                                title="Aktivitas Terpadat"
                                description="Aktivitas dengan traffic dan event tertinggi."
                                href={buildSiteReportDetailHref(siteSubdomain, periodKey, { section: "activity-stats-summary", insight: "courses" })}
                              />
                              <CardContent>
                                {(payload?.activity_stats_summary?.length ?? 0) > 0 ? (
                                  <div className="space-y-3 text-sm">
                                    {payload!.activity_stats_summary.slice(0, 3).map((row, index) => (
                                      <div key={`${row.activity_id}-${index}`} className="rounded-lg border bg-muted/20 p-3">
                                        <p className="font-medium">{row.activity_label}</p>
                                        <p className="mt-1 text-xs text-muted-foreground">{row.course_name || "Situs"} · {row.total_events} event · {row.unique_users} pengguna</p>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground">Belum ada aktivitas yang menonjol.</p>
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
                                href={buildSiteReportDetailHref(siteSubdomain, periodKey, { section: "forum-engagement-summary", insight: "engagement" })}
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
                                href={buildSiteReportDetailHref(siteSubdomain, periodKey, { section: "quiz-question-analysis", insight: "engagement" })}
                              />
                              <CardContent className="space-y-4">
                                {(payload?.quiz_question_analysis?.length ?? 0) > 0 ? (
                                  <div className="space-y-3 text-sm">
                                    {payload!.quiz_question_analysis.slice(0, 3).map((row, index) => (
                                      <div key={`${row.quiz_id}-${row.question_id}-${index}`} className="rounded-lg border bg-muted/20 p-3">
                                        <p className="font-medium">{row.question_name}</p>
                                        <p className="text-xs text-muted-foreground">{row.quiz_name}</p>
                                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                                          <span>Attempts: {row.attempts}</span>
                                          <span>Correct rate: {formatPercentageValue(row.correct_rate)}</span>
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
                                  href={buildSiteReportDetailHref(siteSubdomain, periodKey, { section: "quiz-activity-detail", insight: "engagement" })}
                                />
                              </CardContent>
                            </Card>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>

                  <Card className="border-dashed">
                    <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-medium">Butuh detail operasional yang lengkap?</p>
                        <p className="text-sm text-muted-foreground">
                          Buka overview laporan untuk melihat filter kursus, count operasional, dan drilldown per section.
                        </p>
                      </div>
                      <Button asChild>
                        <Link href={fullReportHref}>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Buka Laporan Lengkap
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
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
                        <p className="text-base font-semibold">Status Sinkronisasi & Diagnostik</p>
                        <p className="text-sm font-normal text-muted-foreground">
                          Detail teknis untuk memeriksa koneksi plugin, tracking, dan sinkronisasi data laporan.
                        </p>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6">
                      <div className="space-y-4 text-sm">
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          <div className="rounded-lg border bg-muted/20 p-3">
                            <p className="text-xs text-muted-foreground">Versi plugin</p>
                            <p className="mt-1 font-medium">{connection.plugin_version ? `v${connection.plugin_version}` : "-"}</p>
                          </div>
                          <div className="rounded-lg border bg-muted/20 p-3">
                            <p className="text-xs text-muted-foreground">Status sinkronisasi</p>
                            <p className="mt-1 font-medium">{connection.state_label}</p>
                          </div>
                          <div className="rounded-lg border bg-muted/20 p-3">
                            <p className="text-xs text-muted-foreground">Aktivitas terlacak</p>
                            <p className="mt-1 font-medium">{connection.tracking_state_label}</p>
                          </div>
                          <div className="rounded-lg border bg-muted/20 p-3">
                            <p className="text-xs text-muted-foreground">Data diperbarui</p>
                            <p className="mt-1 font-medium">{formatReportClock(connection.last_sync_at)}</p>
                          </div>
                          <div className="rounded-lg border bg-muted/20 p-3">
                            <p className="text-xs text-muted-foreground">Data laporan dibuat</p>
                            <p className="mt-1 font-medium">{formatReportClock(snapshot?.generated_at)}</p>
                          </div>
                          <div className="rounded-lg border bg-muted/20 p-3">
                            <p className="text-xs text-muted-foreground">Aktivitas terakhir</p>
                            <p className="mt-1 font-medium">{formatReportClock(connection.tracking_last_seen_at)}</p>
                          </div>
                          <div className="rounded-lg border bg-muted/20 p-3">
                            <p className="text-xs text-muted-foreground">Data diterima</p>
                            <p className="mt-1 font-medium">{formatReportClock(snapshot?.received_at)}</p>
                          </div>
                          <div className="rounded-lg border bg-muted/20 p-3">
                            <p className="text-xs text-muted-foreground">Registered</p>
                            <p className="mt-1 font-medium">{formatReportClock(connection.registered_at)}</p>
                          </div>
                          <div className="rounded-lg border bg-muted/20 p-3 sm:col-span-2 xl:col-span-1">
                            <p className="text-xs text-muted-foreground">Capabilities</p>
                            <p className="mt-1 font-medium">{formatCapabilities(connection)}</p>
                          </div>
                          <div className="rounded-lg border bg-muted/20 p-3 sm:col-span-2 xl:col-span-2">
                            <p className="text-xs text-muted-foreground">Site snapshot URL</p>
                            <p className="mt-1 break-all font-medium">{connection.site_url_snapshot || "-"}</p>
                          </div>
                        </div>
                        <div className="rounded-lg border bg-muted/20 p-3">
                          <p className="text-xs text-muted-foreground">Mode tracking</p>
                          <p className="mt-1 font-medium">{connection.tracking_mode || "-"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{connection.tracking_state_message}</p>
                        </div>
                        {showManualConnect ? (
                          <div className="rounded-lg border bg-muted/20 p-3">
                            <p className="text-xs text-muted-foreground">Manual connect</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Untuk tenant yang belum tersambung, gunakan Site ID, API base URL, dan connect token ini di halaman teknis plugin Moodle.
                            </p>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              <div className="rounded-lg border bg-background/70 p-3">
                                <p className="text-[11px] text-muted-foreground">Site ID</p>
                                <p className="mt-1 break-all font-mono text-xs font-medium">{siteID}</p>
                              </div>
                              <div className="rounded-lg border bg-background/70 p-3">
                                <p className="text-[11px] text-muted-foreground">API base URL</p>
                                <p className="mt-1 break-all font-mono text-xs font-medium">{pluginAPIBaseURL}</p>
                              </div>
                            </div>
                            <div className="mt-3 rounded-lg border bg-background/70 p-3">
                              <p className="text-[11px] text-muted-foreground">Connect token</p>
                              <p className="mt-1 break-all font-mono text-xs font-medium">
                                {connectToken || "Belum dibuat. Gunakan tombol di bawah untuk membuat token koneksi."}
                              </p>
                              {connectTokenError ? <p className="mt-2 text-xs text-red-700">{connectTokenError}</p> : null}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void fetchConnectToken()}
                                disabled={connectTokenLoading}
                              >
                                {connectTokenLoading ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="mr-2 h-4 w-4" />
                                )}
                                {connectToken ? "Buat Ulang Token" : "Buat Connect Token"}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void copyConnectToken()}
                                disabled={!connectToken || connectTokenLoading}
                              >
                                <Copy className="mr-2 h-4 w-4" />
                                Salin Token
                              </Button>
                            </div>
                          </div>
                        ) : null}
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
  )
}
