"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { SiteReportTab } from "@/components/dashboard/site-report-tab"
import { SiteSummaryTab } from "@/components/site-detail/site-summary-tab"
import { SiteBackupTab } from "@/components/site-detail/site-backup-tab"
import { SiteSettingsTab } from "@/components/site-detail/site-settings-tab"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, ExternalLink, Globe, Loader2, Play, Square, RotateCw } from "lucide-react"

import {
  api,
  isAPIError,
  type SiteSummary,
  type SiteRuntimeStatus,
  type SiteReportConnectionStatus,
  type SiteSettingsResponse,
  type SiteUsageSnapshot,
} from "@/lib/api"
import { buildSiteURL, siteHostFromURL } from "@/lib/site-url"
import {
  runtimeStatusBadge,
  findRuntimeService,
  isRuntimeControllable,
} from "@/components/site-detail/site-detail-helpers"

export default function SiteDetailPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { subdomain } = use(params)
  
  const [siteData, setSiteData] = useState<SiteSummary | null>(null)
  const [siteSettings, setSiteSettings] = useState<SiteSettingsResponse | null>(null)
  const [runtimeStatus, setRuntimeStatus] = useState<SiteRuntimeStatus | null>(null)
  const [siteUsage, setSiteUsage] = useState<SiteUsageSnapshot | null>(null)
  const [reportConnection, setReportConnection] = useState<SiteReportConnectionStatus | null>(null)
  const [runtimeError, setRuntimeError] = useState("")
  const [runtimeAction, setRuntimeAction] = useState<"start" | "restart" | "stop" | null>(null)
  const [activeTab, setActiveTab] = useState("ringkasan")

  const loadSiteContext = async (siteSubdomain: string) => {
    const siteResponse = await api.getSiteBySubdomain(siteSubdomain)

    const [runtimeResult, settingsResult, usageResult] = await Promise.allSettled([
      api.getSiteRuntime(siteResponse.site.id),
      api.getSiteSettings(siteResponse.site.id),
      api.getSiteUsage(siteResponse.site.id),
    ])

    return { site: siteResponse.site, runtimeResult, settingsResult, usageResult }
  }

  const applySiteContext = (context: Awaited<ReturnType<typeof loadSiteContext>>) => {
    setSiteData(context.site)

    if (context.runtimeResult.status === "fulfilled") {
      setRuntimeStatus(context.runtimeResult.value)
      setRuntimeError(context.runtimeResult.value.last_error ?? "")
    } else {
      const error = context.runtimeResult.reason
      setRuntimeError(isAPIError(error) ? error.message : "Gagal memuat status runtime")
    }

    if (context.settingsResult.status === "fulfilled") {
      setSiteSettings(context.settingsResult.value)
    } else {
      const error = context.settingsResult.reason
      setRuntimeError((current) => current || (isAPIError(error) ? error.message : "Gagal memuat pengaturan situs"))
    }

    if (context.usageResult.status === "fulfilled") {
      setSiteUsage(context.usageResult.value.usage)
    }
  }

  const siteID = siteData?.id ?? null

  useEffect(() => {
    if (!siteID) {
      setReportConnection(null)
      return
    }

    let cancelled = false

    const loadReportConnection = async () => {
      try {
        const response = await api.getSiteReportConnection(siteID)
        if (!cancelled) {
          setReportConnection(response.connection)
        }
      } catch {
        if (!cancelled) {
          setReportConnection(null)
        }
      }
    }

    void loadReportConnection()

    return () => {
      cancelled = true
    }
  }, [siteID])

  useEffect(() => {
    const requestedTab = searchParams.get("tab")
    if (requestedTab === "ringkasan" || requestedTab === "laporan" || requestedTab === "backup" || requestedTab === "pengaturan") {
      setActiveTab(requestedTab)
    }
  }, [searchParams])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const context = await loadSiteContext(subdomain)
        if (cancelled) {
          return
        }
        applySiteContext(context)
      } catch (error) {
        if (cancelled) {
          return
        }
        setRuntimeError(isAPIError(error) ? error.message : "Gagal memuat situs")
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [subdomain])

  useEffect(() => {
    if (activeTab !== "ringkasan" || !siteData || runtimeAction !== null) {
      return
    }

    const intervalID = window.setInterval(async () => {
      try {
        const refreshedStatus = await api.getSiteRuntime(siteData.id)
        setRuntimeStatus(refreshedStatus)
        if (refreshedStatus.last_error) {
          setRuntimeError(refreshedStatus.last_error)
        }
      } catch {
        // Silent block failure
      }
    }, 30000)

    return () => {
      window.clearInterval(intervalID)
    }
  }, [activeTab, siteData, runtimeAction])

  const siteUrl = siteData?.site_url ?? buildSiteURL(subdomain)
  const siteHost = siteHostFromURL(siteUrl, subdomain)
  const siteName = siteData?.name ?? "Memuat..."
  const runtimeBadge = runtimeStatusBadge(runtimeStatus?.overall_status ?? "unknown")
  const webService = findRuntimeService(runtimeStatus, "web")
  const cronService = findRuntimeService(runtimeStatus, "cron")
  
  const customDomain = siteSettings?.custom_domain ?? null
  const currentDomainHost = customDomain?.status === "active" && customDomain.domain ? customDomain.domain : siteHost

  const canControlRuntime = isRuntimeControllable(runtimeStatus)
  const canStart = canControlRuntime && ((webService?.state ?? "unknown") !== "running" || (cronService?.state ?? "unknown") !== "running")
  const canRestart = canControlRuntime && ["running", "degraded", "unknown"].includes(runtimeStatus?.overall_status ?? "")
  const canStop = canControlRuntime && ((webService?.state ?? "unknown") === "running" || (cronService?.state ?? "unknown") === "running")

  const handleRuntimeAction = async (action: "start" | "restart" | "stop") => {
    if (!siteData) {
      return
    }

    setRuntimeAction(action)
    try {
      const nextStatus =
        action === "start"
          ? await api.startSiteRuntime(siteData.id)
          : action === "restart"
            ? await api.restartSiteRuntime(siteData.id)
            : await api.stopSiteRuntime(siteData.id)
      setRuntimeStatus(nextStatus)
      setSiteData(nextStatus.site)
      setRuntimeError(nextStatus.last_error ?? "")
    } catch (error) {
      setRuntimeError(isAPIError(error) ? error.message : "Aksi runtime gagal dijalankan")
      try {
        const refreshedStatus = await api.getSiteRuntime(siteData.id)
        setRuntimeStatus(refreshedStatus)
        setSiteData(refreshedStatus.site)
        if (refreshedStatus.last_error) {
          setRuntimeError(refreshedStatus.last_error)
        }
      } catch {
        // Keep the previous runtime state if refresh fails.
      }
    } finally {
      setRuntimeAction(null)
    }
  }

  const handleSiteTabChange = (tab: string) => {
    setActiveTab(tab)
    router.replace(`/situs/${subdomain}?tab=${tab}`, { scroll: false })
  }

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
      
        <main className="flex-1">
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
            <Link 
              href="/dashboard" 
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Dashboard
            </Link>

            {siteData === null && !runtimeError ? (
              <div className="flex flex-col items-center justify-center py-24">
                <Loader2 className="h-10 w-10 text-muted-foreground animate-spin mb-4" />
                <p className="text-sm font-medium text-muted-foreground">Memuat data situs...</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                      <Globe className="h-7 w-7 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h1 className="text-xl font-semibold">{siteName}</h1>
                        <Badge variant="outline" className={runtimeBadge.className}>
                          {runtimeBadge.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{currentDomainHost}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {canControlRuntime && runtimeStatus ? (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          disabled={!canRestart || runtimeAction !== null} 
                          onClick={() => handleRuntimeAction("restart")}
                        >
                          {runtimeAction === "restart" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCw className="mr-2 h-4 w-4" />}
                          Restart
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          disabled={!canStart || runtimeAction !== null}
                          onClick={() => handleRuntimeAction("start")}
                        >
                          {runtimeAction === "start" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                          Start
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"
                          disabled={!canStop || runtimeAction !== null}
                          onClick={() => handleRuntimeAction("stop")}
                        >
                          {runtimeAction === "stop" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Square className="mr-2 h-4 w-4" />}
                          Stop
                        </Button>
                      </>
                    ) : null}

                    <Link href={siteUrl} target="_blank">
                      <Button>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Buka Situs
                      </Button>
                    </Link>
                  </div>
                </div>

                <Tabs value={activeTab} onValueChange={handleSiteTabChange} className="w-full space-y-6">
                  <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 xl:w-auto xl:inline-grid">
                    <TabsTrigger value="ringkasan">Ringkasan</TabsTrigger>
                    <TabsTrigger value="laporan">Laporan</TabsTrigger>
                    <TabsTrigger value="backup">Backup</TabsTrigger>
                    <TabsTrigger value="pengaturan">Pengaturan</TabsTrigger>
                  </TabsList>

                  <TabsContent value="ringkasan" className="space-y-4">
                    <SiteSummaryTab 
                      siteData={siteData}
                      siteSettings={siteSettings}
                      runtimeStatus={runtimeStatus}
                      siteUsage={siteUsage}
                      reportConnection={reportConnection}
                      runtimeError={runtimeError}
                      currentDomainHost={currentDomainHost}
                    />
                  </TabsContent>

                  <TabsContent value="laporan">
                    <SiteReportTab siteID={siteData?.id ?? ""} siteName={siteName} siteSubdomain={subdomain} />
                  </TabsContent>

                  <TabsContent value="backup">
                    <SiteBackupTab siteData={siteData} isActive={activeTab === "backup"} />
                  </TabsContent>

                  <TabsContent value="pengaturan">
                    <SiteSettingsTab 
                      siteData={siteData}
                      siteSettings={siteSettings}
                      runtimeStatus={runtimeStatus}
                      subdomain={subdomain}
                      currentDomainHost={currentDomainHost}
                      onSiteUpdated={setSiteData}
                      onSettingsUpdated={setSiteSettings}
                      onRuntimeUpdated={(runtime, error) => {
                        setRuntimeStatus(runtime)
                        setRuntimeError(error)
                      }}
                    />
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>
        </main>
        
        <Footer />
      </div>
    </ProtectedRoute>
  )
}
