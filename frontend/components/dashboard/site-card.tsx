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
import { ExternalLink, MoreHorizontal, Settings, Trash2, Globe, Clock, Users, ChevronRight } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { buildSiteHost, buildSiteURL } from "@/lib/site-url"

interface SiteCardProps {
  id?: string
  name: string
  subdomain: string
  status: "aktif" | "sedang_dibuat" | "nonaktif"
  siteUrl?: string
  siteHost?: string
  users?: number
  lastActivity?: string
}

export function SiteCard({ id, name, subdomain, status, siteUrl, siteHost, users, lastActivity }: SiteCardProps) {
  const router = useRouter()
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

  return (
    <Card 
      className="group relative overflow-hidden border-border bg-card p-4 transition-all hover:border-muted-foreground/50 cursor-pointer"
      onClick={handleCardClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <Globe className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h3 className="font-medium leading-none">{name}</h3>
            <p className="text-sm text-muted-foreground">
              {resolvedSiteHost}
            </p>
          </div>
        </div>
        
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <Link href={resolvedSiteUrl} target="_blank">
                <DropdownMenuItem>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Buka Situs
                </DropdownMenuItem>
              </Link>
              <Link href={`/situs/${subdomain}/pengaturan`}>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  Pengaturan
                </DropdownMenuItem>
              </Link>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Hapus
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

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
        
        {status === "aktif" && (
          <Link 
            href={resolvedSiteUrl}
            target="_blank"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Kunjungi
          </Link>
        )}
        
        {status === "sedang_dibuat" && (
          <span className="text-xs text-muted-foreground">
            Lihat Progress
          </span>
        )}
        
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </Card>
  )
}
