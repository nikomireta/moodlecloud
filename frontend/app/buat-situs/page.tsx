"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { ArrowLeft, ArrowRight, Check, Globe, Loader2, Info } from "lucide-react"
import Link from "next/link"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { useAuth } from "@/components/providers/auth-provider"
import { api, isAPIError } from "@/lib/api"
import { buildSiteURL, SITE_BASE_DOMAIN } from "@/lib/site-url"

type Step = 1 | 2 | 3

interface FormData {
  siteName: string
  subdomain: string
  adminName: string
  adminEmail: string
  plan: string
  region: string
}

export default function BuatSitusPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [isValidating, setIsValidating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null)
  const [emailError, setEmailError] = useState("")
  const [formData, setFormData] = useState<FormData>({
    siteName: "",
    subdomain: "",
    adminName: "",
    adminEmail: "",
    plan: "",
    region: "",
  })

  const steps = [
    { number: 1, title: "Informasi Situs" },
    { number: 2, title: "Konfigurasi" },
    { number: 3, title: "Konfirmasi" },
  ]

  useEffect(() => {
    if (!user) {
      return
    }

    setFormData((current) => ({
      ...current,
      adminName: current.adminName || user.name,
      adminEmail: current.adminEmail || user.email,
    }))
  }, [user])

  const handleSubdomainChange = (value: string) => {
    const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, "")
    setFormData({ ...formData, subdomain: sanitized })
    setSubdomainAvailable(null)
  }

  const validateSubdomain = async () => {
    if (!formData.subdomain) return
    setIsValidating(true)
    try {
      const response = await api.getSubdomainAvailability(formData.subdomain)
      setSubdomainAvailable(response.available)
    } catch (error) {
      console.error("failed to validate subdomain", error)
      setSubdomainAvailable(false)
    } finally {
      setIsValidating(false)
    }
  }

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleEmailChange = (value: string) => {
    setFormData({ ...formData, adminEmail: value })
    if (value && !validateEmail(value)) {
      setEmailError("Format email tidak valid")
    } else {
      setEmailError("")
    }
  }

  const isEmailValid = formData.adminEmail && validateEmail(formData.adminEmail)

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep((prev) => (prev + 1) as Step)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as Step)
    }
  }

  const handleSubmit = async () => {
    if (isSubmitting) {
      return
    }

    setIsSubmitting(true)
    try {
      const response = await api.createSite({
        name: formData.siteName,
        subdomain: formData.subdomain,
        planCode: formData.plan,
        region: formData.region,
        adminName: formData.adminName,
        adminEmail: formData.adminEmail,
      })
      const nextSubdomain = response.site.subdomain || formData.subdomain || "demo"
      const completed = response.site.status === "active" || response.job.status === "active"

      router.push(completed ? `/situs-berhasil/${nextSubdomain}` : `/proses-pembuatan/${nextSubdomain}`)
    } catch (error) {
      console.error("failed to create site", error)
      if (isAPIError(error) && error.status === 409) {
        setCurrentStep(1)
        setSubdomainAvailable(false)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const isStep1Valid = formData.siteName && formData.subdomain && subdomainAvailable
  const isStep2Valid = formData.adminName && isEmailValid && formData.plan && formData.region
  const previewSiteURL = formData.subdomain ? buildSiteURL(formData.subdomain) : ""

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        
        <main className="flex-1">
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Back Button */}
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Dashboard
          </Link>

          {/* Page Header */}
          <div className="mt-6">
            <h1 className="text-2xl font-semibold tracking-tight">Buat Situs Moodle Baru</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ikuti langkah-langkah berikut untuk membuat situs Moodle baru Anda
            </p>
          </div>

          {/* Progress Steps */}
          <div className="mt-8">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => (
                <div key={step.number} className="flex items-center">
                  <div className="flex items-center">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                        currentStep > step.number
                          ? "bg-foreground text-background"
                          : currentStep === step.number
                          ? "bg-foreground text-background"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {currentStep > step.number ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        step.number
                      )}
                    </div>
                    <span
                      className={`ml-2 hidden text-sm sm:block ${
                        currentStep >= step.number
                          ? "text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`mx-4 h-px w-8 sm:w-16 lg:w-24 ${
                        currentStep > step.number ? "bg-foreground" : "bg-border"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Form Card */}
          <Card className="mt-8 border-border">
            {/* Step 1: Site Information */}
            {currentStep === 1 && (
              <>
                <CardHeader>
                  <CardTitle className="text-lg">Informasi Situs</CardTitle>
                  <CardDescription>
                    Masukkan nama dan subdomain untuk situs Moodle Anda
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="siteName">Nama Situs</Label>
                    <Input
                      id="siteName"
                      placeholder="contoh: SMK Negeri 1 Jakarta"
                      value={formData.siteName}
                      onChange={(e) =>
                        setFormData({ ...formData, siteName: e.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Nama ini akan ditampilkan sebagai judul situs Moodle Anda
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subdomain">Subdomain</Label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Input
                          id="subdomain"
                          placeholder="contoh: smkn1jakarta"
                          value={formData.subdomain}
                          onChange={(e) => handleSubdomainChange(e.target.value)}
                          onBlur={validateSubdomain}
                          className="pr-10"
                        />
                        {isValidating && (
                          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                        )}
                        {!isValidating && subdomainAvailable === true && (
                          <Check className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-success" />
                        )}
                      </div>
                      <span className="shrink-0 text-sm text-muted-foreground">
                        .{SITE_BASE_DOMAIN}
                      </span>
                    </div>
                    {subdomainAvailable === false && (
                      <p className="text-xs text-destructive">
                        Subdomain tidak tersedia. Silakan pilih yang lain.
                      </p>
                    )}
                    {subdomainAvailable === true && (
                      <p className="text-xs text-success">
                        Subdomain tersedia!
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Hanya huruf kecil, angka, dan tanda hubung yang diperbolehkan
                    </p>
                  </div>

                  {formData.subdomain && subdomainAvailable && (
                    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-4">
                      <Globe className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">URL Situs Anda</p>
                        <p className="text-sm text-muted-foreground">
                          {previewSiteURL}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </>
            )}

            {/* Step 2: Configuration */}
            {currentStep === 2 && (
              <>
                <CardHeader>
                  <CardTitle className="text-lg">Konfigurasi</CardTitle>
                  <CardDescription>
                    Atur akun administrator dan pilih paket layanan
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="adminName">Nama Administrator</Label>
                      <Input
                        id="adminName"
                        placeholder="Nama lengkap"
                        value={formData.adminName}
                        onChange={(e) =>
                          setFormData({ ...formData, adminName: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="adminEmail">Email Administrator</Label>
                      <Input
                        id="adminEmail"
                        type="email"
                        placeholder="admin@example.com"
                        value={formData.adminEmail}
                        onChange={(e) => handleEmailChange(e.target.value)}
                        className={emailError ? "border-destructive focus-visible:ring-destructive" : ""}
                      />
                      {emailError && (
                        <p className="text-xs text-destructive">{emailError}</p>
                      )}
                      {formData.adminEmail && !emailError && (
                        <p className="text-xs text-success">Email valid</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="plan">Paket Layanan</Label>
                    <Select
                      value={formData.plan}
                      onValueChange={(value) =>
                        setFormData({ ...formData, plan: value })
                      }
                    >
                      <SelectTrigger id="plan">
                        <SelectValue placeholder="Pilih paket layanan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="starter">
                          <div className="flex flex-col items-start">
                            <span>Starter - Gratis</span>
                            <span className="text-xs text-muted-foreground">Hingga 50 pengguna</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="professional">
                          <div className="flex flex-col items-start">
                            <span>Professional - Rp 750.000/bulan</span>
                            <span className="text-xs text-muted-foreground">Hingga 2.000 pengguna</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="enterprise">
                          <div className="flex flex-col items-start">
                            <span>Enterprise - Hubungi Sales</span>
                            <span className="text-xs text-muted-foreground">Tidak terbatas</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="region">Lokasi Server</Label>
                    <Select
                      value={formData.region}
                      onValueChange={(value) =>
                        setFormData({ ...formData, region: value })
                      }
                    >
                      <SelectTrigger id="region">
                        <SelectValue placeholder="Pilih lokasi server" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="jakarta">Jakarta, Indonesia</SelectItem>
                        <SelectItem value="singapore">Singapura</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Pilih lokasi server terdekat untuk performa terbaik
                    </p>
                  </div>
                </CardContent>
              </>
            )}

            {/* Step 3: Confirmation */}
            {currentStep === 3 && (
              <>
                <CardHeader>
                  <CardTitle className="text-lg">Konfirmasi</CardTitle>
                  <CardDescription>
                    Periksa kembali detail situs Moodle yang akan dibuat
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Nama Situs</span>
                      <span className="text-sm font-medium">{formData.siteName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">URL</span>
                      <span className="text-sm font-medium">
                        {previewSiteURL}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Administrator</span>
                      <span className="text-sm font-medium">{formData.adminName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Email</span>
                      <span className="text-sm font-medium">{formData.adminEmail}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Paket</span>
                      <span className="text-sm font-medium capitalize">{formData.plan}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Lokasi Server</span>
                      <span className="text-sm font-medium capitalize">{formData.region}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/50 p-4">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="text-sm text-muted-foreground">
                      <p>
                        Setelah mengklik tombol {"'"}Buat Situs{"'"}, proses pembuatan akan dimulai dan
                        biasanya membutuhkan waktu 2-5 menit. Anda akan menerima email
                        notifikasi ketika situs siap digunakan.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between border-t border-border p-6">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Kembali
              </Button>
              
              {currentStep < 3 ? (
                <Button
                  onClick={handleNext}
                  disabled={
                    (currentStep === 1 && !isStep1Valid) ||
                    (currentStep === 2 && !isStep2Valid)
                  }
                >
                  Lanjut
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  Buat Situs
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </Card>
        </div>
        </main>

        <Footer />
      </div>
    </ProtectedRoute>
  )
}
