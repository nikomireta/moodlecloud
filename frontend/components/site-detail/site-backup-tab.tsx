"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Download, CheckCircle2, AlertCircle, Upload, Loader2 } from "lucide-react"

import {
  api,
  isAPIError,
  type SiteSummary,
  type SiteBackupItem,
  type SiteBackupSettings,
} from "@/lib/api"
import {
  formatBytes,
  formatBackupTimestamp,
  humanizeBackupTrigger,
  getBackupDisplayState,
  createDefaultBackupSettings,
} from "./site-detail-helpers"

interface SiteBackupTabProps {
  siteData: SiteSummary | null
  isActive: boolean
}

export function SiteBackupTab({ siteData, isActive }: SiteBackupTabProps) {
  const [backupSettings, setBackupSettings] = useState<SiteBackupSettings | null>(null)
  const [siteBackups, setSiteBackups] = useState<SiteBackupItem[]>([])
  const [backupLoaded, setBackupLoaded] = useState(false)
  const [loadingBackups, setLoadingBackups] = useState(false)
  const [creatingBackup, setCreatingBackup] = useState(false)
  const [savingBackupSettings, setSavingBackupSettings] = useState(false)
  const [downloadingBackupID, setDownloadingBackupID] = useState<string | null>(null)

  const loadBackupContext = async (backupSiteID: string, options?: { silent?: boolean }) => {
    setLoadingBackups(true)
    try {
      const response = await api.getSiteBackups(backupSiteID)
      setBackupSettings(response.settings)
      setSiteBackups(response.backups)
      setBackupLoaded(true)
    } catch (error) {
      if (!options?.silent) {
        setSiteBackups([])
        setBackupSettings(null)
        toast.error(isAPIError(error) ? error.message : "Gagal memuat backup situs")
      }
    } finally {
      setLoadingBackups(false)
    }
  }

  useEffect(() => {
    if (!isActive || !siteData || backupLoaded || loadingBackups) {
      return
    }
    void loadBackupContext(siteData.id)
  }, [isActive, backupLoaded, loadingBackups, siteData])

  const hasActiveBackup = siteBackups.some((backup) => backup.status === "pending" || backup.status === "running")

  useEffect(() => {
    if (!isActive || !siteData || !backupLoaded || !hasActiveBackup) {
      return
    }

    let timeoutID: number;
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      await loadBackupContext(siteData.id, { silent: true })
      if (!cancelled) {
        timeoutID = window.setTimeout(poll, 5000)
      }
    }

    timeoutID = window.setTimeout(poll, 5000)

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutID)
    }
  }, [isActive, backupLoaded, hasActiveBackup, siteData])

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
      const effectiveSettings = backupSettings ?? createDefaultBackupSettings(siteData.id)
      const response = await api.updateSiteBackupSettings(siteData.id, {
        enabled: effectiveSettings.enabled,
        frequency: effectiveSettings.frequency,
        retentionDays: effectiveSettings.retention_days,
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

  const effectiveBackupSettings = backupSettings ?? createDefaultBackupSettings(siteData?.id)

  return (
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
          {siteBackups.length > 0 ? (
            siteBackups.map((backup) => {
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
            })
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <p className="text-sm">Belum ada backup</p>
            </div>
          )}
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
  )
}
