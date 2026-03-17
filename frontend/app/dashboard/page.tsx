'use client'

import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { SiteCard } from "@/components/dashboard/site-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Search, Filter, LayoutGrid, List } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { useAuth } from "@/components/providers/auth-provider"
import { api, type SiteSummary } from "@/lib/api"
import { siteHostFromURL } from "@/lib/site-url"

type DashboardSite = {
  id: string
  name: string
  subdomain: string
  status: "aktif" | "sedang_dibuat" | "nonaktif"
  siteUrl: string
  siteHost: string
  runtimeHealth?: string
  lastActivity?: string
}

function mapSiteStatus(status: string): DashboardSite["status"] {
  if (status === "active") {
    return "aktif"
  }
  if (status === "pending" || status === "provisioning") {
    return "sedang_dibuat"
  }
  return "nonaktif"
}

function formatRelativeTime(value: string): string | undefined {
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) {
    return undefined
  }

  const diffMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000))
  if (diffMinutes < 1) return "Baru saja"
  if (diffMinutes < 60) return `${diffMinutes} menit lalu`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} jam lalu`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${diffDays} hari lalu`

  const diffMonths = Math.floor(diffDays / 30)
  return `${diffMonths} bulan lalu`
}

function toDashboardSite(site: SiteSummary): DashboardSite {
  return {
    id: site.id,
    name: site.name,
    subdomain: site.subdomain,
    status: mapSiteStatus(site.status),
    siteUrl: site.site_url,
    siteHost: siteHostFromURL(site.site_url, site.subdomain),
    runtimeHealth: site.runtime_health,
    lastActivity: site.status === "active" ? formatRelativeTime(site.updated_at) : undefined,
  }
}

export default function DashboardPage() {
  const { status } = useAuth()
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [searchQuery, setSearchQuery] = useState("")
  const [sites, setSites] = useState<DashboardSite[]>([])
  const [hasLoadedSites, setHasLoadedSites] = useState(false)

  useEffect(() => {
    if (status !== "authenticated") {
      return
    }

    let cancelled = false

    async function loadSites() {
      try {
        const response = await api.listSites()
        if (!cancelled) {
          const nextSites = Array.isArray(response.sites) ? response.sites.map(toDashboardSite) : []
          setSites(nextSites)
        }
      } catch (error) {
        console.error("failed to load dashboard sites", error)
        if (!cancelled) {
          setSites([])
        }
      } finally {
        if (!cancelled) {
          setHasLoadedSites(true)
        }
      }
    }

    void loadSites()

    return () => {
      cancelled = true
    }
  }, [status])

  const filteredSites = useMemo(() => {
    const keyword = searchQuery.toLowerCase()
    return sites.filter(
      (site) =>
        site.name.toLowerCase().includes(keyword) ||
        site.subdomain.toLowerCase().includes(keyword)
    )
  }, [searchQuery, sites])

  const activeSites = filteredSites.filter(s => s.status === "aktif").length
  const pendingSites = filteredSites.filter(s => s.status === "sedang_dibuat").length

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        
        <main className="flex-1">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            {/* Page Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Situs Moodle Saya</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Kelola semua situs Moodle Anda dari satu dashboard
                </p>
              </div>
              <Link href="/buat-situs">
                <Button className="w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" />
                  Buat Situs Baru
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">Total Situs</p>
                <p className="mt-1 text-2xl font-semibold">{filteredSites.length}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">Situs Aktif</p>
                <p className="mt-1 text-2xl font-semibold text-success">{activeSites}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">Sedang Dibuat</p>
                <p className="mt-1 text-2xl font-semibold text-warning">{pendingSites}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">Total Pengguna</p>
                <p className="mt-1 text-2xl font-semibold">-</p>
              </div>
            </div>

            {/* Filters & Search */}
            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Cari situs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-9">
                  <Filter className="mr-2 h-4 w-4" />
                  Filter
                </Button>
                <div className="flex rounded-md border border-border">
                  <Button
                    variant={viewMode === "grid" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-9 rounded-r-none"
                    onClick={() => setViewMode("grid")}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-9 rounded-l-none"
                    onClick={() => setViewMode("list")}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Sites Grid */}
            <div className={`mt-6 grid gap-4 ${
              viewMode === "grid" 
                ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" 
                : "grid-cols-1"
            }`}>
              {filteredSites.map((site) => (
                <SiteCard
                  key={site.id}
                  id={site.id}
                  name={site.name}
                  subdomain={site.subdomain}
                  status={site.status}
                  siteUrl={site.siteUrl}
                  siteHost={site.siteHost}
                  runtimeHealth={site.runtimeHealth}
                  lastActivity={site.lastActivity}
                />
              ))}
            </div>

            {hasLoadedSites && filteredSites.length === 0 && (
              <div className="mt-6 flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 px-6 py-16 text-center">
                <p className="text-muted-foreground">
                  Tidak ada situs yang ditemukan
                </p>
              </div>
            )}
          </div>
        </main>

        <Footer />
      </div>
    </ProtectedRoute>
  )
}
