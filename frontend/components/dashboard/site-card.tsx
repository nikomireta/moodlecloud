"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Globe, Clock, Users, Play, RotateCcw, Square } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { buildSiteHost, buildSiteURL } from "@/lib/site-url"
import { api } from "@/lib/api"
import { useState } from "react"

interface SiteCardProps {
  id?: string
  name: string
  subdomain: string
  status: "aktif" | "sedang_dibuat" | "nonaktif" | "gagal"
  siteUrl?: string
  siteHost?: string
  users?: number
  runtimeHealth?: string
  lastActivity?: string
  onAction?: () => void
}

function runtimeStatusBadge(status: string) {
  switch (status) {
    case "healthy":
    case "running":
      return {
        label: "Running",
        className: "text-green-600 border-green-600/50 bg-green-500/10 text-[10px]",
      }
    case "degraded":
      return {
        label: "Degraded",
        className: "text-amber-600 border-amber-600/50 bg-amber-500/10 text-[10px]",
      }
    case "stopped":
      return {
        label: "Stopped",
        className: "text-slate-600 border-slate-600/50 bg-slate-500/10 text-[10px]",
      }
    case "failed":
      return {
        label: "Failed",
        className: "text-red-600 border-red-600/50 bg-red-500/10 text-[10px]",
      }
    case "provisioning":
      return {
        label: "Provisioning",
        className: "text-orange-600 border-orange-600/50 bg-orange-500/10 text-[10px]",
      }
    default:
      return {
        label: "Unknown",
        className: "text-muted-foreground border-border bg-muted/30 text-[10px]",
      }
  }
}

export function SiteCard({ id, name, subdomain, status, siteUrl, siteHost, users, runtimeHealth, lastActivity, onAction }: SiteCardProps) {
  const router = useRouter()
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const statusConfig = {
    aktif: {
      label: "Aktif",
      color: "bg-success",
      textColor: "text-success",
    },
    sedang_dibuat: {
      label: "Sedang Dibuat",
      color: "bg-warning",
      textColor: "text-warning",
    },
    nonaktif: {
      label: "Nonaktif",
      color: "bg-muted-foreground",
      textColor: "text-muted-foreground",
    },
    gagal: {
      label: "Gagal",
      color: "bg-destructive",
      textColor: "text-destructive",
    },
  }

  const { label, color, textColor } = statusConfig[status]
  const showUsers = typeof users === "number"
  const resolvedSiteUrl = siteUrl ?? buildSiteURL(subdomain)
  const resolvedSiteHost = siteHost ?? buildSiteHost(subdomain)

  const handleCardClick = () => {
    if (status === "sedang_dibuat") {
      router.push(`/proses-pembuatan/${subdomain}`)
    } else {
      router.push(`/situs/${subdomain}`)
    }
  }

  const handleRuntimeAction = async (action: "start" | "restart" | "stop") => {
    if (!id) return
    setActionLoading(action)
    try {
      if (action === "start") await api.startSiteRuntime(id)
      else if (action === "restart") await api.restartSiteRuntime(id)
      else if (action === "stop") await api.stopSiteRuntime(id)
      onAction?.()
    } catch {
      // silently fail — user can retry
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <Card 
      className="group relative overflow-hidden border-border bg-card p-4 transition-all hover:border-muted-foreground/50 cursor-pointer"
      onClick={handleCardClick}
    >
      {/* Top row: icon + name + badge + menu */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Globe className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-medium leading-none">{name}</h3>
              {status === "aktif" && runtimeHealth && (
                <div className={`shrink-0 rounded border px-1.5 py-0.5 font-medium ${runtimeStatusBadge(runtimeHealth).className}`}>
                  {runtimeStatusBadge(runtimeHealth).label}
                </div>
              )}
            </div>
            <p className="truncate text-sm text-muted-foreground">
              {resolvedSiteHost}
            </p>
          </div>
        </div>
        
        {/* Always-visible menu for active sites */}
        {status === "aktif" && id && (
          <div onClick={(e) => e.stopPropagation()} className="shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onClick={() => handleRuntimeAction("start")}
                  disabled={actionLoading !== null}
                >
                  <Play className="mr-2 h-4 w-4" />
                  {actionLoading === "start" ? "Starting..." : "Start"}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleRuntimeAction("restart")}
                  disabled={actionLoading !== null}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {actionLoading === "restart" ? "Restarting..." : "Restart"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => handleRuntimeAction("stop")}
                  disabled={actionLoading !== null}
                  className="text-destructive"
                >
                  <Square className="mr-2 h-4 w-4" />
                  {actionLoading === "stop" ? "Stopping..." : "Stop"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Bottom row: status + meta (left) | action link (right) */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full ${color}`} />
            <span className={`text-xs ${textColor}`}>{label}</span>
          </div>
          {status === "aktif" && (
            <>
              {showUsers && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  <span>{users} pengguna</span>
                </div>
              )}
              {lastActivity && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{lastActivity}</span>
                </div>
              )}
            </>
          )}
        </div>
        
        <div className="shrink-0">
          {status === "aktif" && (
            <Link 
              href={resolvedSiteUrl}
              target="_blank"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              Kunjungi →
            </Link>
          )}
          
          {status === "sedang_dibuat" && (
            <span className="text-xs text-warning">
              Lihat Progress →
            </span>
          )}

          {status === "gagal" && (
            <span className="text-xs text-destructive">
              Provisioning gagal
            </span>
          )}
        </div>
      </div>
    </Card>
  )
}
