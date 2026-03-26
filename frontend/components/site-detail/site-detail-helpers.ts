import { SiteRuntimeStatus, SiteBackupItem, SiteBackupSettings } from "@/lib/api"

export function runtimeStatusBadge(status: string) {
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

export function customDomainBadge(status: string) {
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

export function findRuntimeService(runtimeStatus: SiteRuntimeStatus | null, name: string) {
  return runtimeStatus?.services.find((service) => service.name === name) ?? null
}

export function formatBytes(value?: number | null) {
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

export function formatCount(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    return "Belum tersedia"
  }
  return value.toLocaleString("id-ID")
}

export function formatPercentage(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "0%"
  }
  const percent = Math.max(0, Math.min(100, value))
  return `${Math.round(percent)}%`
}

export function formatSystemValue(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : "Belum tersedia"
}

export type CapacityState = "normal" | "warning" | "critical"
export type SummaryAttentionTone = "critical" | "warning" | "normal" | "placeholder"

export type SummaryAttentionItem = {
  title: string
  description: string
  tone: SummaryAttentionTone
}

export function formatRelativeTimestamp(value?: string | null) {
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

export function formatLabel(value?: string | null) {
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

export function formatBackupTimestamp(value?: string | null) {
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

export function humanizeBackupTrigger(trigger: SiteBackupItem["trigger"] | string) {
  return trigger === "scheduled" ? "Otomatis" : "Manual"
}

export function getBackupDisplayState(backup: SiteBackupItem) {
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

export function createDefaultBackupSettings(siteID?: string | null): SiteBackupSettings {
  return {
    site_id: siteID ?? "",
    enabled: true,
    frequency: "daily",
    retention_days: 30,
    created_at: "",
    updated_at: "",
  }
}

export function buildUsageSummary(
  used: number | null,
  limit: number | null,
  formatter: (value?: number | null) => string
) {
  if (typeof limit === "number" && limit > 0) {
    return `${formatter(used)} / ${formatter(limit)}`
  }
  return formatter(used)
}

export function getCapacityState(used: number | null, limit: number | null): CapacityState | null {
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

export function getCapacityTone(
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

export function buildPrimaryAlert(params: {
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
      message: "Pemakaian resource sudah melewati batas paket. Tenant tetap bisa dikelola, tetapi upload baru dan aktivasi user baru diblok sampai usage turun atau paket di-upgrade.",
      iconClassName: "text-red-600",
      boxClassName: "bg-red-500/5 border-red-500/20",
    }
  }

  if (params.warningLevel === "critical") {
    return {
      title: "Pemakaian sangat tinggi",
      message: "Pemakaian resource sudah sangat tinggi. Pantau storage dan pengguna aktif secepatnya, lalu kurangi usage atau siapkan upgrade paket.",
      iconClassName: "text-amber-600",
      boxClassName: "bg-amber-500/5 border-amber-500/20",
    }
  }

  if (params.warningLevel === "warning") {
    return {
      title: "Mendekati batas paket",
      message: "Pemakaian resource mulai mendekati batas. Pantau kapasitas storage dan pengguna aktif agar tenant tetap stabil saat trafik naik.",
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

export function buildSummaryHealth(primaryAlertTitle: string) {
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

export function buildSummaryAttentionItems(params: {
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

  if (params.webHealthStatus && params.webHealthStatus !== "healthy") {
    items.push({
      title: "Layanan web perlu diperiksa",
      description: params.webStatusText ? `Status web saat ini: ${params.webStatusText}.` : "Layanan web belum melaporkan kondisi sehat.",
      tone: "critical",
    })
  } else if (params.webStatusText && params.webStatusText !== "Berjalan") {
    items.push({
      title: "Layanan web perlu diperiksa",
      description: `Status web saat ini: ${params.webStatusText}.`,
      tone: "critical",
    })
  }

  if (params.cronHealthStatus && params.cronHealthStatus !== "healthy") {
    items.push({
      title: "Cron belum sehat",
      description: params.cronStatusText ? `Status cron saat ini: ${params.cronStatusText}.` : "Cron belum melaporkan kondisi sehat.",
      tone: "warning",
    })
  } else if (params.cronStatusText && params.cronStatusText !== "Berjalan") {
    items.push({
      title: "Cron belum sehat",
      description: `Status cron saat ini: ${params.cronStatusText}.`,
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

export function isRuntimeControllable(runtimeStatus: SiteRuntimeStatus | null) {
  return Boolean(runtimeStatus?.controllable && runtimeStatus.runtime_mode === "docker_local")
}
