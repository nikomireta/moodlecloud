"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Trash2, Loader2 } from "lucide-react"

import {
  api,
  isAPIError,
  type SiteSummary,
  type SiteSettingsResponse,
  type SiteRuntimeStatus,
} from "@/lib/api"
import { customDomainBadge } from "./site-detail-helpers"
import { SITE_BASE_DOMAIN } from "@/lib/site-url"

interface SiteSettingsTabProps {
  siteData: SiteSummary | null
  siteSettings: SiteSettingsResponse | null
  runtimeStatus: SiteRuntimeStatus | null
  subdomain: string
  currentDomainHost: string
  onSiteUpdated: (site: SiteSummary) => void
  onSettingsUpdated: (settings: SiteSettingsResponse) => void
  onRuntimeUpdated: (runtime: SiteRuntimeStatus, error: string) => void
}

export function SiteSettingsTab({
  siteData,
  siteSettings,
  runtimeStatus,
  subdomain,
  currentDomainHost,
  onSiteUpdated,
  onSettingsUpdated,
  onRuntimeUpdated,
}: SiteSettingsTabProps) {
  const router = useRouter()

  const [siteNameInput, setSiteNameInput] = useState(siteData?.name ?? "")
  const [savingSiteName, setSavingSiteName] = useState(false)
  const [customDomainInput, setCustomDomainInput] = useState(siteSettings?.custom_domain?.domain ?? "")
  const [submittingCustomDomain, setSubmittingCustomDomain] = useState(false)
  const [removingCustomDomain, setRemovingCustomDomain] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
  const [deletingSite, setDeletingSite] = useState(false)

  const customDomain = siteSettings?.custom_domain ?? null
  const customDomainState = customDomainBadge(customDomain?.status ?? "")
  const customDomainSupported = siteSettings?.custom_domain_enabled ?? false
  const runtimeMetadata = siteSettings?.runtime ?? runtimeStatus?.runtime ?? null

  const siteName = siteData?.name ?? ""

  useEffect(() => {
    if (siteData?.name && !savingSiteName) {
      setSiteNameInput(siteData.name)
    }
  }, [siteData?.name])

  useEffect(() => {
    if (siteSettings?.custom_domain?.domain !== undefined && !submittingCustomDomain && !removingCustomDomain) {
      setCustomDomainInput(siteSettings.custom_domain.domain ?? "")
    }
  }, [siteSettings?.custom_domain?.domain])

  const handleSaveSiteName = async () => {
    if (!siteData || !siteNameInput.trim()) {
      return
    }

    setSavingSiteName(true)
    try {
      const response = await api.updateSite(siteData.id, { name: siteNameInput.trim() })
      onSiteUpdated(response.site)
      if (siteSettings) {
        onSettingsUpdated({ ...siteSettings, site: response.site })
      }
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
      onSiteUpdated(nextSite)
      if (siteSettings) {
        onSettingsUpdated({
          ...siteSettings,
          site: nextSite,
          custom_domain: response.custom_domain,
        })
      }
      if (response.custom_domain?.status === "active") {
        const runtime = await api.getSiteRuntime(siteData.id)
        onRuntimeUpdated(runtime, runtime.last_error ?? "")
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
      const [runtimeResult, settingsResult] = await Promise.allSettled([
        api.getSiteRuntime(siteData.id),
        api.getSiteSettings(siteData.id),
      ])
      onSiteUpdated(response.site)
      
      if (runtimeResult.status === "fulfilled") {
        onRuntimeUpdated(runtimeResult.value, runtimeResult.value.last_error ?? "")
      }
      if (settingsResult.status === "fulfilled") {
        onSettingsUpdated(settingsResult.value)
      }
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

  const deleteConfirmationMatches = deleteConfirmation.trim() === subdomain

  return (
    <div className="space-y-6">
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
  )
}
