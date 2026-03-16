"use client"

import { use, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Check,
  Circle,
  Loader2,
  ExternalLink,
  Clock,
  Server,
  Database,
  Shield,
  Globe,
  ArrowLeft,
} from "lucide-react"
import Link from "next/link"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { api, type ProvisioningStep } from "@/lib/api"
import { buildSiteURL, siteHostFromURL } from "@/lib/site-url"

type StepStatus = "pending" | "in_progress" | "completed" | "error"

interface CreationStep {
  id: string
  title: string
  description: string
  status: StepStatus
  icon: React.ComponentType<{ className?: string }>
  duration?: string
}

const STEP_CONFIG: Record<string, Omit<CreationStep, "status" | "duration">> = {
  provision: {
    id: "provision",
    title: "Menyiapkan Server",
    description: "Mengalokasikan sumber daya server untuk situs Anda",
    icon: Server,
  },
  database: {
    id: "database",
    title: "Membuat Database",
    description: "Menyiapkan database PostgreSQL untuk Moodle",
    icon: Database,
  },
  install: {
    id: "install",
    title: "Instalasi Moodle",
    description: "Menginstal dan mengkonfigurasi Moodle versi terbaru",
    icon: Globe,
  },
  ssl: {
    id: "ssl",
    title: "Konfigurasi SSL",
    description: "Memvalidasi route situs melalui proxy aplikasi",
    icon: Shield,
  },
  finalize: {
    id: "finalize",
    title: "Finalisasi",
    description: "Menyelesaikan konfigurasi dan menyiapkan akun admin",
    icon: Check,
  },
}

const STEP_ORDER = ["provision", "database", "install", "ssl", "finalize"]

function formatDuration(step: ProvisioningStep): string | undefined {
  if (step.status !== "completed") {
    return undefined
  }

  const start = Date.parse(step.created_at)
  const end = Date.parse(step.updated_at)
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return undefined
  }

  return `${((end - start) / 1000).toFixed(1)}d`
}

function buildDefaultSteps(): CreationStep[] {
  return STEP_ORDER.map((stepID) => ({
    ...STEP_CONFIG[stepID],
    status: "pending",
  }))
}

function mapStepStatus(status: string | undefined): StepStatus {
  switch (status) {
    case "completed":
      return "completed"
    case "in_progress":
      return "in_progress"
    case "failed":
      return "error"
    default:
      return "pending"
  }
}

function mapSteps(steps: ProvisioningStep[] | undefined): CreationStep[] {
  const byID = new Map(steps?.map((step) => [step.step_id, step]) ?? [])

  return STEP_ORDER.map((stepID) => {
    const step = byID.get(stepID)
    return {
      ...STEP_CONFIG[stepID],
      status: mapStepStatus(step?.status),
      duration: step ? formatDuration(step) : undefined,
    }
  })
}

export default function ProsesPembuatanPage({
  params,
}: {
  params: Promise<{ subdomain: string }>
}) {
  const { subdomain } = use(params)
  const router = useRouter()
  const redirectScheduledRef = useRef(false)
  const pollingStoppedRef = useRef(false)
  const [isComplete, setIsComplete] = useState(false)
  const [isFailed, setIsFailed] = useState(false)
  const [progress, setProgress] = useState(0)
  const [siteURL, setSiteURL] = useState(buildSiteURL(subdomain))
  const [steps, setSteps] = useState<CreationStep[]>(buildDefaultSteps)
  const [lastError, setLastError] = useState("")

  useEffect(() => {
    let cancelled = false
    pollingStoppedRef.current = false
    redirectScheduledRef.current = false

    async function loadStatus() {
      try {
        const siteResponse = await api.getSiteBySubdomain(subdomain)
        if (cancelled) {
          return
        }

        setSiteURL(siteResponse.site.site_url)

        const provisioning = await api.getProvisioningStatus(siteResponse.site.id)
        if (cancelled) {
          return
        }

        setSteps(mapSteps(provisioning.steps))
        setProgress(Math.max(0, Math.min(100, provisioning.job.percent)))
        setLastError(provisioning.job.last_error || provisioning.site.last_error || "")

        const completed = provisioning.site.status === "active" || provisioning.job.status === "active"
        const failed = provisioning.site.status === "failed" || provisioning.job.status === "failed"
        setIsComplete(completed)
        setIsFailed(failed)

        if (completed || failed) {
          pollingStoppedRef.current = true
        }

        if (completed && !redirectScheduledRef.current) {
          redirectScheduledRef.current = true
          window.setTimeout(() => {
            router.push(`/situs-berhasil/${subdomain}`)
          }, 1500)
        }
      } catch (error) {
        console.error("failed to load provisioning status", error)
      }
    }

    void loadStatus()
    const intervalID = window.setInterval(() => {
      if (pollingStoppedRef.current) {
        window.clearInterval(intervalID)
        return
      }
      void loadStatus()
    }, 3000)

    return () => {
      cancelled = true
      pollingStoppedRef.current = true
      window.clearInterval(intervalID)
    }
  }, [router, subdomain])

  const completedSteps = useMemo(
    () => steps.filter((step) => step.status === "completed").length,
    [steps]
  )

  const host = siteHostFromURL(siteURL, subdomain)

  const getStatusIcon = (status: StepStatus, Icon: React.ComponentType<{ className?: string }>) => {
    switch (status) {
      case "completed":
        return <Check className="h-4 w-4 text-success" />
      case "in_progress":
        return <Loader2 className="h-4 w-4 animate-spin text-foreground" />
      case "error":
        return <Circle className="h-4 w-4 text-destructive" />
      default:
        return <Icon className="h-4 w-4 text-muted-foreground" />
    }
  }

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen flex-col bg-background">
        <Header />

        <main className="flex-1">
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Back Button */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Dashboard
          </Link>

          {/* Status Header */}
          <div className="mt-6">
            <div className="flex items-center gap-3">
              {!isComplete ? (
                isFailed ? (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive">
                    <Circle className="h-5 w-5 text-destructive-foreground" />
                  </div>
                ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground">
                  <Loader2 className="h-5 w-5 animate-spin text-background" />
                </div>
                )
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success">
                  <Check className="h-5 w-5 text-success-foreground" />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  {isComplete
                    ? "Situs Berhasil Dibuat!"
                    : isFailed
                    ? "Proses Pembuatan Terhenti"
                    : "Sedang Membuat Situs..."}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {host}
                </p>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-8">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-foreground transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Status Message Card */}
          <Card className="mt-6 border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {isComplete
                    ? "Proses selesai!"
                    : isFailed
                    ? "Proses memerlukan perhatian"
                    : `Langkah ${Math.min(completedSteps + 1, steps.length)} dari ${steps.length}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isComplete
                    ? "Situs Moodle Anda siap digunakan"
                    : isFailed
                    ? (lastError || "Silakan cek kembali detail provisioning situs Anda")
                    : "Estimasi waktu tersisa: 2-5 menit"}
                </p>
              </div>
            </div>
          </Card>

          {/* Steps List */}
          <div className="mt-8 space-y-1">
            <h2 className="mb-4 text-sm font-medium text-muted-foreground">
              Detail Proses
            </h2>
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`flex items-start gap-4 rounded-lg border border-transparent p-3 transition-colors ${
                  step.status === "in_progress" ? "border-border bg-muted/50" : ""
                }`}
              >
                {/* Step Number & Line */}
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors ${
                      step.status === "completed"
                        ? "border-success bg-success/10"
                        : step.status === "in_progress"
                        ? "border-foreground bg-foreground/10"
                        : step.status === "error"
                        ? "border-destructive bg-destructive/10"
                        : "border-border bg-background"
                    }`}
                  >
                    {getStatusIcon(step.status, step.icon)}
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`mt-1 h-8 w-0.5 transition-colors ${
                        step.status === "completed" ? "bg-success" : "bg-border"
                      }`}
                    />
                  )}
                </div>

                {/* Step Content */}
                <div className="flex-1 pb-4">
                  <div className="flex items-center justify-between">
                    <h3
                      className={`text-sm font-medium ${
                        step.status === "pending"
                          ? "text-muted-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {step.title}
                    </h3>
                    {step.status === "completed" && step.duration && (
                      <span className="text-xs text-muted-foreground">
                        {step.duration}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {step.description}
                  </p>

                  {/* Expanded content for in-progress step */}
                  {(step.status === "in_progress" || step.status === "error") && (
                    <div className="mt-3 rounded-md bg-background p-3 font-mono text-xs text-muted-foreground">
                      {step.status === "error" ? (
                        <div className="flex items-center gap-2">
                          <span className="text-destructive">!</span>
                          <span>{lastError || "Provisioning step failed."}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-success">$</span>
                          <span className="animate-pulse">
                            {step.id === "provision" && "Preparing Docker runtime resources..."}
                            {step.id === "database" && "CREATE DATABASE moodle_site;"}
                            {step.id === "install" && "php admin/cli/install_database.php --agree-license"}
                            {step.id === "ssl" && "Validating route via Traefik..."}
                            {step.id === "finalize" && "Finalizing Moodle site activation..."}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          {isComplete && (
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={`/situs-berhasil/${subdomain}`} className="flex-1">
                <Button className="w-full">
                  Lihat Detail Situs
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/" className="flex-1">
                <Button variant="outline" className="w-full">
                  Kembali ke Dashboard
                </Button>
              </Link>
            </div>
          )}

          {/* Info Card */}
          <Card className="mt-8 border-border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Catatan:</strong> Proses pembuatan situs berjalan di
              latar belakang. Anda dapat meninggalkan halaman ini dan kami akan mengirimkan
              email notifikasi ketika situs Anda siap digunakan.
            </p>
          </Card>
        </div>
        </main>

        <Footer />
      </div>
    </ProtectedRoute>
  )
}
