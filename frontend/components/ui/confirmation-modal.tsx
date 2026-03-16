"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Loader2, AlertTriangle, Info, CheckCircle2, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

type ModalVariant = "default" | "destructive" | "warning" | "success"

interface ConfirmationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void | Promise<void>
  isLoading?: boolean
  variant?: ModalVariant
}

export function ConfirmationModal({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Konfirmasi",
  cancelLabel = "Batal",
  onConfirm,
  isLoading = false,
  variant = "default"
}: ConfirmationModalProps) {
  const variantStyles = {
    default: {
      icon: Info,
      iconClass: "text-blue-500 bg-blue-500/10",
      buttonClass: ""
    },
    destructive: {
      icon: XCircle,
      iconClass: "text-red-500 bg-red-500/10",
      buttonClass: "bg-destructive text-destructive-foreground hover:bg-destructive/90"
    },
    warning: {
      icon: AlertTriangle,
      iconClass: "text-yellow-500 bg-yellow-500/10",
      buttonClass: "bg-yellow-500 text-yellow-950 hover:bg-yellow-500/90"
    },
    success: {
      icon: CheckCircle2,
      iconClass: "text-green-500 bg-green-500/10",
      buttonClass: "bg-green-500 text-white hover:bg-green-500/90"
    }
  }

  const { icon: Icon, iconClass, buttonClass } = variantStyles[variant]

  const handleConfirm = async () => {
    await onConfirm()
    if (!isLoading) {
      onOpenChange(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-start gap-4">
            <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full", iconClass)}>
              <Icon className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <AlertDialogTitle>{title}</AlertDialogTitle>
              <AlertDialogDescription>{description}</AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>{cancelLabel}</AlertDialogCancel>
          <Button
            onClick={handleConfirm}
            disabled={isLoading}
            className={buttonClass}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Memproses...
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

interface InfoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  content?: React.ReactNode
}

export function InfoModal({
  open,
  onOpenChange,
  title,
  description,
  content
}: InfoModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
              <Info className="h-6 w-6 text-blue-500" />
            </div>
            <div className="space-y-2">
              <AlertDialogTitle>{title}</AlertDialogTitle>
              <AlertDialogDescription>{description}</AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        {content && (
          <div className="py-4">
            {content}
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogAction>Mengerti</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
