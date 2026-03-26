'use client'

import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { SiteCard } from "@/components/dashboard/site-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Search, Filter, LayoutGrid, List } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { useRuntimeActions } from "@/components/providers/runtime-actions-provider"
import { api, type SiteSummary } from "@/lib/api"
import { siteHostFromURL } from "@/lib/site-url"

type DashboardSite = {
  id: string
  name: string
  subdomain: string
  status: "aktif" | "sedang_dibuat" | "nonaktif" | "gagal"
  siteUrl: string
  siteHost: string
  runtimeHealth?: string
  runtimeHint?: string
  quotaState?: "normal" | "warning" | "critical"
  quotaLabel?: string
  activeUsersSummary?: string
  storageSummary?: string
  lastActivity?: string
}

function sitePriority(site: DashboardSite): number {
  if (site.status === "gagal") return 0
  if (site.status === "sedang_dibuat") return 1
  if (site.runtimeHealth === "failed" || site.runtimeHealth === "stopped") return 2
  if (site.runtimeHealth === "degraded") return 3
  if (site.quotaState === "critical") return 4
  if (site.quotaState === "warning") return 5
  if (site.status === "aktif") return 6
  return 7
}

function mapSiteStatus(status: string): DashboardSite["status"] {
  if (status === "active") return "aktif"
  if (status === "pending" || status === "provisioning") return "sedang_dibuat"
  if (status === "failed") return "gagal"
  return "nonaktif"
}

function relativeTime(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  if (diffMinutes < 1) return "Baru saja"
  if (diffMinutes < 60) return `${diffMinutes} menit lalu`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} jam lalu`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${diffDays} hari lalu`
  const diffMonths = Math.floor(diffDays / 30)
  return `${diffMonths} bulan lalu`
}

function formatCount(value?: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    return "-"
  }
  return value.toLocaleString("id-ID")
}

function formatBytes(value?: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    return "-"
  }

  const units = ["B", "KB", "MB", "GB", "TB"]
  let size = value
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  const digits = size >= 10 || unitIndex === 0 ? 0 : 1
  return `${size.toFixed(digits)} ${units[unitIndex]}`
}

function quotaStateFromSite(site: SiteSummary): DashboardSite["quotaState"] {
  const usage = site.usage
  if (!usage) {
    return undefined
  }
  if (usage.over_limit || usage.warning_level === "over_limit" || usage.warning_level === "critical") {
    return "critical"
  }
  if (usage.warning_level === "warning") {
    return "warning"
  }
  return "normal"
}

function quotaLabelFromState(state: DashboardSite["quotaState"]): string | undefined {
  if (state === "critical") {
    return "Quota kritis"
  }
  if (state === "warning") {
    return "Quota waspada"
  }
  if (state === "normal") {
    return "Quota aman"
  }
  return undefined
}

function mapApiSite(site: SiteSummary): DashboardSite {
  const quotaState = quotaStateFromSite(site)
  return {
    id: site.id,
    name: site.name,
    subdomain: site.subdomain,
    status: mapSiteStatus(site.status),
    siteUrl: site.site_url,
    siteHost: siteHostFromURL(site.site_url) || site.subdomain,
    runtimeHealth: site.runtime_health,
    runtimeHint: site.runtime_last_error,
    quotaState,
    quotaLabel: quotaLabelFromState(quotaState),
    activeUsersSummary: site.usage ? `${formatCount(site.usage.users_active_count)} / ${formatCount(site.users_active_limit)}` : undefined,
    storageSummary: site.usage ? `${formatBytes(site.usage.storage_bytes_used)} / ${formatBytes(site.storage_bytes_limit)}` : undefined,
    lastActivity: site.updated_at ? relativeTime(site.updated_at) : undefined,
  }
}

type StatusFilter = "semua" | "aktif" | "sedang_dibuat" | "nonaktif" | "gagal"

const ITEMS_PER_PAGE = 12

export default function DashboardPage() {
  const { pendingActions, getPendingAction, runRuntimeAction } = useRuntimeActions()
  const [sites, setSites] = useState<DashboardSite[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("semua")
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const previousPendingSiteIDsRef = useRef<string[]>([])

  const fetchSites = useCallback(async () => {
    try {
      const response = await api.listSites()
      const mapped = (response.sites || []).map(mapApiSite)
      setSites(mapped)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSites()
  }, [fetchSites])

  const pendingSiteIDs = useMemo(() => Object.keys(pendingActions), [pendingActions])
  const hasPendingRuntimeActions = pendingSiteIDs.length > 0
  const hasProvisioning = sites.some((s) => s.status === "sedang_dibuat")

  // Polling: refresh every 2s if any runtime action is in flight,
  // otherwise every 10s if a site is still provisioning.
  useEffect(() => {
    const intervalMs = hasPendingRuntimeActions ? 2000 : hasProvisioning ? 10000 : null

    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }

    if (intervalMs !== null) {
      pollingRef.current = setInterval(() => {
        void fetchSites()
      }, intervalMs)
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [fetchSites, hasPendingRuntimeActions, hasProvisioning])

  useEffect(() => {
    const settledSiteIDs = previousPendingSiteIDsRef.current.filter(
      (siteID) => !pendingSiteIDs.includes(siteID)
    )

    previousPendingSiteIDsRef.current = pendingSiteIDs

    if (settledSiteIDs.length > 0) {
      void fetchSites()
    }
  }, [fetchSites, pendingSiteIDs])

  const filteredSites = useMemo(() => {
    let result = sites

    if (statusFilter !== "semua") {
      result = result.filter((s) => s.status === statusFilter)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.subdomain.toLowerCase().includes(q)
      )
    }

    return [...result].sort((left, right) => {
      const priorityDiff = sitePriority(left) - sitePriority(right)
      if (priorityDiff !== 0) {
        return priorityDiff
      }
      return left.name.localeCompare(right.name, "id-ID")
    })
  }, [sites, searchQuery, statusFilter])

  const paginatedSites = useMemo(() => {
    return filteredSites.slice(0, visibleCount)
  }, [filteredSites, visibleCount])

  const hasMore = visibleCount < filteredSites.length

  const stats = useMemo(() => {
    const total = sites.length
    const active = sites.filter((s) => s.status === "aktif").length
    const pending = sites.filter((s) => s.status === "sedang_dibuat").length
    const failed = sites.filter((s) => s.status === "gagal").length
    return { total, active, pending, failed }
  }, [sites])

  const filterLabel: Record<StatusFilter, string> = {
    semua: "Semua",
    aktif: "Aktif",
    sedang_dibuat: "Sedang Dibuat",
    nonaktif: "Nonaktif",
    gagal: "Gagal",
  }

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 py-8">
          <div className="container mx-auto max-w-7xl px-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Situs Moodle Saya</h1>
                <p className="text-muted-foreground">Kelola semua situs Moodle Anda dari satu dashboard</p>
              </div>
              <Link href="/buat-situs">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Buat Situs Baru
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-lg border bg-card p-4">
                <p className="text-sm text-muted-foreground">Total Situs</p>
                <p className="text-2xl font-bold">{loading ? "-" : stats.total}</p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-sm text-muted-foreground">Situs Aktif</p>
                <p className="text-2xl font-bold">{loading ? "-" : stats.active}</p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-sm text-muted-foreground">Sedang Dibuat</p>
                <p className="text-2xl font-bold">{loading ? "-" : stats.pending}</p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-sm text-muted-foreground">Gagal</p>
                <p className="text-2xl font-bold">{loading ? "-" : stats.failed}</p>
              </div>
            </div>

            {/* Search + Filter + View Toggle */}
            <div className="mt-6 flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Cari situs..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setVisibleCount(ITEMS_PER_PAGE)
                  }}
                />
              </div>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Filter className="mr-2 h-4 w-4" />
                      {filterLabel[statusFilter]}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {(Object.keys(filterLabel) as StatusFilter[]).map((key) => (
                      <DropdownMenuItem
                        key={key}
                        onClick={() => {
                          setStatusFilter(key)
                          setVisibleCount(ITEMS_PER_PAGE)
                        }}
                      >
                        {filterLabel[key]}
                        {statusFilter === key && " ✓"}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="flex rounded-md border">
                  <Button
                    variant={viewMode === "grid" ? "secondary" : "ghost"}
                    size="icon"
                    className="h-8 w-8 rounded-r-none"
                    onClick={() => setViewMode("grid")}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "secondary" : "ghost"}
                    size="icon"
                    className="h-8 w-8 rounded-l-none"
                    onClick={() => setViewMode("list")}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Site Cards */}
            <div className={`mt-6 ${viewMode === "grid" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-3"}`}>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-32 animate-pulse rounded-lg border bg-muted" />
                ))
              ) : paginatedSites.length === 0 ? (
                <div className="col-span-full py-12 text-center text-muted-foreground">
                  {searchQuery || statusFilter !== "semua"
                    ? "Tidak ada situs yang cocok dengan filter"
                    : "Belum ada situs. Buat situs pertama Anda!"}
                </div>
              ) : (
                paginatedSites.map((site) => (
                  <SiteCard
                    key={site.id}
                    id={site.id}
                    name={site.name}
                    subdomain={site.subdomain}
                    status={site.status}
                    siteUrl={site.siteUrl}
                    siteHost={site.siteHost}
                    runtimeHealth={site.runtimeHealth}
                    runtimeHint={site.runtimeHint}
                    quotaState={site.quotaState}
                    quotaLabel={site.quotaLabel}
                    activeUsersSummary={site.activeUsersSummary}
                    storageSummary={site.storageSummary}
                    lastActivity={site.lastActivity}
                    viewMode={viewMode}
                    pendingRuntimeAction={getPendingAction(site.id)}
                    onRuntimeAction={(action) => {
                      void runRuntimeAction(site.id, action).catch(() => {
                        // Keep dashboard runtime actions lightweight for now.
                      })
                    }}
                  />
                ))
              )}
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="mt-6 flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => setVisibleCount((prev) => prev + ITEMS_PER_PAGE)}
                >
                  Muat lebih banyak ({filteredSites.length - visibleCount} situs lagi)
                </Button>
              </div>
            )}
          </div>
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  )
}
