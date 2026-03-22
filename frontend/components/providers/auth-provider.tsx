"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"

import { api, isAPIError, type AuthStatus, type AuthUser, type LoginRequest } from "@/lib/api"

type AuthContextValue = {
  user: AuthUser | null
  status: AuthStatus
  refresh: () => Promise<AuthUser | null>
  login: (input: LoginRequest) => Promise<AuthUser>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const AUTH_SESSION_HINT_KEY = "moodlepilot.auth_hint"
const AUTH_BOOTSTRAP_SKIP_PATHS = new Set([
  "/masuk",
  "/daftar",
  "/lupa-sandi",
  "/reset-password",
  "/verifikasi-email",
])

function readSessionHint() {
  if (typeof window === "undefined") {
    return false
  }

  return window.localStorage.getItem(AUTH_SESSION_HINT_KEY) === "1"
}

function writeSessionHint(enabled: boolean) {
  if (typeof window === "undefined") {
    return
  }

  if (enabled) {
    window.localStorage.setItem(AUTH_SESSION_HINT_KEY, "1")
    return
  }

  window.localStorage.removeItem(AUTH_SESSION_HINT_KEY)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>("loading")

  const refresh = useCallback(async () => {
    const shouldSkipBootstrap = AUTH_BOOTSTRAP_SKIP_PATHS.has(pathname) && !readSessionHint()
    if (shouldSkipBootstrap) {
      setUser(null)
      setStatus("unauthenticated")
      return null
    }

    try {
      const response = await api.getMe()
      writeSessionHint(true)
      setUser(response.user)
      setStatus("authenticated")
      return response.user
    } catch (error) {
      if (!isAPIError(error) || error.status !== 401) {
        console.error("auth bootstrap failed", error)
      }
      writeSessionHint(false)
      setUser(null)
      setStatus("unauthenticated")
      return null
    }
  }, [pathname])

  const login = useCallback(async (input: LoginRequest) => {
    const response = await api.login(input)
    writeSessionHint(true)
    setUser(response.user)
    setStatus("authenticated")
    return response.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } finally {
      writeSessionHint(false)
      setUser(null)
      setStatus("unauthenticated")
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      refresh,
      login,
      logout,
    }),
    [login, logout, refresh, status, user]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }

  return context
}
