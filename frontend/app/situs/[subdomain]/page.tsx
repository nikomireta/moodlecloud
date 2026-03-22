'use client'

import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { SiteReportTab } from "@/components/dashboard/site-report-tab"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  ExternalLink, 
  Settings, 
  Users, 
  HardDrive, 
  Activity,
  Globe,
  Download,
  RefreshCw,
  ArrowLeft,
  Copy,
  Database,
  Shield,
  Zap,
  BarChart3,
  FileText,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Upload,
  Trash2,
  GraduationCap,
  LineChart,
  MoreHorizontal,
  Bell,
  Mail,
  MessageSquare,
  Send,
  Filter,
  Search,
  AlertTriangle,
  Loader2,
  Info,
  ClipboardList,
  Eye,
  EyeOff,
} from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import Link from "next/link"
import { use, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { buildSiteURL, siteHostFromURL, SITE_BASE_DOMAIN } from "@/lib/site-url"
import {
  api,
  isAPIError,
  type SiteBackupItem,
  type SiteBackupSettings,
  type SiteReportConnectionStatus,
  type SiteRuntimeStatus,
  type SiteSettingsResponse,
  type SiteSummary,
  type SiteUsageSnapshot,
} from "@/lib/api"

// Mockup data
const getSiteData = (subdomain: string) => ({
  id: "1",
  name: subdomain === "smkn1jakarta" ? "SMK Negeri 1 Jakarta" : 
        subdomain === "ut-learning" ? "Universitas Terbuka" :
        subdomain === "sma-hb" ? "SMA Harapan Bangsa" : "Situs Moodle",
  subdomain: subdomain,
  status: "aktif" as const,
  plan: "Professional",
  createdAt: "15 Januari 2024",
  moodleVersion: "4.3.2",
  phpVersion: "8.2",
  stats: {
    users: subdomain === "ut-learning" ? 1250 : subdomain === "smkn1jakarta" ? 450 : 320,
    courses: subdomain === "ut-learning" ? 48 : subdomain === "smkn1jakarta" ? 24 : 12,
    storage: subdomain === "ut-learning" ? "45.2 GB" : subdomain === "smkn1jakarta" ? "12.8 GB" : "5.4 GB",
    bandwidth: subdomain === "ut-learning" ? "128 GB" : subdomain === "smkn1jakarta" ? "45 GB" : "18 GB",
  },
  activity: {
    today: subdomain === "ut-learning" ? 342 : subdomain === "smkn1jakarta" ? 128 : 45,
    weekly: subdomain === "ut-learning" ? 2845 : subdomain === "smkn1jakarta" ? 892 : 312,
  },
})

// Notification triggers and templates for Moodle activities
const notificationTriggers = [
  { id: "assignment_due", name: "Tugas Mendekati Deadline", desc: "Kirim pengingat H-3, H-1, dan hari H deadline tugas", category: "assignment", enabled: true },
  { id: "assignment_late", name: "Tugas Belum Dikumpulkan", desc: "Notifikasi untuk siswa yang melewati deadline", category: "assignment", enabled: true },
  { id: "assignment_graded", name: "Tugas Sudah Dinilai", desc: "Beritahu siswa saat tugas mereka sudah dinilai", category: "assignment", enabled: true },
  { id: "quiz_available", name: "Kuis Tersedia", desc: "Notifikasi saat kuis baru tersedia untuk dikerjakan", category: "quiz", enabled: true },
  { id: "quiz_reminder", name: "Pengingat Kuis", desc: "Ingatkan siswa untuk menyelesaikan kuis sebelum ditutup", category: "quiz", enabled: false },
  { id: "course_enrollment", name: "Enrollment Kursus Baru", desc: "Welcome message untuk siswa baru di kursus", category: "enrollment", enabled: true },
  { id: "course_completion", name: "Kursus Selesai", desc: "Ucapan selamat saat siswa menyelesaikan kursus", category: "completion", enabled: true },
  { id: "forum_reply", name: "Balasan Forum", desc: "Notifikasi saat ada balasan di topik yang diikuti", category: "forum", enabled: false },
  { id: "grade_released", name: "Nilai Dirilis", desc: "Beritahu siswa saat nilai ujian/quiz dirilis", category: "grade", enabled: true },
  { id: "course_update", name: "Update Materi Kursus", desc: "Notifikasi saat ada materi baru di kursus", category: "content", enabled: true },
  { id: "badge_earned", name: "Badge Diperoleh", desc: "Notifikasi saat siswa mendapatkan badge/achievement", category: "achievement", enabled: true },
  { id: "inactivity", name: "Siswa Tidak Aktif", desc: "Kirim reminder ke siswa yang tidak login > 7 hari", category: "engagement", enabled: false },
]

const notificationHistory = [
  { id: "1", type: "assignment_due", title: "Pengingat: Tugas Matematika XI", recipients: 38, sentAt: "Hari ini, 08:00", status: "sent", deliveryRate: 97 },
  { id: "2", type: "quiz_available", title: "Kuis Baru: Fisika Bab 5", recipients: 32, sentAt: "Kemarin, 10:30", status: "sent", deliveryRate: 100 },
  { id: "3", type: "course_enrollment", title: "Selamat Datang di Kimia Organik", recipients: 5, sentAt: "Kemarin, 09:15", status: "sent", deliveryRate: 100 },
  { id: "4", type: "grade_released", title: "Nilai Ujian Tengah Semester", recipients: 120, sentAt: "2 hari lalu", status: "sent", deliveryRate: 95 },
  { id: "5", type: "inactivity", title: "Kami Merindukanmu!", recipients: 12, sentAt: "3 hari lalu", status: "sent", deliveryRate: 83 },
]

const notificationPreferences = {
  channels: { email: true, moodleMessage: true, push: false },
  quietHours: { enabled: true, start: "22:00", end: "07:00" },
  batchDelivery: false,
  allowUnsubscribe: true,
}


function runtimeStatusBadge(status: string) {
  switch (status) {
    case "running":
      return {
        label: "Running",
        className: "text-green-600 border-green-600/50 bg-green-500/10 text-xs",
      }
    case "degraded":
      return {
        label: "Degraded",
        className: "text-amber-600 border-amber-600/50 bg-amber-500/10 text-xs",
      }
    case "stopped":
      return {
        label: "Stopped",
        className: "text-slate-600 border-slate-600/50 bg-slate-500/10 text-xs",
      }
    case "failed":
      return {
        label: "Failed",
        className: "text-red-600 border-red-600/50 bg-red-500/10 text-xs",
      }
    case "provisioning":
      return {
        label: "Provisioning",
        className: "text-orange-600 border-orange-600/50 bg-orange-500/10 text-xs",
      }
    default:
      return {
        label: "Unknown",
        className: "text-muted-foreground border-border bg-muted/30 text-xs",
      }
  }
}

function customDomainBadge(status: string) {
  switch (status) {
    case "active":
      return {
        label: "Aktif",
        className: "text-green-600 border-green-600/50 bg-green-500/10 whitespace-nowrap",
      }
    case "pending_dns":
      return {
        label: "Menunggu DNS",
        className: "text-amber-600 border-amber-600/50 bg-amber-500/10 whitespace-nowrap",
      }
    case "pending_tls":
      return {
        label: "Menunggu SSL",
        className: "text-orange-600 border-orange-600/50 bg-orange-500/10 whitespace-nowrap",
      }
    case "failed":
      return {
        label: "Gagal",
        className: "text-red-600 border-red-600/50 bg-red-500/10 whitespace-nowrap",
      }
    default:
      return {
        label: "Belum Diaktifkan",
        className: "text-muted-foreground border-border bg-background whitespace-nowrap",
      }
  }
}

function findRuntimeService(runtimeStatus: SiteRuntimeStatus | null, name: string) {
  return runtimeStatus?.services.find((service) => service.name === name) ?? null
}

function formatBytes(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    return "Belum tersedia"
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

function formatCount(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    return "Belum tersedia"
  }
  return value.toLocaleString("id-ID")
}

function formatPercentage(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "0%"
  }
  const percent = Math.max(0, Math.min(100, value))
  return `${Math.round(percent)}%`
}

function formatSystemValue(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : "Belum tersedia"
}

type CapacityState = "normal" | "warning" | "critical"
type SummaryAttentionTone = "critical" | "warning" | "normal" | "placeholder"

type SummaryAttentionItem = {
  title: string
  description: string
  tone: SummaryAttentionTone
}

function formatRelativeTimestamp(value?: string | null) {
  const trimmed = value?.trim()
  if (!trimmed) {
    return "Belum dicek"
  }

  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) {
    return "Belum dicek"
  }

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)

  if (diffMinutes < 1) {
    return "Dicek baru saja"
  }
  if (diffMinutes < 60) {
    return `Dicek ${diffMinutes} menit lalu`
  }

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) {
    return `Dicek ${diffHours} jam lalu`
  }

  return `Dicek ${date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}, ${date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  })}`
}

function formatLabel(value?: string | null) {
  const trimmed = value?.trim()
  if (!trimmed) {
    return "Belum tersedia"
  }

  return trimmed
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")
}

function formatBackupTimestamp(value?: string | null) {
  const trimmed = value?.trim()
  if (!trimmed) {
    return "Belum tersedia"
  }

  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) {
    return "Belum tersedia"
  }

  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function humanizeBackupTrigger(trigger: SiteBackupItem["trigger"] | string) {
  return trigger === "scheduled" ? "Otomatis" : "Manual"
}

function getBackupDisplayState(backup: SiteBackupItem) {
  switch (backup.status) {
    case "completed":
      return {
        rowStatus: "success" as const,
        title: "Berhasil",
      }
    case "failed":
      return {
        rowStatus: "failed" as const,
        title: "Gagal",
      }
    default:
      return {
        rowStatus: "processing" as const,
        title: backup.status === "running" ? "Berjalan" : "Menunggu",
      }
  }
}

function createDefaultBackupSettings(siteID?: string | null): SiteBackupSettings {
  return {
    site_id: siteID ?? "",
    enabled: true,
    frequency: "daily",
    retention_days: 30,
    created_at: "",
    updated_at: "",
  }
}

function buildUsageSummary(
  used: number | null,
  limit: number | null,
  formatter: (value?: number | null) => string
) {
  if (typeof limit === "number" && limit > 0) {
    return `${formatter(used)} / ${formatter(limit)}`
  }
  return formatter(used)
}

function getCapacityState(used: number | null, limit: number | null): CapacityState | null {
  if (typeof used !== "number" || typeof limit !== "number" || limit <= 0) {
    return null
  }

  const ratio = used / limit
  if (ratio >= 0.95) {
    return "critical"
  }
  if (ratio >= 0.8) {
    return "warning"
  }
  return "normal"
}

function getCapacityTone(
  state: CapacityState | null,
  used: number | null,
  limit: number | null
) {
  if (state === "critical") {
    const overLimit = typeof used === "number" && typeof limit === "number" && limit > 0 && used >= limit
    return {
      label: overLimit ? "Melebihi batas" : "Kritis",
      textClassName: "text-red-600",
      progressClassName: "bg-red-500",
    }
  }
  if (state === "warning") {
    return {
      label: "Mendekati batas",
      textClassName: "text-amber-600",
      progressClassName: "bg-amber-500",
    }
  }
  if (state === "normal") {
    return {
      label: "Aman",
      textClassName: "text-green-600",
      progressClassName: "bg-green-500",
    }
  }
  return {
    label: "Belum tersedia",
    textClassName: "text-muted-foreground",
    progressClassName: "bg-muted-foreground",
  }
}

function buildPrimaryAlert(params: {
  serviceError: string
  overallStatus?: string
  webStatusText?: string
  cronStatusText?: string
  customDomainStatus?: string
  customDomainError?: string
  warningLevel?: string
  overLimit?: boolean
}) {
  const serviceError = params.serviceError.trim()
  if (serviceError) {
    return {
      title: "Perlu perhatian",
      message: serviceError,
      iconClassName: "text-red-600",
      boxClassName: "bg-red-500/5 border-red-500/20",
    }
  }

  if (params.customDomainStatus === "failed") {
    return {
      title: "Custom domain bermasalah",
      message: params.customDomainError?.trim() || "Aktivasi custom domain gagal. Periksa DNS lalu coba lagi.",
      iconClassName: "text-red-600",
      boxClassName: "bg-red-500/5 border-red-500/20",
    }
  }

  if (params.overallStatus === "failed") {
    return {
      title: "Runtime bermasalah",
      message: "Situs sedang mengalami kegagalan runtime. Periksa layanan Web dan Cron sebelum digunakan.",
      iconClassName: "text-red-600",
      boxClassName: "bg-red-500/5 border-red-500/20",
    }
  }

  if (params.overallStatus === "stopped") {
    return {
      title: "Situs sedang berhenti",
      message: "Layanan situs sedang berhenti. Jalankan Start untuk mengaktifkan kembali situs.",
      iconClassName: "text-amber-600",
      boxClassName: "bg-amber-500/5 border-amber-500/20",
    }
  }

  if (params.overallStatus === "provisioning") {
    return {
      title: "Layanan sedang disiapkan",
      message: "Runtime situs masih dalam proses penyiapan. Tunggu beberapa saat lalu cek kembali.",
      iconClassName: "text-amber-600",
      boxClassName: "bg-amber-500/5 border-amber-500/20",
    }
  }

  if (params.overallStatus === "degraded") {
    const pendingService =
      (params.webStatusText && params.webStatusText !== "Berjalan" && `Web: ${params.webStatusText}`) ||
      (params.cronStatusText && params.cronStatusText !== "Berjalan" && `Cron: ${params.cronStatusText}`)

    return {
      title: "Layanan belum stabil",
      message: pendingService || "Salah satu layanan situs belum sepenuhnya sehat. Pantau status Web dan Cron.",
      iconClassName: "text-amber-600",
      boxClassName: "bg-amber-500/5 border-amber-500/20",
    }
  }

  if (params.overLimit || params.warningLevel === "over_limit") {
    return {
      title: "Batas paket terlampaui",
      message: "Pemakaian resource sudah melewati batas paket. Segera kosongkan resource atau upgrade paket.",
      iconClassName: "text-red-600",
      boxClassName: "bg-red-500/5 border-red-500/20",
    }
  }

  if (params.warningLevel === "critical") {
    return {
      title: "Pemakaian sangat tinggi",
      message: "Pemakaian resource sudah sangat tinggi. Pantau storage dan pengguna aktif secepatnya.",
      iconClassName: "text-amber-600",
      boxClassName: "bg-amber-500/5 border-amber-500/20",
    }
  }

  if (params.warningLevel === "warning") {
    return {
      title: "Mendekati batas paket",
      message: "Pemakaian resource mulai mendekati batas. Pantau kapasitas storage dan pengguna aktif.",
      iconClassName: "text-amber-600",
      boxClassName: "bg-amber-500/5 border-amber-500/20",
    }
  }

  return {
    title: "Semua normal",
    message: "Semua layanan berjalan normal.",
    iconClassName: "text-green-600",
    boxClassName: "bg-green-500/5 border-green-500/20",
  }
}

function buildSummaryHealth(primaryAlertTitle: string) {
  switch (primaryAlertTitle) {
    case "Semua normal":
      return {
        label: "Normal",
        badgeClassName: "text-green-600 border-green-600/50 bg-green-500/10",
      }
    case "Pemakaian sangat tinggi":
    case "Mendekati batas paket":
    case "Layanan belum stabil":
    case "Layanan sedang disiapkan":
      return {
        label: "Perlu perhatian",
        badgeClassName: "text-amber-600 border-amber-600/50 bg-amber-500/10",
      }
    default:
      return {
        label: "Kritis",
        badgeClassName: "text-red-600 border-red-600/50 bg-red-500/10",
      }
  }
}

function buildSummaryAttentionItems(params: {
  storageState: CapacityState | null
  userState: CapacityState | null
  webStatusText?: string
  webHealthStatus?: string
  cronStatusText?: string
  cronHealthStatus?: string
  customDomainStatus?: string
  customDomainError?: string
}) {
  const items: SummaryAttentionItem[] = []

  if (params.storageState === "critical") {
    items.push({
      title: "Storage perlu tindakan segera",
      description: "Pemakaian storage sudah melewati atau hampir menyentuh batas paket.",
      tone: "critical",
    })
  } else if (params.storageState === "warning") {
    items.push({
      title: "Storage mulai menipis",
      description: "Pantau file lama atau siapkan upgrade paket sebelum kapasitas penuh.",
      tone: "warning",
    })
  }

  if (params.userState === "critical") {
    items.push({
      title: "Pengguna aktif melebihi paket",
      description: "Jumlah pengguna aktif saat ini sudah melampaui atau sangat dekat dengan limit paket.",
      tone: "critical",
    })
  } else if (params.userState === "warning") {
    items.push({
      title: "Pengguna aktif mendekati batas",
      description: "Pantau kapasitas pengguna aktif agar tenant tetap stabil saat trafik naik.",
      tone: "warning",
    })
  }

  if (params.webHealthStatus !== "healthy" || (params.webStatusText && params.webStatusText !== "Berjalan")) {
    items.push({
      title: "Layanan web perlu diperiksa",
      description: params.webStatusText ? `Status web saat ini: ${params.webStatusText}.` : "Layanan web belum melaporkan kondisi sehat.",
      tone: "critical",
    })
  }

  if (params.cronHealthStatus !== "healthy" || (params.cronStatusText && params.cronStatusText !== "Berjalan")) {
    items.push({
      title: "Cron belum sehat",
      description: params.cronStatusText ? `Status cron saat ini: ${params.cronStatusText}.` : "Cron belum melaporkan kondisi sehat.",
      tone: "warning",
    })
  }

  if (params.customDomainStatus === "failed") {
    items.push({
      title: "Custom domain bermasalah",
      description: params.customDomainError?.trim() || "Aktivasi custom domain gagal dan perlu pengecekan DNS atau SSL.",
      tone: "critical",
    })
  } else if (params.customDomainStatus === "pending_dns" || params.customDomainStatus === "pending_tls") {
    items.push({
      title: "Custom domain belum selesai",
      description: params.customDomainStatus === "pending_dns" ? "DNS masih menunggu propagasi." : "Sertifikat SSL masih dalam proses penerbitan.",
      tone: "warning",
    })
  }

  if (items.length === 0) {
    items.push({
      title: "Semua indikator utama aman",
      description: "Kapasitas dan layanan inti saat ini tidak menunjukkan masalah yang perlu ditindaklanjuti segera.",
      tone: "normal",
    })
  }

  return items.slice(0, 4)
}



function isRuntimeControllable(runtimeStatus: SiteRuntimeStatus | null) {
  return Boolean(runtimeStatus?.controllable && runtimeStatus.runtime_mode === "docker_local")
}

export default function SiteDetailPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { subdomain } = use(params)
  const mockSite = getSiteData(subdomain)
  const [siteData, setSiteData] = useState<SiteSummary | null>(null)
  const [siteSettings, setSiteSettings] = useState<SiteSettingsResponse | null>(null)
  const [runtimeStatus, setRuntimeStatus] = useState<SiteRuntimeStatus | null>(null)
  const [siteUsage, setSiteUsage] = useState<SiteUsageSnapshot | null>(null)
  const [reportConnection, setReportConnection] = useState<SiteReportConnectionStatus | null>(null)
  const [runtimeError, setRuntimeError] = useState("")
  const [runtimeAction, setRuntimeAction] = useState<"start" | "restart" | "stop" | null>(null)
  const [activeTab, setActiveTab] = useState("ringkasan")
  const [backupSettings, setBackupSettings] = useState<SiteBackupSettings | null>(null)
  const [siteBackups, setSiteBackups] = useState<SiteBackupItem[]>([])
  const [backupLoaded, setBackupLoaded] = useState(false)
  const [loadingBackups, setLoadingBackups] = useState(false)
  const [creatingBackup, setCreatingBackup] = useState(false)
  const [savingBackupSettings, setSavingBackupSettings] = useState(false)
  const [downloadingBackupID, setDownloadingBackupID] = useState<string | null>(null)
  const [siteNameInput, setSiteNameInput] = useState("")
  const [savingSiteName, setSavingSiteName] = useState(false)
  const [customDomainInput, setCustomDomainInput] = useState("")
  const [submittingCustomDomain, setSubmittingCustomDomain] = useState(false)
  const [removingCustomDomain, setRemovingCustomDomain] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
  const [deletingSite, setDeletingSite] = useState(false)

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
    setSiteNameInput(context.site.name)

    if (context.runtimeResult.status === "fulfilled") {
      setRuntimeStatus(context.runtimeResult.value)
      setRuntimeError(context.runtimeResult.value.last_error ?? "")
    } else {
      const error = context.runtimeResult.reason
      setRuntimeError(isAPIError(error) ? error.message : "Gagal memuat status runtime")
    }

    if (context.settingsResult.status === "fulfilled") {
      setSiteSettings(context.settingsResult.value)
      setCustomDomainInput(context.settingsResult.value.custom_domain.domain ?? "")
    } else {
      const error = context.settingsResult.reason
      setRuntimeError((current) => current || (isAPIError(error) ? error.message : "Gagal memuat pengaturan situs"))
    }

    if (context.usageResult.status === "fulfilled") {
      setSiteUsage(context.usageResult.value.usage)
    }
  }

  useEffect(() => {
    if (!siteData) {
      setReportConnection(null)
      return
    }

    let cancelled = false

    const loadReportConnection = async () => {
      try {
        const response = await api.getSiteReportConnection(siteData.id)
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
  }, [siteData?.id])

  const loadBackupContext = async (siteID: string, options?: { silent?: boolean }) => {
    setLoadingBackups(true)
    try {
      const response = await api.getSiteBackups(siteID)
      setBackupSettings(response.settings)
      setSiteBackups(response.backups)
      setBackupLoaded(true)
    } catch (error) {
      if (!options?.silent) {
        toast.error(isAPIError(error) ? error.message : "Gagal memuat backup situs")
      }
    } finally {
      setLoadingBackups(false)
    }
  }

  useEffect(() => {
    const requestedTab = searchParams.get("tab")
    if (requestedTab === "ringkasan" || requestedTab === "laporan" || requestedTab === "backup" || requestedTab === "pengaturan") {
      setActiveTab(requestedTab)
    }
  }, [searchParams])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setBackupSettings(null)
      setSiteBackups([])
      setBackupLoaded(false)
      setLoadingBackups(false)
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
    if (activeTab !== "backup" || !siteData || backupLoaded || loadingBackups) {
      return
    }
    void loadBackupContext(siteData.id)
  }, [activeTab, backupLoaded, loadingBackups, siteData])

  const hasActiveBackup = siteBackups.some((backup) => backup.status === "pending" || backup.status === "running")

  useEffect(() => {
    if (activeTab !== "backup" || !siteData || !backupLoaded || !hasActiveBackup) {
      return
    }

    const intervalID = window.setInterval(() => {
      void loadBackupContext(siteData.id, { silent: true })
    }, 5000)

    return () => {
      window.clearInterval(intervalID)
    }
  }, [activeTab, backupLoaded, hasActiveBackup, siteData])

  const siteUrl = siteData?.site_url ?? buildSiteURL(subdomain)
  const siteHost = siteHostFromURL(siteUrl, subdomain)
  const siteName = siteData?.name ?? mockSite.name
  const runtimeBadge = runtimeStatusBadge(runtimeStatus?.overall_status ?? "unknown")
  const webService = findRuntimeService(runtimeStatus, "web")
  const cronService = findRuntimeService(runtimeStatus, "cron")
  const runtimeMetadata = siteSettings?.runtime ?? runtimeStatus?.runtime ?? null
  const customDomain = siteSettings?.custom_domain ?? null
  const customDomainState = customDomainBadge(customDomain?.status ?? "")
  const customDomainSupported = siteSettings?.custom_domain_enabled ?? false
  const currentDomainHost = customDomain?.status === "active" && customDomain.domain ? customDomain.domain : siteHost
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
  const primaryAlert = buildPrimaryAlert({
    serviceError,
    overallStatus: runtimeStatus?.overall_status,
    webStatusText: webService?.status_text,
    cronStatusText: cronService?.status_text,
    customDomainStatus: customDomain?.status,
    customDomainError: customDomain?.last_error,
    warningLevel: siteUsage?.warning_level,
    overLimit: siteUsage?.over_limit,
  })
  const summaryHealth = buildSummaryHealth(primaryAlert.title)
  const summaryAttentionItems = buildSummaryAttentionItems({
    storageState: storageCapacityState,
    userState: userCapacityState,
    webStatusText: webService?.status_text,
    webHealthStatus: webService?.health_status,
    cronStatusText: cronService?.status_text,
    cronHealthStatus: cronService?.health_status,
    customDomainStatus: customDomain?.status,
    customDomainError: customDomain?.last_error,
  })
  const reportPluginStatusLabel = reportConnection?.state_label ?? "Belum tersedia"
  const reportPluginSummary = reportConnection
    ? reportConnection.state === "not_connected"
      ? "Plugin laporan belum terhubung ke Moodlepilot."
      : reportConnection.state_message
    : "Status plugin laporan belum tersedia."
  const deleteConfirmationMatches = deleteConfirmation.trim() === subdomain
  const canControlRuntime = isRuntimeControllable(runtimeStatus)
  const effectiveBackupSettings = backupSettings ?? createDefaultBackupSettings(siteData?.id)
  const backupItems = siteBackups
  const canStart =
    canControlRuntime &&
    ((webService?.state ?? "unknown") !== "running" || (cronService?.state ?? "unknown") !== "running")
  const canRestart = canControlRuntime && ["running", "degraded", "unknown"].includes(runtimeStatus?.overall_status ?? "")
  const canStop =
    canControlRuntime &&
    ((webService?.state ?? "unknown") === "running" || (cronService?.state ?? "unknown") === "running")

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

  const handleCopyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} disalin`)
    } catch {
      toast.error(`Gagal menyalin ${label.toLowerCase()}`)
    }
  }

  const handleCopyUrl = () => {
    void handleCopyText(siteUrl, "URL situs")
  }

  const handleSiteTabChange = (tab: string) => {
    setActiveTab(tab)
    router.replace(`/situs/${subdomain}?tab=${tab}`, { scroll: false })
  }

  const handleCreateBackup = async () => {
    if (!siteData) {
      return
    }

    setCreatingBackup(true)
    try {
      const response = await api.createSiteBackup(siteData.id)
      setSiteBackups((current) => [response.backup, ...current.filter((item) => item.id !== response.backup.id)])
      setBackupLoaded(true)
      toast.success(response.message)
    } catch (error) {
      toast.error(isAPIError(error) ? error.message : "Gagal menjalankan backup")
    } finally {
      setCreatingBackup(false)
    }
  }

  const handleDownloadBackup = async (backup: SiteBackupItem) => {
    if (!siteData) {
      return
    }

    setDownloadingBackupID(backup.id)
    try {
      const blob = await api.downloadSiteBackup(siteData.id, backup.id)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `site-backup-${backup.site_subdomain}.tar.gz`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      toast.error(isAPIError(error) ? error.message : "Gagal mengunduh backup")
    } finally {
      setDownloadingBackupID(null)
    }
  }

  const handleSaveBackupSettings = async () => {
    if (!siteData) {
      return
    }

    setSavingBackupSettings(true)
    try {
      const response = await api.updateSiteBackupSettings(siteData.id, {
        enabled: effectiveBackupSettings.enabled,
        frequency: effectiveBackupSettings.frequency,
        retentionDays: effectiveBackupSettings.retention_days,
      })
      setBackupSettings(response.settings)
      setBackupLoaded(true)
      toast.success(response.message)
    } catch (error) {
      toast.error(isAPIError(error) ? error.message : "Gagal menyimpan pengaturan backup")
    } finally {
      setSavingBackupSettings(false)
    }
  }

  const handleSaveSiteName = async () => {
    if (!siteData || !siteNameInput.trim()) {
      return
    }

    setSavingSiteName(true)
    try {
      const response = await api.updateSite(siteData.id, { name: siteNameInput.trim() })
      setSiteData(response.site)
      setSiteSettings((current) => current ? { ...current, site: response.site } : current)
      toast.success(response.message)
    } catch (error) {
      toast.error(isAPIError(error) ? error.message : "Gagal menyimpan nama situs")
    } finally {
      setSavingSiteName(false)
    }
  }

  const handleSubmitCustomDomain = async () => {
    if (!siteData || !customDomainInput.trim()) {
      return
    }

    setSubmittingCustomDomain(true)
    try {
      const response = await api.upsertSiteCustomDomain(siteData.id, customDomainInput.trim())
      const nextSite = response.site ?? siteData
      setSiteData(nextSite)
      setSiteSettings((current) => {
        if (!current) {
          return current
        }
        return {
          ...current,
          site: nextSite,
          custom_domain: response.custom_domain,
        }
      })
      if (response.custom_domain?.status === "active") {
        const runtime = await api.getSiteRuntime(siteData.id)
        setRuntimeStatus(runtime)
        setRuntimeError(runtime.last_error ?? "")
      }
      toast.success(response.message)
    } catch (error) {
      toast.error(isAPIError(error) ? error.message : "Gagal menyimpan custom domain")
    } finally {
      setSubmittingCustomDomain(false)
    }
  }

  const handleDeleteCustomDomain = async () => {
    if (!siteData) {
      return
    }

    setRemovingCustomDomain(true)
    try {
      const response = await api.deleteSiteCustomDomain(siteData.id)
      const runtime = await api.getSiteRuntime(siteData.id)
      const settings = await api.getSiteSettings(siteData.id)
      setSiteData(response.site)
      setRuntimeStatus(runtime)
      setRuntimeError(runtime.last_error ?? "")
      setSiteSettings(settings)
      setCustomDomainInput("")
      toast.success(response.message)
    } catch (error) {
      toast.error(isAPIError(error) ? error.message : "Gagal melepas custom domain")
    } finally {
      setRemovingCustomDomain(false)
    }
  }

  const handleDeleteSite = async () => {
    if (!siteData) {
      return
    }

    setDeletingSite(true)
    try {
      const response = await api.deleteSite(siteData.id, deleteConfirmation)
      toast.success(response.message)
      router.push("/dashboard")
    } catch (error) {
      toast.error(isAPIError(error) ? error.message : "Gagal menghapus situs")
    } finally {
      setDeletingSite(false)
    }
  }

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
      
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <Link 
            href="/dashboard" 
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Dashboard
          </Link>

          {/* Site Header */}
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
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-muted-foreground">{siteHost}</span>
                  <button onClick={handleCopyUrl} className="text-muted-foreground hover:text-foreground">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <span>Web: {webService?.status_text ?? "-"}</span>
                  <span>•</span>
                  <span>Cron: {cronService?.status_text ?? "-"}</span>
                  {(runtimeError || runtimeStatus?.last_error) ? (
                    <>
                      <span>•</span>
                      <span>{runtimeError || runtimeStatus?.last_error}</span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {canControlRuntime ? (
                <>
                  <Button
                    variant="outline"
                    className="border-border"
                    onClick={() => handleRuntimeAction("start")}
                    disabled={!canStart || runtimeAction !== null}
                  >
                    Start
                  </Button>
                  <Button
                    variant="outline"
                    className="border-border"
                    onClick={() => handleRuntimeAction("restart")}
                    disabled={!canRestart || runtimeAction !== null}
                  >
                    Restart
                  </Button>
                  <Button
                    variant="outline"
                    className="border-border"
                    onClick={() => handleRuntimeAction("stop")}
                    disabled={!canStop || runtimeAction !== null}
                  >
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

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={handleSiteTabChange} className="w-full space-y-6">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 xl:w-auto xl:inline-grid">
              <TabsTrigger value="ringkasan">Ringkasan</TabsTrigger>
              <TabsTrigger value="laporan">Laporan</TabsTrigger>
              <TabsTrigger value="backup">Backup</TabsTrigger>
              <TabsTrigger value="pengaturan">Pengaturan</TabsTrigger>
            </TabsList>

            {/* Tab: Ringkasan */}
            <TabsContent value="ringkasan" className="space-y-4">
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
            </TabsContent>

            {/* Tab: Laporan */}
            <TabsContent value="laporan" className="space-y-6">
              {siteData ? (
                <SiteReportTab siteID={siteData.id} siteName={siteName} siteSubdomain={siteData.subdomain} />
              ) : (
                <Card className="p-12 border-border text-center border-dashed">
                  <Loader2 className="h-10 w-10 mx-auto text-muted-foreground mb-3 animate-spin" />
                  <p className="text-sm font-medium">Memuat data situs...</p>
                </Card>
              )}
            </TabsContent>

            {/* Tab: Backup */}
            <TabsContent value="backup" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-3">
                <Card className="p-6 border-border lg:col-span-2">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-semibold">Riwayat Backup</h3>
                    <Button size="sm" onClick={handleCreateBackup} disabled={!siteData || creatingBackup}>
                      {creatingBackup ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="mr-2 h-4 w-4" />
                      )}
                      Backup Sekarang
                    </Button>
                  </div>
                  <div className="border border-border rounded-lg divide-y divide-border">
                    {backupItems.map((backup) => {
                      const displayState = getBackupDisplayState(backup)

                      return (
                        <div key={backup.id} className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                              displayState.rowStatus === "success"
                                ? "bg-green-500/10"
                                : displayState.rowStatus === "failed"
                                  ? "bg-red-500/10"
                                  : "bg-amber-500/10"
                            }`}>
                              {displayState.rowStatus === "success" ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : displayState.rowStatus === "failed" ? (
                                <AlertCircle className="h-4 w-4 text-red-500" />
                              ) : (
                                <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{formatBackupTimestamp(backup.completed_at ?? backup.started_at ?? backup.created_at)}</p>
                              <p className="text-xs text-muted-foreground">{backup.status === "completed" ? formatBytes(backup.size_bytes) : "Belum tersedia"} - {humanizeBackupTrigger(backup.trigger)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={backup.status !== "completed" || downloadingBackupID === backup.id}
                              onClick={() => handleDownloadBackup(backup)}
                            >
                              {downloadingBackupID === backup.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                            </Button>
                            <Button variant="ghost" size="sm" disabled>
                              <Upload className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Card>

                <Card className="p-6 border-border">
                  <h3 className="font-semibold mb-4">Pengaturan Backup</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="auto-backup" className="text-sm text-muted-foreground">Backup Otomatis</Label>
                      <Switch
                        id="auto-backup"
                        checked={effectiveBackupSettings.enabled}
                        disabled={loadingBackups}
                        onCheckedChange={(checked) =>
                          setBackupSettings((current) => ({
                            ...(current ?? createDefaultBackupSettings(siteData?.id)),
                            enabled: checked,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Frekuensi</Label>
                      <Select
                        value={effectiveBackupSettings.frequency}
                        onValueChange={(value: "daily" | "weekly" | "monthly") =>
                          setBackupSettings((current) => ({
                            ...(current ?? createDefaultBackupSettings(siteData?.id)),
                            frequency: value,
                          }))
                        }
                        disabled={loadingBackups}
                      >
                        <SelectTrigger className="mt-2 border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Harian</SelectItem>
                          <SelectItem value="weekly">Mingguan</SelectItem>
                          <SelectItem value="monthly">Bulanan</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Retensi</Label>
                      <Select
                        value={String(effectiveBackupSettings.retention_days)}
                        onValueChange={(value) =>
                          setBackupSettings((current) => ({
                            ...(current ?? createDefaultBackupSettings(siteData?.id)),
                            retention_days: Number(value),
                          }))
                        }
                        disabled={loadingBackups}
                      >
                        <SelectTrigger className="mt-2 border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">7 Hari</SelectItem>
                          <SelectItem value="30">30 Hari</SelectItem>
                          <SelectItem value="90">90 Hari</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button className="w-full mt-4" onClick={handleSaveBackupSettings} disabled={!siteData || loadingBackups || savingBackupSettings}>
                      {savingBackupSettings ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Menyimpan...
                        </>
                      ) : (
                        "Simpan Pengaturan"
                      )}
                    </Button>
                  </div>
                </Card>
              </div>
            </TabsContent>

            {/* Tab: Pengaturan */}
            <TabsContent value="pengaturan" className="space-y-6">
              {/* Site Information */}
              <Card className="p-6 border-border">
                <h3 className="font-semibold mb-4">Informasi Situs</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-muted-foreground">Nama Situs</Label>
                    <Input value={siteNameInput} onChange={(event) => setSiteNameInput(event.target.value)} className="mt-2 border-border" />
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Subdomain</Label>
                    <Input defaultValue={subdomain} disabled className="mt-2 border-border bg-muted/50" />
                  </div>
                </div>
                <Button className="mt-6" onClick={handleSaveSiteName} disabled={savingSiteName || !siteNameInput.trim() || siteNameInput.trim() === siteName}>
                  {savingSiteName ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    "Simpan Perubahan"
                  )}
                </Button>
              </Card>

              {/* Custom Domain */}
              <Card className="p-6 border-border">
                <h3 className="font-semibold mb-4">Custom Domain</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Hubungkan domain kustom Anda ke situs Moodle ini. Domain akan otomatis mendapatkan SSL certificate.
                </p>
                <div className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Domain Saat Ini</Label>
                    <div className="flex items-center gap-2 mt-2">
                      <Input value={currentDomainHost} disabled className="border-border bg-muted/50" />
                      <Badge variant="outline" className={customDomainState.className}>{customDomainState.label}</Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Custom Domain</Label>
                    <div className="flex items-center gap-2 mt-2">
                      <Input
                        placeholder="contoh: lms.sekolah.sch.id"
                        className="border-border"
                        value={customDomainInput}
                        onChange={(event) => setCustomDomainInput(event.target.value)}
                        disabled={!customDomainSupported || submittingCustomDomain || removingCustomDomain}
                      />
                      <Button
                        variant="outline"
                        className="border-border whitespace-nowrap"
                        onClick={handleSubmitCustomDomain}
                        disabled={!customDomainSupported || !customDomainInput.trim() || submittingCustomDomain || removingCustomDomain}
                      >
                        {submittingCustomDomain ? "Menyimpan..." : "Tambah Domain"}
                      </Button>
                      {customDomain?.domain ? (
                        <Button
                          variant="outline"
                          className="border-border whitespace-nowrap"
                          onClick={handleDeleteCustomDomain}
                          disabled={submittingCustomDomain || removingCustomDomain}
                        >
                          {removingCustomDomain ? "Memproses..." : "Lepas Domain"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {!customDomainSupported ? (
                    <div className="p-4 rounded-lg bg-muted/30 border border-border">
                      <p className="text-sm font-medium mb-1">Custom domain belum tersedia</p>
                      <p className="text-xs text-muted-foreground">
                        Fitur ini baru aktif di environment yang sudah memiliki DNS publik dan Traefik ACME.
                      </p>
                    </div>
                  ) : null}
                  {customDomain?.last_error ? (
                    <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/30">
                      <p className="text-sm font-medium text-destructive mb-1">Status Verifikasi</p>
                      <p className="text-xs text-muted-foreground">{customDomain.last_error}</p>
                    </div>
                  ) : null}
                  <div className="p-4 rounded-lg bg-muted/30 border border-border">
                    <p className="text-sm font-medium mb-2">Konfigurasi DNS</p>
                    <p className="text-xs text-muted-foreground mb-3">
                      Tambahkan record berikut ke DNS provider Anda:
                    </p>
                    <div className="space-y-2 font-mono text-xs">
                      <div className="flex items-center justify-between p-2 bg-background rounded border border-border">
                        <span className="text-muted-foreground">CNAME</span>
                        <span>{customDomain?.cname_target || `cname.${SITE_BASE_DOMAIN}`}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-background rounded border border-border">
                        <span className="text-muted-foreground">TXT</span>
                        <span>{customDomain?.txt_name && customDomain?.txt_value ? `${customDomain.txt_name} = ${customDomain.txt_value}` : "-"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Server Configuration */}
              <Card className="p-6 border-border">
                <h3 className="font-semibold mb-4">Konfigurasi Server</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-sm font-medium">Runtime Mode</p>
                    <p className="text-xs text-muted-foreground mt-1 break-all">{runtimeStatus?.runtime_mode ?? "-"}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-sm font-medium">Image</p>
                    <p className="text-xs text-muted-foreground mt-1 break-all">
                      {runtimeMetadata ? `${runtimeMetadata.image_repository}:${runtimeMetadata.image_tag}` : "-"}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-sm font-medium">Database</p>
                    <p className="text-xs text-muted-foreground mt-1 break-all">{runtimeMetadata?.database_name ?? "-"}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-sm font-medium">Volume</p>
                    <p className="text-xs text-muted-foreground mt-1 break-all">{runtimeMetadata?.volume_name ?? "-"}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-sm font-medium">Web Container</p>
                    <p className="text-xs text-muted-foreground mt-1 break-all">{runtimeMetadata?.web_container_name ?? "-"}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-sm font-medium">Cron Container</p>
                    <p className="text-xs text-muted-foreground mt-1 break-all">{runtimeMetadata?.cron_container_name ?? "-"}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 sm:col-span-2">
                    <p className="text-sm font-medium">Health</p>
                    <p className="text-xs text-muted-foreground mt-1 break-all">
                      {runtimeMetadata?.health_status ?? runtimeStatus?.overall_status ?? "-"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2 break-all">
                      {runtimeMetadata?.last_health_checked_at
                        ? `Pemeriksaan terakhir: ${new Date(runtimeMetadata.last_health_checked_at).toLocaleString("id-ID")}`
                        : "Belum ada pemeriksaan health yang tersimpan"}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Danger Zone */}
              <Card className="p-6 border-destructive/50">
                <h3 className="font-semibold text-destructive mb-4">Zona Berbahaya</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                    <div>
                      <p className="text-sm font-medium">Hapus Situs</p>
                      <p className="text-xs text-muted-foreground">Hapus situs secara permanen beserta container, volume, dan database</p>
                    </div>
                    <Button variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Hapus
                    </Button>
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>

          <AlertDialog
            open={deleteDialogOpen}
            onOpenChange={(open) => {
              setDeleteDialogOpen(open)
              if (!open) {
                setDeleteConfirmation("")
              }
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Hapus situs ini?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tindakan ini akan menghapus situs, runtime Docker, volume, dan database secara permanen. Untuk melanjutkan, ketik subdomain <span className="font-medium text-foreground">{subdomain}</span>.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2 py-2">
                <Label htmlFor="delete-site-confirmation">Konfirmasi subdomain</Label>
                <Input
                  id="delete-site-confirmation"
                  value={deleteConfirmation}
                  onChange={(event) => setDeleteConfirmation(event.target.value)}
                  placeholder={subdomain}
                  className="border-border"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deletingSite}>Batal</AlertDialogCancel>
                <Button variant="destructive" onClick={handleDeleteSite} disabled={!deleteConfirmationMatches || deletingSite}>
                  {deletingSite ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Menghapus...
                    </>
                  ) : (
                    "Hapus Situs"
                  )}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </main>

        <Footer />
      </div>
    </ProtectedRoute>
  )
}
