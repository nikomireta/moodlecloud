"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { MoreHorizontal, Globe, Clock, Users, Play, RotateCcw, Square, Database, Loader2, KeyRound } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { buildSiteHost, buildSiteURL } from "@/lib/site-url"
import { type ReactNode } from "react"
import type { RuntimeAction } from "@/components/providers/runtime-actions-provider"

interface SiteCardProps {
  id?: string
  name: string
  subdomain: string
  status: "aktif" | "sedang_dibuat" | "nonaktif" | "gagal"
  siteUrl?: string
  siteHost?: string
  runtimeHealth?: string
  runtimeHint?: string
  quotaState?: "normal" | "warning" | "critical"
  quotaLabel?: string
  activeUsersSummary?: string
  storageSummary?: string
  lastActivity?: string
  viewMode?: "grid" | "list"
  pendingRuntimeAction?: RuntimeAction | null
  pendingAdminAccess?: boolean
  onRuntimeAction?: (action: RuntimeAction) => void
  onAdminAccess?: () => void
}

type IndicatorTone = "success" | "warning" | "danger" | "muted"

function toneClasses(tone: IndicatorTone) {
  switch (tone) {
    case "success":
      return {
        dot: "bg-green-500",
        chip: "border-green-600/25 bg-green-500/5 text-green-700",
      }
    case "warning":
      return {
        dot: "bg-amber-500",
        chip: "border-amber-600/25 bg-amber-500/5 text-amber-700",
      }
    case "danger":
      return {
        dot: "bg-red-500",
        chip: "border-red-600/25 bg-red-500/5 text-red-700",
      }
    default:
      return {
        dot: "bg-slate-400",
        chip: "border-border bg-muted/40 text-muted-foreground",
      }
  }
}

function runtimeIndicator(
  status: SiteCardProps["status"],
  runtimeHealth?: string,
  runtimeHint?: string
): { label: string; hint: string; tone: IndicatorTone } {
  if (status === "gagal") {
    return {
      label: "Gagal",
      hint: "Provisioning situs gagal dan butuh pengecekan lebih lanjut.",
      tone: "danger",
    }
  }

  if (status === "sedang_dibuat") {
    return {
      label: "Menyiapkan",
      hint: "Situs sedang diproses. Buka progress untuk memantau tahap provisioning.",
      tone: "warning",
    }
  }

  if (status === "nonaktif") {
    return {
      label: "Nonaktif",
      hint: "Situs sedang nonaktif. Anda masih bisa membuka detail situs untuk mengelolanya.",
      tone: "muted",
    }
  }

  switch (runtimeHealth) {
    case "healthy":
    case "running":
      return {
        label: "Sehat",
        hint: "Runtime berjalan normal dan layanan situs dalam kondisi sehat.",
        tone: "success",
      }
    case "degraded":
      return {
        label: "Tidak stabil",
        hint: runtimeHint?.trim() || "Ada komponen runtime yang belum sehat penuh. Periksa detail Web dan Cron.",
        tone: "warning",
      }
    case "stopped":
      return {
        label: "Berhenti",
        hint: "Runtime situs sedang berhenti.",
        tone: "muted",
      }
    case "failed":
      return {
        label: "Bermasalah",
        hint: "Runtime situs gagal berjalan dan perlu tindakan.",
        tone: "danger",
      }
    case "provisioning":
      return {
        label: "Menyiapkan",
        hint: "Runtime masih menunggu proses provisioning selesai.",
        tone: "warning",
      }
    default:
      return {
        label: "Tidak diketahui",
        hint: "Status runtime belum tersedia.",
        tone: "muted",
      }
  }
}

function quotaIndicator(
  quotaState?: "normal" | "warning" | "critical",
  quotaLabel?: string
): { label: string; hint: string; tone: IndicatorTone } | null {
  if (!quotaState || !quotaLabel) {
    return null
  }

  if (quotaState === "critical") {
    return {
      label: quotaLabel,
      hint: "Quota hampir atau sudah melewati batas. Kurangi usage atau upgrade paket.",
      tone: "danger",
    }
  }

  if (quotaState === "warning") {
    return {
      label: quotaLabel,
      hint: "Quota mulai mendekati batas dan perlu dipantau.",
      tone: "warning",
    }
  }

  return {
    label: quotaLabel,
    hint: "Quota masih dalam batas aman.",
    tone: "success",
  }
}

function HintChip({
  label,
  hint,
  tone,
  icon,
}: {
  label: string
  hint: string
  tone?: IndicatorTone
  icon?: ReactNode
}) {
  const classes = tone ? toneClasses(tone) : null

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs ${
            classes ? classes.chip : "border-border bg-muted/35 text-muted-foreground"
          }`}
        >
          {icon}
          <span className="truncate">{label}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8} className="max-w-56">
        {hint}
      </TooltipContent>
    </Tooltip>
  )
}

export function SiteCard({
  id,
  name,
  subdomain,
  status,
  siteUrl,
  siteHost,
  runtimeHealth,
  runtimeHint,
  quotaState,
  quotaLabel,
  activeUsersSummary,
  storageSummary,
  lastActivity,
  viewMode = "grid",
  pendingRuntimeAction = null,
  pendingAdminAccess = false,
  onRuntimeAction,
  onAdminAccess,
}: SiteCardProps) {
  const router = useRouter()
  const resolvedSiteUrl = siteUrl ?? buildSiteURL(subdomain)
  const resolvedSiteHost = siteHost ?? buildSiteHost(subdomain)
  const runtime = runtimeIndicator(status, runtimeHealth, runtimeHint)
  const runtimeTone = toneClasses(runtime.tone)
  const quota = quotaIndicator(quotaState, quotaLabel)
  const isRuntimeActionPending = pendingRuntimeAction !== null

  const handleCardClick = () => {
    if (status === "sedang_dibuat") {
      router.push(`/proses-pembuatan/${subdomain}`)
    } else {
      router.push(`/situs/${subdomain}`)
    }
  }

  const handleRuntimeAction = (action: RuntimeAction) => {
    if (!id || !onRuntimeAction || isRuntimeActionPending) return
    onRuntimeAction(action)
  }

  const handleAdminAccess = () => {
    if (!id || !onAdminAccess || pendingAdminAccess) return
    onAdminAccess()
  }

  return (
    <Card
      className={`group relative overflow-hidden border-border bg-card transition-all hover:border-muted-foreground/50 cursor-pointer ${
        viewMode === "list" ? "p-5" : "h-full p-4"
      }`}
      onClick={handleCardClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Globe className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-medium leading-none">{name}</h3>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/35 px-2 py-0.5 text-[11px] text-muted-foreground">
                    {isRuntimeActionPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <span className={`h-2.5 w-2.5 rounded-full ${runtimeTone.dot}`} />
                    )}
                    <span>{runtime.label}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8} className="max-w-56">
                  {runtime.hint}
                </TooltipContent>
              </Tooltip>
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground">{resolvedSiteHost}</p>
          </div>
        </div>

        {status === "aktif" && id ? (
          <div onClick={(e) => e.stopPropagation()} className="shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isRuntimeActionPending}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleAdminAccess} disabled={pendingAdminAccess}>
                  {pendingAdminAccess ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                  Masuk sebagai admin
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleRuntimeAction("start")}
                  disabled={isRuntimeActionPending || pendingAdminAccess}
                >
                  <Play className="mr-2 h-4 w-4" />
                  Start
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleRuntimeAction("restart")}
                  disabled={isRuntimeActionPending || pendingAdminAccess}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Restart
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleRuntimeAction("stop")}
                  disabled={isRuntimeActionPending || pendingAdminAccess}
                  className="text-destructive"
                >
                  <Square className="mr-2 h-4 w-4" />
                  Stop
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {quota ? (
          <HintChip
            label={quota.label}
            hint={quota.hint}
            tone={quota.tone}
            icon={<span className={`h-2.5 w-2.5 rounded-full ${toneClasses(quota.tone).dot}`} />}
          />
        ) : null}

        {activeUsersSummary ? (
          <HintChip
            label={activeUsersSummary}
            hint={`Pengguna aktif saat ini: ${activeUsersSummary}.`}
            icon={<Users className="h-3.5 w-3.5" />}
          />
        ) : null}

        {storageSummary ? (
          <HintChip
            label={storageSummary}
            hint={`Pemakaian storage saat ini: ${storageSummary}.`}
            icon={<Database className="h-3.5 w-3.5" />}
          />
        ) : null}

        {lastActivity ? (
          <HintChip
            label={lastActivity}
            hint={`Aktivitas terakhir tercatat ${lastActivity}.`}
            icon={<Clock className="h-3.5 w-3.5" />}
          />
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">
          {status === "sedang_dibuat" ? "Lihat progress" : "Lihat detail"}
        </span>

        {status === "aktif" ? (
          <Link
            href={resolvedSiteUrl}
            target="_blank"
            className="text-muted-foreground transition-colors hover:text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            Buka situs
          </Link>
        ) : null}
      </div>
    </Card>
  )
}
