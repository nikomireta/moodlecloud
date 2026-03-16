"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { useAuth } from "@/components/providers/auth-provider"

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { status } = useAuth()

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/masuk")
    }
  }, [router, status])

  if (status !== "authenticated") {
    return null
  }

  return <>{children}</>
}
