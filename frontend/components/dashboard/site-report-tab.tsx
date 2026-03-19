"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Activity,
  AlertCircle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  GraduationCap,
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
  type SiteReportSnapshot,
  type SiteReportSummaryResponse,
} from "@/lib/api"
import { toast } from "sonner"

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
      description: `Sinkronisasi berhasil, tetapi belum ada aktivitas terukur pada ${periodLabel.toLowerCase()}. Ringkasan penuh akan muncul setelah tenant mulai digunakan.`,
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

export function SiteReportTab({ siteID, siteName, siteSubdomain }: SiteReportTabProps) {
  const [summary, setSummary] = useState<SiteReportSummaryResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [periodKey, setPeriodKey] = useState(DEFAULT_PERIOD_KEY)
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
  const snapshot: SiteReportSnapshot | null = summary?.snapshot ?? null
  const payload = snapshot?.payload
  const badgeConfig = connection ? connectionBadge(connection) : null
  const BadgeIcon = badgeConfig?.icon
  const recentActivityPreview = payload?.recent_activity?.slice(0, 5) ?? []
  const topUser = payload?.user_status?.[0] ?? null
  const topActivity = payload?.activity_stats_summary?.[0] ?? null
  const topQuiz = payload?.quiz_activity_detail?.[0] ?? null
  const showManualConnect = connection?.state === "not_connected"
  const activePeriodOption = PERIOD_OPTIONS.find((option) => option.value === periodKey) ?? PERIOD_OPTIONS[0]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Laporan Situs</h2>
          <p className="text-sm text-muted-foreground">
            Ringkasan health koneksi, sinkronisasi, dan highlight laporan untuk {siteName}
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
          <Button asChild>
            <Link href={`/situs/${siteSubdomain}/laporan`}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Buka Laporan Lengkap
            </Link>
          </Button>
        </div>
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
            {connection.plugin_version ? <Badge variant="outline">Plugin v{connection.plugin_version}</Badge> : null}
            <Badge variant="outline">{activePeriodOption.label}</Badge>
            <span>Last seen: {formatRelativeTime(connection.last_seen_at)}</span>
            <span>Tracking: {connection.tracking_state_label}</span>
            <span>Last tracking: {formatRelativeTime(connection.tracking_last_seen_at)}</span>
            <span>Last sync: {formatRelativeTime(connection.last_sync_at)}</span>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4" />
                  Status Koneksi Laporan
                </CardTitle>
                <CardDescription>{connection.state_message}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Site Snapshot URL</p>
                    <p className="mt-1 break-all font-medium">{connection.site_url_snapshot || "-"}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Capabilities</p>
                    <p className="mt-1 font-medium">{connection.capabilities.length} dataset</p>
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
                </div>
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Tracking Mode</p>
                  <p className="mt-1 font-medium">{connection.tracking_mode || "-"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{connection.tracking_state_message}</p>
                </div>
                {showManualConnect ? (
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Manual Connect</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Untuk instalasi plugin mandiri atau reconnect tenant, gunakan Site ID, API base URL, dan connect token dari Moodlepilot.
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border bg-background/70 p-3">
                        <p className="text-[11px] text-muted-foreground">Site ID</p>
                        <p className="mt-1 break-all font-mono text-xs font-medium">{siteID}</p>
                      </div>
                      <div className="rounded-lg border bg-background/70 p-3">
                        <p className="text-[11px] text-muted-foreground">API Base URL</p>
                        <p className="mt-1 break-all font-mono text-xs font-medium">{pluginAPIBaseURL}</p>
                      </div>
                    </div>
                    <div className="mt-3 rounded-lg border bg-background/70 p-3">
                      <p className="text-[11px] text-muted-foreground">Connect Token</p>
                      <p className="mt-1 break-all font-mono text-xs font-medium">
                        {connectToken || "Belum dibuat. Gunakan tombol di bawah untuk membuat token koneksi."}
                      </p>
                      {connectTokenError ? (
                        <p className="mt-2 text-xs text-red-700">{connectTokenError}</p>
                      ) : null}
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
                    <p className="font-medium">Last error</p>
                    <p className="mt-1">{connection.last_error}</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className={highlightCardStyle(summary.highlight)}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-4 w-4" />
                  Highlight
                </CardTitle>
                <CardDescription>Insight utama dari snapshot {activePeriodOption.label.toLowerCase()}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="font-medium">{summary.highlight.title}</p>
                <p className="mt-2 text-sm text-muted-foreground">{summary.highlight.message}</p>
              </CardContent>
            </Card>
          </div>

          {!snapshot && <ReportEmptyState state="no_snapshot" connection={connection} periodLabel={activePeriodOption.label} />}

          {snapshot && (
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

              {!connection.has_activity && <ReportEmptyState state="no_activity" connection={connection} periodLabel={activePeriodOption.label} />}

              <div className="grid gap-4 lg:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Users className="h-4 w-4" />
                      User Status
                    </CardTitle>
                    <CardDescription>Pengguna paling menonjol pada periode ini</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {topUser ? (
                      <>
                        <p className="font-medium">{topUser.user_name}</p>
                        <p className="text-muted-foreground">{topUser.role_label} · {topUser.course_name}</p>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div className="rounded-lg border bg-muted/20 p-2">
                            <p className="text-[11px] text-muted-foreground">Status</p>
                            <p className="text-base font-semibold">{topUser.status_label}</p>
                          </div>
                          <div className="rounded-lg border bg-muted/20 p-2">
                            <p className="text-[11px] text-muted-foreground">Enrolment</p>
                            <p className="text-base font-semibold">{topUser.enrolment_method_label}</p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Belum ada data user status.</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <BookOpen className="h-4 w-4" />
                      Activity Stats
                    </CardTitle>
                    <CardDescription>Aktivitas kursus paling aktif pada periode ini</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {topActivity ? (
                      <>
                        <p className="font-medium">{topActivity.activity_label}</p>
                        <p className="text-muted-foreground">{topActivity.course_name || "Situs"}</p>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div className="rounded-lg border bg-muted/20 p-2">
                            <p className="text-[11px] text-muted-foreground">Visits</p>
                            <p className="text-base font-semibold">{topActivity.visits}</p>
                          </div>
                          <div className="rounded-lg border bg-muted/20 p-2">
                            <p className="text-[11px] text-muted-foreground">Time Spent</p>
                            <p className="text-base font-semibold">{topActivity.time_spent_label}</p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Belum ada data activity stats.</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <GraduationCap className="h-4 w-4" />
                      Quiz Detail
                    </CardTitle>
                    <CardDescription>Attempt quiz terbaru yang terekam</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {topQuiz ? (
                      <>
                        <p className="font-medium">{topQuiz.quiz_name}</p>
                        <p className="text-muted-foreground">{topQuiz.user_name} · {topQuiz.status_label}</p>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div className="rounded-lg border bg-muted/20 p-2">
                            <p className="text-[11px] text-muted-foreground">Attempts</p>
                            <p className="text-base font-semibold">{topQuiz.attempts}</p>
                          </div>
                          <div className="rounded-lg border bg-muted/20 p-2">
                            <p className="text-[11px] text-muted-foreground">Time Spent</p>
                            <p className="text-base font-semibold">{topQuiz.time_spent_label}</p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Belum ada data quiz activity.</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {recentActivityPreview.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <BarChart3 className="h-4 w-4" />
                      Aktivitas Terbaru
                    </CardTitle>
                    <CardDescription>Preview lima log aktivitas paling baru</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="pb-2 pr-4 font-medium">Pengguna</th>
                            <th className="pb-2 pr-4 font-medium">Aksi</th>
                            <th className="pb-2 pr-4 font-medium">Waktu</th>
                            <th className="pb-2 font-medium">IP</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentActivityPreview.map((row, index) => (
                            <tr key={index} className="border-b last:border-0">
                              <td className="py-2 pr-4 font-medium">{row.user_name}</td>
                              <td className="py-2 pr-4">{row.action}</td>
                              <td className="py-2 pr-4 text-xs text-muted-foreground">{formatReportClock(row.occurred_at)}</td>
                              <td className="py-2 text-xs text-muted-foreground">{row.ip_address || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </>
          )}
        </>
      )}
    </div>
  )
}
