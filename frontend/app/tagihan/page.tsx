"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  ArrowUpRight,
  CheckCircle2,
  CreditCard,
  Download,
  Loader2,
  Plus,
} from "lucide-react"

import { ProtectedRoute } from "@/components/auth/protected-route"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { SitePlanUpgradeDialog } from "@/components/site-detail/site-plan-upgrade-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  api,
  isAPIError,
  type BillingInvoice,
  type BillingOverview,
  type BillingPaymentMethod,
  type SitePlanChange,
  type SiteSummary,
} from "@/lib/api"
import { formatPrice, getSelfServeUpgradeOptions, getTierByCode } from "@/lib/pricing"
import { siteHostFromURL } from "@/lib/site-url"

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

function formatCount(value?: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    return "-"
  }
  return value.toLocaleString("id-ID")
}

function formatDateTime(value?: string | null): string {
  const trimmed = value?.trim()
  if (!trimmed) {
    return "Belum tersedia"
  }

  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) {
    return "Belum tersedia"
  }

  return date.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function relativeTime(value?: string | null): string {
  const trimmed = value?.trim()
  if (!trimmed) {
    return "Belum tersedia"
  }

  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) {
    return "Belum tersedia"
  }

  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  if (diffMinutes < 1) return "Baru saja"
  if (diffMinutes < 60) return `${diffMinutes} menit lalu`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} jam lalu`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} hari lalu`
}

function formatSiteStatus(status: string) {
  switch (status) {
    case "active":
      return {
        label: "Aktif",
        className: "bg-green-500/10 text-green-600 border-green-500/20",
      }
    case "pending":
    case "provisioning":
      return {
        label: "Sedang disiapkan",
        className: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      }
    case "failed":
      return {
        label: "Gagal",
        className: "bg-red-500/10 text-red-600 border-red-500/20",
      }
    default:
      return {
        label: "Nonaktif",
        className: "bg-muted text-muted-foreground border-border",
      }
  }
}

function quotaTone(site: SiteSummary) {
  if (site.usage?.over_limit || site.usage?.warning_level === "over_limit" || site.usage?.warning_level === "critical") {
    return {
      label: "Kritis",
      className: "bg-red-500/10 text-red-600 border-red-500/20",
    }
  }
  if (site.usage?.warning_level === "warning") {
    return {
      label: "Waspada",
      className: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    }
  }
  return {
    label: "Aman",
    className: "bg-green-500/10 text-green-600 border-green-500/20",
  }
}

function canUpgradeSite(site: SiteSummary) {
  return site.status === "active" && getSelfServeUpgradeOptions(site.plan_code).length > 0
}

function upgradeButtonLabel(site: SiteSummary) {
  if (canUpgradeSite(site)) {
    return "Upgrade Paket"
  }
  if (site.status !== "active") {
    return "Menunggu Aktif"
  }
  if (getSelfServeUpgradeOptions(site.plan_code).length === 0) {
    return "Paket Tertinggi"
  }
  return "Belum Tersedia"
}

function historyStatusBadge(status: string) {
  if (status === "applied") {
    return "bg-green-500/10 text-green-600 border-green-500/20"
  }
  return "bg-muted text-muted-foreground border-border"
}

function invoiceStatusBadge(status: string) {
  switch (status) {
    case "paid":
      return "text-green-600 border-green-500/20"
    case "pending":
      return "text-amber-600 border-amber-500/20"
    case "failed":
    case "expired":
    case "canceled":
      return "text-red-600 border-red-500/20"
    default:
      return "text-muted-foreground border-border"
  }
}

function invoiceStatusLabel(status: string) {
  switch (status) {
    case "paid":
      return "Lunas"
    case "pending":
      return "Pending"
    case "failed":
      return "Gagal"
    case "expired":
      return "Kedaluwarsa"
    case "canceled":
      return "Dibatalkan"
    default:
      return status
  }
}

function formatInvoiceDate(value?: string | null) {
  const trimmed = value?.trim()
  if (!trimmed) {
    return "Belum tersedia"
  }

  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) {
    return "Belum tersedia"
  }

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export default function BillingPage() {
  const [sites, setSites] = useState<SiteSummary[]>([])
  const [planChanges, setPlanChanges] = useState<SitePlanChange[]>([])
  const [invoices, setInvoices] = useState<BillingInvoice[]>([])
  const [paymentMethods, setPaymentMethods] = useState<BillingPaymentMethod[]>([])
  const [subscriptions, setSubscriptions] = useState<BillingOverview["subscriptions"]>([])
  const [loading, setLoading] = useState(true)
  const [loadingError, setLoadingError] = useState("")
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false)
  const [selectedSite, setSelectedSite] = useState<SiteSummary | null>(null)

  const loadBillingContext = useCallback(async () => {
    try {
      const response = await api.getBillingOverview()
      setSites(response.overview.sites ?? [])
      setPlanChanges(response.overview.changes ?? [])
      setInvoices(response.overview.invoices ?? [])
      setPaymentMethods(response.overview.payment_methods ?? [])
      setSubscriptions(response.overview.subscriptions ?? [])
      setLoadingError("")
    } catch (error) {
      setLoadingError(isAPIError(error) ? error.message : "Gagal memuat data langganan situs")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadBillingContext()
  }, [loadBillingContext])

  const siteMap = useMemo(
    () => new Map(sites.map((site) => [site.id, site])),
    [sites],
  )

  const usageSummary = useMemo(() => {
    return sites.reduce(
      (acc, site) => {
        acc.siteCount += 1
        acc.upgradeReady += canUpgradeSite(site) ? 1 : 0
        acc.usersUsed += site.usage?.users_active_count ?? 0
        acc.usersLimit += site.users_active_limit
        acc.storageUsed += site.usage?.storage_bytes_used ?? 0
        acc.storageLimit += site.storage_bytes_limit
        return acc
      },
      {
        siteCount: 0,
        upgradeReady: 0,
        usersUsed: 0,
        usersLimit: 0,
        storageUsed: 0,
        storageLimit: 0,
      },
    )
  }, [sites])

  const selectedPlan = getTierByCode(selectedSite?.plan_code)
  const selectedSubscription = useMemo(
    () => subscriptions.find((subscription) => subscription.site_id === selectedSite?.id) ?? null,
    [selectedSite?.id, subscriptions],
  )

  const handleOpenUpgrade = (site: SiteSummary) => {
    setSelectedSite(site)
    setUpgradeDialogOpen(true)
  }

  const handlePlanChanged = async () => {
    await loadBillingContext()
  }

  const handleLoadRetry = async () => {
    setLoading(true)
    await loadBillingContext()
    if (!loadingError) {
      toast.success("Data tagihan berhasil dimuat ulang")
    }
  }

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen flex-col bg-background">
        <Header />

        <main className="flex-1 py-8">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
              <h1 className="text-2xl font-bold">Tagihan & Langganan</h1>
              <p className="text-muted-foreground mt-1">Kelola upgrade paket per-site dan riwayat perubahan paket seluruh situs Anda</p>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
              <div className="space-y-8 lg:col-span-2">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Langganan Situs Existing</CardTitle>
                      <CardDescription>Semua situs existing bisa dikelola dari sini, termasuk upgrade paket per-site.</CardDescription>
                    </div>
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                      {usageSummary.siteCount} Situs
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-6 grid gap-4 md:grid-cols-3">
                      <div className="rounded-lg border border-border p-4">
                        <p className="text-sm text-muted-foreground">Site siap upgrade</p>
                        <p className="mt-2 text-2xl font-semibold">{formatCount(usageSummary.upgradeReady)}</p>
                      </div>
                      <div className="rounded-lg border border-border p-4">
                        <p className="text-sm text-muted-foreground">Total pengguna aktif</p>
                        <p className="mt-2 text-2xl font-semibold">{formatCount(usageSummary.usersUsed)}</p>
                      </div>
                      <div className="rounded-lg border border-border p-4">
                        <p className="text-sm text-muted-foreground">Total storage terpakai</p>
                        <p className="mt-2 text-2xl font-semibold">{formatBytes(usageSummary.storageUsed)}</p>
                      </div>
                    </div>

                    {loading ? (
                      <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Memuat daftar situs...
                      </div>
                    ) : loadingError ? (
                      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
                        <p className="text-sm font-medium text-red-600">Data tagihan belum bisa dimuat.</p>
                        <p className="mt-1 text-sm text-muted-foreground">{loadingError}</p>
                        <Button variant="outline" size="sm" className="mt-3" onClick={() => void handleLoadRetry()}>
                          Muat Ulang
                        </Button>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Situs</TableHead>
                            <TableHead>Paket Saat Ini</TableHead>
                            <TableHead>Penggunaan</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sites.length > 0 ? (
                            sites.map((site) => {
                              const siteStatus = formatSiteStatus(site.status)
                              const quotaStatus = quotaTone(site)
                              const planTier = getTierByCode(site.plan_code)
                              const nextOptions = getSelfServeUpgradeOptions(site.plan_code)
                              const siteHost = siteHostFromURL(site.site_url, site.subdomain) || site.subdomain

                              return (
                                <TableRow key={site.id}>
                                  <TableCell>
                                    <div>
                                      <Link href={`/situs/${site.subdomain}`} className="font-medium hover:underline">
                                        {site.name}
                                      </Link>
                                      <p className="text-xs text-muted-foreground">{siteHost}</p>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div>
                                      <p className="font-medium">{planTier?.label ?? site.plan_code}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {planTier ? `Rp ${formatPrice(planTier.monthlyPrice)}/bulan` : "Paket existing"}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {nextOptions.length > 0 ? `${nextOptions.length} opsi upgrade tersedia` : "Tidak ada tier lebih tinggi"}
                                      </p>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="space-y-1 text-sm">
                                      <p>{formatCount(site.usage?.users_active_count ?? 0)} / {formatCount(site.users_active_limit)} pengguna</p>
                                      <p>{formatBytes(site.usage?.storage_bytes_used ?? 0)} / {formatBytes(site.storage_bytes_limit)}</p>
                                      <p className="text-xs text-muted-foreground">Update {relativeTime(site.updated_at)}</p>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col gap-2">
                                      <Badge variant="outline" className={siteStatus.className}>
                                        {siteStatus.label}
                                      </Badge>
                                      <Badge variant="outline" className={quotaStatus.className}>
                                        Quota {quotaStatus.label}
                                      </Badge>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={!canUpgradeSite(site)}
                                      onClick={() => handleOpenUpgrade(site)}
                                    >
                                      {upgradeButtonLabel(site)}
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              )
                            })
                          ) : (
                            <TableRow>
                              <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                                Belum ada situs existing di akun ini.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Penggunaan Agregat</CardTitle>
                    <CardDescription>Ringkasan kapasitas seluruh situs existing yang Anda miliki.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <div className="mb-2 flex justify-between text-sm">
                        <span>Situs Moodle</span>
                        <span>{formatCount(usageSummary.siteCount)} site existing</span>
                      </div>
                      <Progress value={Math.min(usageSummary.siteCount * 10, 100)} />
                    </div>

                    <div>
                      <div className="mb-2 flex justify-between text-sm">
                        <span>Total Pengguna Aktif</span>
                        <span>{formatCount(usageSummary.usersUsed)} / {formatCount(usageSummary.usersLimit)}</span>
                      </div>
                      <Progress value={usageSummary.usersLimit > 0 ? (usageSummary.usersUsed / usageSummary.usersLimit) * 100 : 0} />
                    </div>

                    <div>
                      <div className="mb-2 flex justify-between text-sm">
                        <span>Total Storage</span>
                        <span>{formatBytes(usageSummary.storageUsed)} / {formatBytes(usageSummary.storageLimit)}</span>
                      </div>
                      <Progress value={usageSummary.storageLimit > 0 ? (usageSummary.storageUsed / usageSummary.storageLimit) * 100 : 0} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Riwayat Perubahan Paket</CardTitle>
                    <CardDescription>Riwayat upgrade paket sekarang dipusatkan di halaman ini.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Memuat riwayat paket...
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Situs</TableHead>
                            <TableHead>Perubahan</TableHead>
                            <TableHead>Waktu</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {planChanges.length > 0 ? (
                            planChanges.map((change) => {
                              const site = change.site_id ? siteMap.get(change.site_id) : undefined
                              return (
                                <TableRow key={change.id}>
                                  <TableCell>
                                    <div>
                                      <p className="font-medium">{site?.name ?? change.site_name ?? "Situs lama"}</p>
                                      <p className="text-xs text-muted-foreground">{site?.subdomain ?? change.site_subdomain ?? change.site_id ?? "-"}</p>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div>
                                      <p className="font-medium">
                                        {getTierByCode(change.from_plan_code)?.label ?? change.from_plan_code} ke {getTierByCode(change.to_plan_code)?.label ?? change.to_plan_code}
                                      </p>
                                      <p className="text-xs text-muted-foreground">Perubahan paket per-site aktif langsung</p>
                                    </div>
                                  </TableCell>
                                  <TableCell>{formatDateTime(change.applied_at)}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className={historyStatusBadge(change.status)}>
                                      {change.status === "applied" ? "Applied" : change.status}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              )
                            })
                          ) : (
                            <TableRow>
                              <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                                Belum ada perubahan paket untuk situs mana pun.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-8">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Metode Pembayaran</CardTitle>
                    <CardDescription>Metode yang berhasil dipakai untuk checkout akan muncul di sini.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {(paymentMethods.length > 0
                      ? paymentMethods
                      : [
                          {
                            id: "placeholder",
                            brand: "Belum ada kartu aktif",
                            last4: "----",
                            expiry_month: "--",
                            expiry_year: "--",
                            is_default: false,
                          } as BillingPaymentMethod,
                        ]).map((method) => (
                      <div
                        key={method.id}
                        className="flex items-center gap-3 rounded-lg border border-border p-3"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                          <CreditCard className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {method.brand || "Kartu"} **** {method.last4}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Kadaluarsa {method.expiry_month}/{method.expiry_year}
                          </p>
                        </div>
                        {method.is_default ? (
                          <Badge variant="secondary" className="text-xs">Default</Badge>
                        ) : null}
                      </div>
                    ))}
                    <Button variant="outline" className="w-full" disabled>
                      <Plus className="mr-2 h-4 w-4" />
                      Tambah Metode
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Aksi Cepat</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Link href="/harga">
                      <Button variant="ghost" className="w-full justify-between">
                        Lihat Katalog Paket
                        <ArrowUpRight className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Link href="/buat-situs">
                      <Button variant="ghost" className="w-full justify-between">
                        Tambah Situs Baru
                        <ArrowUpRight className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Link href="/dokumentasi">
                      <Button variant="ghost" className="w-full justify-between">
                        Bantuan Billing
                        <ArrowUpRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Riwayat Invoice</CardTitle>
                    <CardDescription>Invoice terbaru untuk upgrade dan renewal site Anda.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(invoices.length > 0
                      ? invoices
                      : [
                          {
                            id: "placeholder",
                            owner_user_id: "",
                            customer_id: "",
                            site_id: null,
                            site_name: "",
                            site_subdomain: "",
                            number: "Belum ada invoice",
                            provider: "",
                            external_id: "",
                            description: "",
                            amount_total: 0,
                            amount_subtotal: 0,
                            amount_tax: 0,
                            status: "pending",
                            currency: "IDR",
                            billing_cycle: "monthly",
                            from_plan_code: "",
                            to_plan_code: "",
                            payment_method_type: "",
                            checkout_url: "",
                            redirect_url: "",
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                          } as BillingInvoice,
                        ]).map((invoice) => (
                      <div key={invoice.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                        <div>
                          <p className="text-sm font-medium">{invoice.number}</p>
                          <p className="text-xs text-muted-foreground">{formatInvoiceDate(invoice.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className={invoiceStatusBadge(invoice.status)}>
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            {invoiceStatusLabel(invoice.status)}
                          </Badge>
                          {invoice.id === "placeholder" ? (
                            <Button variant="ghost" size="sm" disabled>
                              <Download className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Link href={`/tagihan/${invoice.id}`}>
                              <Button variant="ghost" size="sm">
                                <Download className="h-4 w-4" />
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="bg-muted/30">
                  <CardContent className="pt-6">
                    <h3 className="mb-2 font-semibold">Paket Terpilih</h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedSite
                        ? `${selectedSite.name} saat ini memakai ${selectedPlan?.label ?? selectedSite.plan_code}${selectedSubscription ? ` dengan status ${selectedSubscription.status}.` : "."}`
                        : "Pilih salah satu situs existing di atas untuk membuka flow upgrade paket."}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>

        <SitePlanUpgradeDialog
          open={upgradeDialogOpen}
          onOpenChange={setUpgradeDialogOpen}
          site={selectedSite}
          onPlanChanged={handlePlanChanged}
        />

        <Footer />
      </div>
    </ProtectedRoute>
  )
}
