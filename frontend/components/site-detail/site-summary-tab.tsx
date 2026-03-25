"use client"

import { useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Settings, Database, Zap, BarChart3, Mail } from "lucide-react"
import {
  type SiteSummary,
  type SiteRuntimeStatus,
  type SiteReportConnectionStatus,
  type SiteSettingsResponse,
  type SiteUsageSnapshot,
} from "@/lib/api"
import {
  findRuntimeService,
  formatBytes,
  formatCount,
  formatPercentage,
  formatSystemValue,
  formatRelativeTimestamp,
  formatLabel,
  buildUsageSummary,
  getCapacityState,
  getCapacityTone,
  buildPrimaryAlert,
  buildSummaryHealth,
  buildSummaryAttentionItems,
} from "./site-detail-helpers"

interface SiteSummaryTabProps {
  siteData: SiteSummary | null
  siteSettings: SiteSettingsResponse | null
  runtimeStatus: SiteRuntimeStatus | null
  siteUsage: SiteUsageSnapshot | null
  reportConnection: SiteReportConnectionStatus | null
  runtimeError: string
  currentDomainHost: string
}

export function SiteSummaryTab({
  siteData,
  siteSettings,
  runtimeStatus,
  siteUsage,
  reportConnection,
  runtimeError,
  currentDomainHost,
}: SiteSummaryTabProps) {
  const webService = findRuntimeService(runtimeStatus, "web")
  const cronService = findRuntimeService(runtimeStatus, "cron")
  const runtimeMetadata = siteSettings?.runtime ?? runtimeStatus?.runtime ?? null
  const customDomain = siteSettings?.custom_domain ?? null

  const storageUsed = siteUsage?.storage_bytes_used ?? null
  const storageLimit = siteData?.storage_bytes_limit ?? null
  const storagePercent = typeof storageUsed === "number" && typeof storageLimit === "number" && storageLimit > 0
    ? (storageUsed / storageLimit) * 100
    : 0
  const activeUsers = siteUsage?.users_active_count ?? null
  const activeUsersLimit = siteData?.users_active_limit ?? null
  const activeUsersPercent = typeof activeUsers === "number" && typeof activeUsersLimit === "number" && activeUsersLimit > 0
    ? (activeUsers / activeUsersLimit) * 100
    : 0
  const systemSummary = runtimeStatus?.system ?? null
  const serviceError = runtimeError || runtimeStatus?.last_error || siteUsage?.last_error || ""
  
  const storageCapacityState = getCapacityState(storageUsed, storageLimit)
  const userCapacityState = getCapacityState(activeUsers, activeUsersLimit)
  const storageCapacityTone = getCapacityTone(storageCapacityState, storageUsed, storageLimit)
  const userCapacityTone = getCapacityTone(userCapacityState, activeUsers, activeUsersLimit)
  const storageSummary = buildUsageSummary(storageUsed, storageLimit, formatBytes)
  const activeUsersSummary = buildUsageSummary(activeUsers, activeUsersLimit, formatCount)
  const lastCheckedText = formatRelativeTimestamp(runtimeMetadata?.last_health_checked_at ?? siteUsage?.measured_at ?? null)

  const primaryAlert = useMemo(() => buildPrimaryAlert({
    serviceError,
    overallStatus: runtimeStatus?.overall_status,
    webStatusText: webService?.status_text,
    cronStatusText: cronService?.status_text,
    customDomainStatus: customDomain?.status,
    customDomainError: customDomain?.last_error,
    warningLevel: siteUsage?.warning_level,
    overLimit: siteUsage?.over_limit,
  }), [serviceError, runtimeStatus?.overall_status, webService?.status_text, cronService?.status_text, customDomain?.status, customDomain?.last_error, siteUsage?.warning_level, siteUsage?.over_limit])

  const summaryHealth = useMemo(() => buildSummaryHealth(primaryAlert.title), [primaryAlert.title])

  const summaryAttentionItems = useMemo(() => buildSummaryAttentionItems({
    storageState: storageCapacityState,
    userState: userCapacityState,
    webStatusText: webService?.status_text,
    webHealthStatus: webService?.health_status,
    cronStatusText: cronService?.status_text,
    cronHealthStatus: cronService?.health_status,
    customDomainStatus: customDomain?.status,
    customDomainError: customDomain?.last_error,
  }), [storageCapacityState, userCapacityState, webService?.status_text, webService?.health_status, cronService?.status_text, cronService?.health_status, customDomain?.status, customDomain?.last_error])

  const reportPluginStatusLabel = reportConnection?.state_label ?? "Belum tersedia"
  const reportPluginSummary = reportConnection
    ? reportConnection.state === "not_connected"
      ? "Plugin laporan belum terhubung ke Moodlepilot."
      : reportConnection.state_message
    : "Status plugin laporan belum tersedia."

  return (
    <div className="space-y-4">
      <Card className="border-border p-4">
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Status Utama Situs</span>
            <Badge variant="outline" className={summaryHealth.badgeClassName}>
              {summaryHealth.label}
            </Badge>
            <span className="hidden sm:inline">•</span>
            <span>{lastCheckedText}</span>
          </div>
          <p className="text-sm break-words">
            <span className="font-medium text-foreground">{primaryAlert.title}.</span>{" "}
            <span className="text-muted-foreground">{primaryAlert.message}</span>
          </p>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Storage</p>
          <p className="mt-2 text-lg font-semibold">{storageSummary}</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${storageCapacityTone.progressClassName}`}
              style={{ width: formatPercentage(storagePercent) }}
            />
          </div>
          <p className={`mt-2 text-xs font-medium ${storageCapacityTone.textClassName}`}>{storageCapacityTone.label}</p>
        </Card>

        <Card className="border-border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pengguna Aktif</p>
          <p className="mt-2 text-lg font-semibold">{activeUsersSummary}</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${userCapacityTone.progressClassName}`}
              style={{ width: formatPercentage(activeUsersPercent) }}
            />
          </div>
          <p className={`mt-2 text-xs font-medium ${userCapacityTone.textClassName}`}>{userCapacityTone.label}</p>
        </Card>

        <Card className="border-border p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status Layanan</p>
            <span className="text-xs text-muted-foreground">Inti</span>
          </div>
          <div className="mt-3 space-y-0 divide-y divide-border">
            <div className="flex items-center justify-between gap-3 py-2">
              <p className="text-sm text-muted-foreground">Web</p>
              <p className={`text-sm font-medium ${webService?.health_status === "healthy" ? "text-green-600" : "text-amber-600"}`}>
                {webService?.status_text ?? "Belum tersedia"}
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 py-2">
              <p className="text-sm text-muted-foreground">Cron</p>
              <p className={`text-sm font-medium ${cronService?.health_status === "healthy" ? "text-green-600" : "text-amber-600"}`}>
                {cronService?.status_text ?? "Belum tersedia"}
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 py-2">
              <p className="text-sm text-muted-foreground">Plugin Laporan</p>
              <p
                className={`text-sm font-medium ${
                  reportConnection?.state === "sync_error"
                    ? "text-red-600"
                    : reportConnection?.state === "not_connected" || reportConnection?.state === "tracking_stale"
                      ? "text-amber-600"
                      : "text-green-600"
                }`}
              >
                {reportPluginStatusLabel}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="h-full border-border p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-semibold">Yang Perlu Dicek</h3>
            <p className="text-xs text-muted-foreground">Prioritas operasional saat ini.</p>
          </div>
          <div className="mt-4 divide-y divide-border">
            <div className="flex gap-3 py-3 first:pt-0">
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${reportConnection?.state === "sync_error" ? "bg-red-500" : reportConnection?.state === "not_connected" ? "bg-amber-500" : "bg-green-500"}`} />
              <div className="min-w-0">
                <p className="text-sm font-medium">Plugin laporan: {reportPluginStatusLabel}</p>
                <p className="mt-1 text-xs text-muted-foreground">{reportPluginSummary}</p>
              </div>
            </div>
            {summaryAttentionItems.map((item, index) => (
              <div key={`${item.title}-${index}`} className="flex gap-3 py-3">
                <span
                  className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                    item.tone === "critical"
                      ? "bg-red-500"
                      : item.tone === "warning"
                        ? "bg-amber-500"
                        : item.tone === "normal"
                          ? "bg-green-500"
                          : "bg-muted-foreground"
                  }`}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
            <div className="pt-3">
              <p className="text-xs font-medium">Insight tambahan segera hadir</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Backup, SSL/domain, sinkronisasi laporan, dan aktivitas tenant terbaru akan muncul di sini.
              </p>
            </div>
          </div>
        </Card>

        <Card className="h-full border-border p-4">
          <div className="space-y-4">
            <div className="space-y-2.5">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="font-semibold">Akses & Sistem</h3>
                <p className="text-xs text-muted-foreground">Konteks tenant untuk pengecekan cepat.</p>
              </div>
              <div className="divide-y divide-border">
                <div className="flex items-center justify-between gap-4 py-3">
                  <span className="text-sm text-muted-foreground">Domain Aktif</span>
                  <span className="text-sm font-medium break-all text-right">{currentDomainHost}</span>
                </div>
                <div className="flex items-center justify-between gap-4 py-3">
                  <span className="text-sm text-muted-foreground">Paket</span>
                  <span className="text-sm font-medium">{formatLabel(siteData?.plan_code)}</span>
                </div>
                <div className="flex items-center justify-between gap-4 py-3">
                  <span className="text-sm text-muted-foreground">Region</span>
                  <span className="text-sm font-medium">{formatLabel(siteData?.region)}</span>
                </div>
              </div>
            </div>

            <Accordion type="single" collapsible className="w-full border-t border-border pt-3">
              <AccordionItem value="technical" className="border-b-0">
                <AccordionTrigger className="px-0 py-0 hover:no-underline">
                  <div className="space-y-1 text-left">
                    <p className="text-sm font-semibold">Info Teknis</p>
                    <p className="text-xs font-normal text-muted-foreground">
                      Buka bila perlu memeriksa versi stack dan integrasi.
                    </p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-0">
                  <div className="divide-y divide-border pt-3">
                    <div className="flex items-center justify-between gap-4 py-3">
                      <div className="flex items-center gap-2">
                        <Settings className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Moodle Version</span>
                      </div>
                      <span className="text-sm font-medium">{formatSystemValue(systemSummary?.moodle_version)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 py-3">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">PHP Version</span>
                      </div>
                      <span className="text-sm font-medium">{formatSystemValue(systemSummary?.php_version)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 py-3">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Database</span>
                      </div>
                      <span className="text-sm font-medium">{formatSystemValue(systemSummary?.database_label)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 py-3">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Admin Email</span>
                      </div>
                      <span className="text-sm font-medium break-all text-right">{formatSystemValue(siteData?.admin_email)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 py-3">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Versi Plugin Laporan</span>
                      </div>
                      <span className="text-sm font-medium">{reportConnection?.plugin_version ? `v${reportConnection.plugin_version}` : "Belum tersedia"}</span>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </Card>
      </div>
    </div>
  )
}
