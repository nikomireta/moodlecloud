"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react"

import { ProtectedRoute } from "@/components/auth/protected-route"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { api, isAPIError, type BillingInvoiceResponse } from "@/lib/api"
import { formatPrice, getTierByCode } from "@/lib/pricing"

function statusLabel(status: string) {
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

function statusClassName(status: string) {
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

function formatDateTime(value?: string | null) {
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

export default function BillingInvoiceDetailPage() {
  const params = useParams<{ invoiceRef: string }>()
  const router = useRouter()
  const [detail, setDetail] = useState<BillingInvoiceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [continuing, setContinuing] = useState(false)
  const [loadingError, setLoadingError] = useState("")
  const invoiceRef = typeof params?.invoiceRef === "string" ? params.invoiceRef : ""

  useEffect(() => {
    let active = true

    async function loadParamsAndInvoice() {
      if (!active) {
        return
      }

      try {
        const response = await api.getBillingInvoice(invoiceRef)
        if (!active) {
          return
        }
        setDetail(response)
        setLoadingError("")
      } catch (error) {
        if (!active) {
          return
        }
        setLoadingError(isAPIError(error) ? error.message : "Gagal memuat detail invoice")
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    if (!invoiceRef) {
      setLoading(false)
      setLoadingError("Invoice tidak ditemukan")
      return () => {
        active = false
      }
    }

    void loadParamsAndInvoice()
    return () => {
      active = false
    }
  }, [invoiceRef])

  const handleContinueCheckout = async () => {
    if (!detail || continuing) {
      return
    }

    setContinuing(true)
    try {
      const response = await api.continueBillingInvoiceCheckout(detail.invoice.id)
      if (response.invoice.checkout_url) {
        window.location.assign(response.invoice.checkout_url)
        return
      }
      router.push(`/checkout/${response.invoice.id}`)
    } catch (error) {
      toast.error(isAPIError(error) ? error.message : "Gagal melanjutkan pembayaran")
      setContinuing(false)
    }
  }

  const planLabel = getTierByCode(detail?.invoice.to_plan_code || detail?.invoice.from_plan_code || "")?.label

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen flex-col bg-background">
        <Header />

        <main className="flex-1 py-8">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <Link href="/tagihan">
              <Button variant="ghost" size="sm" className="mb-6">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Kembali ke Tagihan
              </Button>
            </Link>

            {loading ? (
              <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Memuat detail invoice...
              </div>
            ) : loadingError || !detail ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm font-medium text-red-600">Detail invoice belum bisa dimuat.</p>
                  <p className="mt-1 text-sm text-muted-foreground">{loadingError || "Invoice tidak ditemukan"}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>{detail.invoice.number}</CardTitle>
                      <CardDescription>{detail.invoice.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between rounded-lg border border-border p-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Status</p>
                          <Badge variant="outline" className={statusClassName(detail.invoice.status)}>
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            {statusLabel(detail.invoice.status)}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Total</p>
                          <p className="text-xl font-semibold">Rp {formatPrice(detail.invoice.amount_total)}</p>
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-lg border border-border p-4">
                          <p className="text-sm text-muted-foreground">Situs</p>
                          <p className="mt-1 font-medium">{detail.site_snapshot.site_name || "Situs lama"}</p>
                          <p className="text-xs text-muted-foreground">{detail.site_snapshot.site_subdomain || "-"}</p>
                        </div>
                        <div className="rounded-lg border border-border p-4">
                          <p className="text-sm text-muted-foreground">Paket</p>
                          <p className="mt-1 font-medium">{planLabel || detail.invoice.to_plan_code || detail.invoice.from_plan_code || "-"}</p>
                          <p className="text-xs text-muted-foreground">{detail.invoice.billing_cycle === "yearly" ? "Tahunan" : "Bulanan"}</p>
                        </div>
                      </div>

                      <div className="rounded-lg border border-border p-4">
                        <p className="mb-3 text-sm text-muted-foreground">Item Invoice</p>
                        <div className="space-y-3">
                          {detail.items.map((item) => (
                            <div key={item.id} className="flex items-start justify-between gap-4">
                              <div>
                                <p className="font-medium">{item.name}</p>
                                <p className="text-sm text-muted-foreground">{item.description}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-muted-foreground">{item.quantity} x Rp {formatPrice(item.unit_amount)}</p>
                                <p className="font-medium">Rp {formatPrice(item.total_amount)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Attempt Terakhir</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-sm text-muted-foreground">Metode</p>
                        <p className="font-medium">{detail.latest_attempt?.payment_method_type || detail.invoice.payment_method_type || "-"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Status Attempt</p>
                        <p className="font-medium">{detail.latest_attempt?.status || "-"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Dibuat</p>
                        <p className="font-medium">{formatDateTime(detail.invoice.created_at)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Jatuh Tempo</p>
                        <p className="font-medium">{formatDateTime(detail.invoice.expires_at)}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-sm text-muted-foreground">Keterangan</p>
                        <p className="font-medium">{detail.latest_attempt?.failure_reason || "Belum ada error"}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Ringkasan</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Invoice Ref</p>
                        <p className="font-mono text-sm">{invoiceRef}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Checkout Order</p>
                        <p className="font-medium">{detail.checkout_order?.status || "Tidak ada"}</p>
                      </div>
                      {detail.invoice.status === "pending" ? (
                        <Button className="w-full" onClick={() => void handleContinueCheckout()} disabled={continuing}>
                          {continuing ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Menyiapkan...
                            </>
                          ) : (
                            "Lanjutkan Pembayaran"
                          )}
                        </Button>
                      ) : null}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </div>
        </main>

        <Footer />
      </div>
    </ProtectedRoute>
  )
}
