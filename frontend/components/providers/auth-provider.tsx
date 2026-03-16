"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

import { api, isAPIError, type AuthStatus, type AuthUser, type LoginRequest } from "@/lib/api"

type AuthContextValue = {
  user: AuthUser | null
  status: AuthStatus
  refresh: () => Promise<AuthUser | null>
  login: (input: LoginRequest) => Promise<AuthUser>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>("loading")

  const refresh = useCallback(async () => {
    try {
      const response = await api.getMe()
      setUser(response.user)
      setStatus("authenticated")
      return response.user
    } catch (error) {
      if (!isAPIError(error) || error.status !== 401) {
        console.error("auth bootstrap failed", error)
      }
      setUser(null)
      setStatus("unauthenticated")
      return null
    }
  }, [])

  const login = useCallback(async (input: LoginRequest) => {
    const response = await api.login(input)
    setUser(response.user)
    setStatus("authenticated")
    return response.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } finally {
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
