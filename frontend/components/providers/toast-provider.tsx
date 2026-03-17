"use client"

import { Toaster } from "@/components/ui/sonner"

export function ToastProvider() {
  return (
    <Toaster 
      position="top-right"
      toastOptions={{
        classNames: {
          toast: "bg-card border-border text-foreground",
          title: "text-foreground font-medium",
          description: "text-muted-foreground",
          actionButton: "bg-foreground text-background",
          cancelButton: "bg-muted text-muted-foreground",
        },
      }}
    />
  )
}
