"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowUpRight, CheckCircle2, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { type SiteSummary } from "@/lib/api"
import { formatPrice, getSelfServeUpgradeOptions, getTierByCode } from "@/lib/pricing"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface SitePlanUpgradeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  site: SiteSummary | null
  onPlanChanged: () => Promise<void> | void
}

export function SitePlanUpgradeDialog({
  open,
  onOpenChange,
  site,
  onPlanChanged: _onPlanChanged,
}: SitePlanUpgradeDialogProps) {
  const router = useRouter()
  const upgradeOptions = useMemo(() => getSelfServeUpgradeOptions(site?.plan_code), [site?.plan_code])
  const currentPlan = getTierByCode(site?.plan_code)

  const [selectedPlanCode, setSelectedPlanCode] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }
    setSelectedPlanCode(upgradeOptions[0]?.code ?? "")
  }, [open, upgradeOptions])

  const selectedPlan = upgradeOptions.find((plan) => plan.code === selectedPlanCode) ?? null

  const handleSubmit = async () => {
    if (!site || !selectedPlan) {
      return
    }

    setSubmitting(true)
    try {
      const search = new URLSearchParams({
        site_id: site.id,
        target_plan_code: selectedPlan.code,
        billing_cycle: "monthly",
      })
      onOpenChange(false)
      router.push(`/checkout?${search.toString()}`)
    } catch {
      // Router navigation should not normally fail, but keep the dialog responsive if it does.
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upgrade Paket Situs</DialogTitle>
          <DialogDescription>
            Paket berlaku per-site. Upgrade berbayar akan diteruskan ke checkout dan aktif setelah pembayaran terkonfirmasi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Paket saat ini</p>
                <p className="mt-1 text-lg font-semibold">{currentPlan?.label ?? site?.plan_code ?? "-"}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {currentPlan ? `Rp ${formatPrice(currentPlan.monthlyPrice)}/bulan` : "Paket lama belum mendukung upgrade mandiri"}
                </p>
              </div>
              {site?.usage ? (
                <div className="text-right text-sm text-muted-foreground">
                  <p>{site.usage.users_active_count.toLocaleString("id-ID")} pengguna aktif</p>
                  <p>{Math.round(site.usage.storage_bytes_used / 1024 / 1024)} MB terpakai</p>
                </div>
              ) : null}
            </div>
          </div>

          {upgradeOptions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
              Belum ada paket self-serve yang lebih tinggi untuk situs ini.
            </div>
          ) : (
            <div className="grid gap-3">
              {upgradeOptions.map((plan) => {
                const isSelected = plan.code === selectedPlanCode
                const priceDiff = currentPlan ? plan.monthlyPrice - currentPlan.monthlyPrice : plan.monthlyPrice

                return (
                  <button
                    key={plan.code}
                    type="button"
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      isSelected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-muted-foreground/50"
                    }`}
                    onClick={() => setSelectedPlanCode(plan.code)}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-base font-semibold">{plan.label}</p>
                          {isSelected ? (
                            <Badge className="bg-primary text-primary-foreground">
                              Terpilih
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-semibold">Rp {formatPrice(plan.monthlyPrice)}/bulan</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          +Rp {formatPrice(Math.max(priceDiff, 0))}/bulan
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {plan.usersLabel}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {plan.storageLabel} storage
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-muted-foreground">
            Setelah upgrade, tenant tetap sama. Yang berubah hanya limit paket dan resource container web/cron.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={!selectedPlan || submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Mengubah Paket...
              </>
            ) : (
              <>
                Upgrade Paket
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
