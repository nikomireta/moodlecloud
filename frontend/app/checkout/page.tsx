'use client'

import { useCallback, useEffect, useMemo, useState } from "react"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { CheckCircle2, CreditCard, Building2, Wallet, Shield, ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"
import Script from "next/script"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { api, type BillingInvoice, type BillingInvoiceResponse, type BillingProviderConfig, type SiteCheckoutOrder } from "@/lib/api"
import { getTierByCode } from "@/lib/pricing"

declare global {
  interface Window {
    MidtransNew3ds?: {
      getCardToken: (
        card: {
          card_number: string
          card_exp_month: string
          card_exp_year: string
          card_cvv: string
        },
        callbacks: {
          onSuccess: (response: { token_id: string }) => void
          onFailure: (response: { status_message?: string }) => void
        },
      ) => void
      authenticate: (
        redirectURL: string,
        callbacks: {
          performAuthentication?: (redirectURL: string) => void
          onSuccess?: (response: unknown) => void
          onPending?: (response: unknown) => void
          onFailure?: (response: { status_message?: string }) => void
        },
      ) => void
    }
  }
}

const fallbackSelectedPlan = {
  name: "Professional",
  price: 499000,
  period: "bulan",
  features: [
    "Hingga 5 situs Moodle",
    "1.000 pengguna per situs",
    "100 GB storage",
    "Backup harian",
    "Support prioritas",
  ],
}

const paymentMethods = [
  {
    id: "card",
    name: "Kartu Kredit/Debit",
    description: "Visa, Mastercard, JCB",
    icon: CreditCard,
  },
  {
    id: "bank",
    name: "Transfer Bank",
    description: "BCA, Mandiri, BNI, BRI",
    icon: Building2,
  },
  {
    id: "ewallet",
    name: "E-Wallet",
    description: "GoPay, OVO, DANA, ShopeePay",
    icon: Wallet,
  },
]

function formatPrice(price: number) {
  return new Intl.NumberFormat("id-ID").format(price)
}

function normalizeBillingCycle(value?: string | null) {
  return value === "yearly" ? "yearly" : "monthly"
}

function buildSelectedPlan(planCode?: string | null, billingCycle: "monthly" | "yearly" = "monthly") {
  const tier = getTierByCode(planCode)
  if (!tier) {
    return fallbackSelectedPlan
  }

  return {
    name: tier.label,
    price: billingCycle === "yearly" ? tier.yearlyPrice : tier.monthlyPrice,
    period: billingCycle === "yearly" ? "tahun" : "bulan",
    features: [
      "1 situs Moodle",
      tier.usersLabel,
      `${tier.storageLabel} storage`,
      ...tier.highlights.slice(0, 2),
    ],
  }
}

function formatInvoiceNumber(invoice?: BillingInvoice | null) {
  return invoice?.number ?? "INV-2026031012345"
}

type CheckoutPageClientProps = {
  invoiceRef?: string
}

export function CheckoutPageClient({ invoiceRef = "" }: CheckoutPageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const siteID = searchParams.get("site_id") ?? ""
  const targetPlanCode = searchParams.get("target_plan_code") ?? ""
  const siteName = searchParams.get("site_name") ?? ""
  const siteSubdomain = searchParams.get("subdomain") ?? ""
  const sitePlanCode = searchParams.get("plan_code") ?? ""
  const siteRegion = searchParams.get("region") ?? "jakarta"
  const siteAdminName = searchParams.get("admin_name") ?? ""
  const siteAdminEmail = searchParams.get("admin_email") ?? ""
  const invoiceUUID = searchParams.get("invoice_uuid") ?? ""
  const invoiceID = searchParams.get("invoice_id") ?? ""
  const orderID = searchParams.get("order_id") ?? ""
  const billingCycle = normalizeBillingCycle(searchParams.get("billing_cycle"))
  const isBillingCheckout = siteID !== "" && targetPlanCode !== ""
  const isSiteCheckout = siteName !== "" && siteSubdomain !== "" && sitePlanCode !== ""

  const [paymentMethod, setPaymentMethod] = useState("card")
  const [isProcessing, setIsProcessing] = useState(false)
  const [step, setStep] = useState<"info" | "payment" | "processing" | "success">("info")
  const [providerConfig, setProviderConfig] = useState<BillingProviderConfig | null>(null)
  const [midtransReady, setMidtransReady] = useState(false)
  const [invoice, setInvoice] = useState<BillingInvoice | null>(null)
  const [checkoutOrder, setCheckoutOrder] = useState<SiteCheckoutOrder | null>(null)

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    organization: "",
    cardNumber: "",
    cardExpiry: "",
    cardCvv: "",
    cardName: "",
  })

  const selectedPlan = useMemo(
    () => buildSelectedPlan(invoice?.to_plan_code || targetPlanCode || sitePlanCode || null, billingCycle),
    [billingCycle, invoice?.to_plan_code, sitePlanCode, targetPlanCode],
  )

  const applyInvoiceDetail = useCallback((response: BillingInvoiceResponse) => {
    setInvoice(response.invoice)
    setCheckoutOrder(response.checkout_order ?? null)
    if (response.invoice.status === "paid" && response.checkout_order?.subdomain) {
      router.replace(`/proses-pembuatan/${response.checkout_order.subdomain}`)
      return true
    }
    return response.invoice.status === "paid"
  }, [router])

  const pollInvoiceUntilPaid = useCallback(async (id: string, maxAttempts = 12) => {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const response = await api.getBillingInvoice(id)
        const paid = applyInvoiceDetail(response)
        if (paid) {
          setIsProcessing(false)
          if (!response.checkout_order?.subdomain) {
            setStep("success")
          }
          return true
        }
        if (["failed", "expired", "canceled"].includes(response.invoice.status)) {
          setIsProcessing(false)
          setStep("info")
          toast.error("Status pembayaran berakhir tanpa sukses. Coba lagi dari halaman tagihan.")
          return false
        }
      } catch (error) {
        console.error("poll invoice failed", error)
      }
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
    return false
  }, [applyInvoiceDetail])

  useEffect(() => {
    let active = true

    async function bootstrap() {
      try {
        const [configResponse, meResponse] = await Promise.all([
          api.getBillingConfig(),
          (isBillingCheckout || isSiteCheckout) ? api.getMe().catch(() => null) : Promise.resolve(null),
        ])
        if (!active) {
          return
        }
        setProviderConfig(configResponse)
        if (meResponse?.user) {
          setFormData((current) => ({
            ...current,
            fullName: current.fullName || meResponse.user.name || "",
            email: current.email || meResponse.user.email || "",
            phone: current.phone || meResponse.user.phone || "",
            organization: current.organization || meResponse.user.organization || "",
          }))
        }
      } catch (error) {
        console.error("checkout bootstrap failed", error)
      }
    }

    void bootstrap()
    return () => {
      active = false
    }
  }, [isBillingCheckout, isSiteCheckout])

  useEffect(() => {
    let active = true
    const candidates = Array.from(new Set([invoiceRef, orderID, invoiceUUID, invoiceID].filter(Boolean)))
    if (candidates.length === 0) {
      return
    }

    async function loadInvoice() {
      let lastError: unknown = null
      for (const candidate of candidates) {
        try {
          const response = await api.getBillingInvoice(candidate)
          if (!active) {
            return
          }
          const paid = applyInvoiceDetail(response)
          if (paid && !response.checkout_order?.subdomain) {
            setStep("success")
          }
          return
        } catch (error) {
          lastError = error
        }
      }
      console.error("load invoice failed", lastError)
    }

    void loadInvoice()
    return () => {
      active = false
    }
  }, [applyInvoiceDetail, invoiceID, invoiceRef, invoiceUUID, orderID])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  const submitCheckout = useCallback(async (cardTokenID?: string) => {
    const response = isSiteCheckout
      ? await api.createSiteCheckout({
          siteName,
          subdomain: siteSubdomain,
          planCode: sitePlanCode,
          billingCycle,
          region: siteRegion,
          adminName: siteAdminName,
          adminEmail: siteAdminEmail,
          paymentMethodType: paymentMethod as "card" | "bank" | "ewallet",
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          organization: formData.organization,
          cardTokenID,
        })
      : await api.createBillingCheckout({
          siteID,
          targetPlanCode,
          billingCycle,
          paymentMethodType: paymentMethod as "card" | "bank" | "ewallet",
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          organization: formData.organization,
          cardTokenID,
        })

    setProviderConfig(response.provider)
    setInvoice(response.invoice)
    setCheckoutOrder(null)

    if (response.invoice.status === "paid") {
      setIsProcessing(false)
      if (isSiteCheckout) {
        router.replace(`/proses-pembuatan/${siteSubdomain}`)
      } else {
        setStep("success")
      }
      return
    }

    if (paymentMethod !== "card" && response.invoice.checkout_url) {
      window.location.assign(response.invoice.checkout_url)
      return
    }

    if (paymentMethod === "card" && response.attempt.redirect_url && window.MidtransNew3ds) {
      window.MidtransNew3ds.authenticate(response.attempt.redirect_url, {
        onSuccess: async () => {
          const paid = await pollInvoiceUntilPaid(response.invoice.id)
          if (!paid) {
            setIsProcessing(false)
            setStep("info")
          }
        },
        onPending: async () => {
          const paid = await pollInvoiceUntilPaid(response.invoice.id)
          if (!paid) {
            setIsProcessing(false)
            setStep("info")
          }
        },
        onFailure: (result) => {
          setIsProcessing(false)
          setStep("info")
          toast.error(result.status_message || "Pembayaran kartu gagal diproses")
        },
      })
      return
    }

    const paid = await pollInvoiceUntilPaid(response.invoice.id, 8)
    if (!paid) {
      setIsProcessing(false)
      setStep("info")
    }
  }, [billingCycle, formData.email, formData.fullName, formData.organization, formData.phone, isSiteCheckout, paymentMethod, pollInvoiceUntilPaid, router, siteAdminEmail, siteAdminName, siteID, siteName, sitePlanCode, siteRegion, siteSubdomain, targetPlanCode])

  const handleSubmit = async () => {
    setIsProcessing(true)
    setStep("processing")

    if (!isBillingCheckout && !isSiteCheckout) {
      await new Promise((resolve) => setTimeout(resolve, 3000))
      setIsProcessing(false)
      setStep("success")
      return
    }

    try {
      if (paymentMethod !== "card") {
        await submitCheckout()
        return
      }

      if (providerConfig?.provider !== "midtrans") {
        await submitCheckout()
        return
      }

      if (!midtransReady || !window.MidtransNew3ds) {
        throw new Error("Midtrans belum siap dimuat")
      }

      const [expMonthRaw, expYearRaw] = formData.cardExpiry.split("/")
      const expMonth = (expMonthRaw || "").trim()
      const expYearInput = (expYearRaw || "").trim()
      const expYear = expYearInput.length === 2 ? `20${expYearInput}` : expYearInput

      await new Promise<void>((resolve, reject) => {
        window.MidtransNew3ds?.getCardToken(
          {
            card_number: formData.cardNumber,
            card_exp_month: expMonth,
            card_exp_year: expYear,
            card_cvv: formData.cardCvv,
          },
          {
            onSuccess: async (response) => {
              try {
                await submitCheckout(response.token_id)
                resolve()
              } catch (error) {
                reject(error)
              }
            },
            onFailure: (response) => {
              reject(new Error(response.status_message || "Gagal membuat token kartu"))
            },
          },
        )
      })
    } catch (error) {
      console.error("checkout failed", error)
      setIsProcessing(false)
      setStep("info")
      toast.error(error instanceof Error ? error.message : "Checkout gagal diproses")
    }
  }

  if (step === "success") {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        {providerConfig?.provider === "midtrans" && providerConfig.script_url ? (
          <Script
            id="midtrans-script-success"
            src={providerConfig.script_url}
            data-environment={providerConfig.environment}
            data-client-key={providerConfig.client_key}
            strategy="afterInteractive"
          />
        ) : null}
        <Header />
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full text-center">
            <CardContent className="pt-8 pb-8">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Pembayaran Berhasil!</h1>
              <p className="text-muted-foreground mb-6">
                Terima kasih telah berlangganan paket {selectedPlan.name}. Akun Anda telah diaktifkan.
              </p>
              <div className="bg-muted/50 rounded-lg p-4 mb-6 text-left">
                <p className="text-sm text-muted-foreground mb-1">Nomor Invoice</p>
                <p className="font-mono font-medium">{formatInvoiceNumber(invoice)}</p>
              </div>
              <div className="space-y-3">
                <Link href="/dashboard" className="block">
                  <Button className="w-full">Ke Dashboard</Button>
                </Link>
                <Link href="/buat-situs" className="block">
                  <Button variant="outline" className="w-full">Buat Situs Pertama</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    )
  }

  if (step === "processing") {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full text-center">
            <CardContent className="pt-8 pb-8">
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-6 text-primary" />
              <h1 className="text-xl font-bold mb-2">Memproses Pembayaran...</h1>
              <p className="text-muted-foreground">
                Mohon tunggu, jangan tutup halaman ini
              </p>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {providerConfig?.provider === "midtrans" && providerConfig.script_url ? (
        <Script
          id="midtrans-script"
          src={providerConfig.script_url}
          data-environment={providerConfig.environment}
          data-client-key={providerConfig.client_key}
          strategy="afterInteractive"
          onLoad={() => setMidtransReady(true)}
        />
      ) : null}
      <Header />

      <main className="flex-1 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <Link href={isSiteCheckout ? "/buat-situs" : "/harga"}>
            <Button variant="ghost" size="sm" className="mb-6">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {isSiteCheckout ? "Kembali ke Buat Situs" : "Kembali ke Harga"}
            </Button>
          </Link>

          <div className="grid lg:grid-cols-[1fr_400px] gap-8">
            <div className="space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">1</span>
                    Informasi Pelanggan
                  </CardTitle>
                  <CardDescription>Isi data diri Anda untuk melanjutkan</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Nama Lengkap</Label>
                      <Input
                        id="fullName"
                        name="fullName"
                        placeholder="John Doe"
                        value={formData.fullName}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="john@example.com"
                        value={formData.email}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Nomor Telepon</Label>
                      <Input
                        id="phone"
                        name="phone"
                        placeholder="08123456789"
                        value={formData.phone}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="organization">Nama Institusi (Opsional)</Label>
                      <Input
                        id="organization"
                        name="organization"
                        placeholder="Nama sekolah atau organisasi"
                        value={formData.organization}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">2</span>
                    Metode Pembayaran
                  </CardTitle>
                  <CardDescription>Pilih metode pembayaran yang Anda inginkan</CardDescription>
                </CardHeader>
                <CardContent>
                  <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-3">
                    {paymentMethods.map((method) => {
                      const Icon = method.icon
                      return (
                        <div key={method.id}>
                          <RadioGroupItem
                            value={method.id}
                            id={method.id}
                            className="peer sr-only"
                          />
                          <Label
                            htmlFor={method.id}
                            className="flex items-center gap-4 rounded-lg border-2 border-border p-4 cursor-pointer hover:bg-muted/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 transition-colors"
                          >
                            <Icon className="h-5 w-5 text-muted-foreground" />
                            <div className="flex-1">
                              <p className="font-medium">{method.name}</p>
                              <p className="text-sm text-muted-foreground">{method.description}</p>
                            </div>
                          </Label>
                        </div>
                      )
                    })}
                  </RadioGroup>

                  {paymentMethod === "card" && (
                    <div className="mt-6 space-y-4 pt-6 border-t border-border">
                      <div className="space-y-2">
                        <Label htmlFor="cardNumber">Nomor Kartu</Label>
                        <Input
                          id="cardNumber"
                          name="cardNumber"
                          placeholder="1234 5678 9012 3456"
                          value={formData.cardNumber}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="cardExpiry">Tanggal Kadaluarsa</Label>
                          <Input
                            id="cardExpiry"
                            name="cardExpiry"
                            placeholder="MM/YY"
                            value={formData.cardExpiry}
                            onChange={handleInputChange}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cardCvv">CVV</Label>
                          <Input
                            id="cardCvv"
                            name="cardCvv"
                            placeholder="123"
                            value={formData.cardCvv}
                            onChange={handleInputChange}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cardName">Nama di Kartu</Label>
                        <Input
                          id="cardName"
                          name="cardName"
                          placeholder="JOHN DOE"
                          value={formData.cardName}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>
                  )}

                  {paymentMethod === "bank" && (
                    <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        Setelah checkout, Anda akan menerima instruksi transfer bank melalui email.
                      </p>
                    </div>
                  )}

                  {paymentMethod === "ewallet" && (
                    <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        Anda akan diarahkan ke halaman pembayaran e-wallet setelah checkout.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Shield className="h-5 w-5" />
                <p>Pembayaran Anda dilindungi dengan enkripsi SSL 256-bit</p>
              </div>
            </div>

            <div>
              <Card className="sticky top-8">
                <CardHeader>
                  <CardTitle>Ringkasan Pesanan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{selectedPlan.name}</h3>
                      <Badge>{billingCycle === "yearly" ? "Tahunan" : "Bulanan"}</Badge>
                    </div>
                    <ul className="space-y-2">
                      {selectedPlan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>Rp {formatPrice(selectedPlan.price)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">PPN (11%)</span>
                      <span>Rp {formatPrice(Math.round(selectedPlan.price * 0.11))}</span>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex justify-between font-semibold text-lg">
                    <span>Total</span>
                    <span>Rp {formatPrice(Math.round(selectedPlan.price * 1.11))}</span>
                  </div>

                  <Button className="w-full" size="lg" onClick={handleSubmit} disabled={isProcessing}>
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Memproses...
                      </>
                    ) : (
                      "Bayar Sekarang"
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    Dengan melanjutkan, Anda menyetujui{" "}
                    <Link href="/syarat-layanan" className="underline">Syarat & Ketentuan</Link>
                    {" "}dan{" "}
                    <Link href="/kebijakan-privasi" className="underline">Kebijakan Privasi</Link>
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default function CheckoutPage() {
  return <CheckoutPageClient />
}
