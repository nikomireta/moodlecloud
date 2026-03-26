"use client"

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react"

import { api, type SiteRuntimeStatus } from "@/lib/api"

export type RuntimeAction = "start" | "restart" | "stop"

type PendingRuntimeAction = {
  action: RuntimeAction
  startedAt: number
}

type RuntimeActionsContextValue = {
  pendingActions: Record<string, PendingRuntimeAction>
  runRuntimeAction: (siteID: string, action: RuntimeAction) => Promise<SiteRuntimeStatus>
  getPendingAction: (siteID: string) => RuntimeAction | null
  isRuntimeActionPending: (siteID: string) => boolean
}

const RuntimeActionsContext = createContext<RuntimeActionsContextValue | null>(null)

function requestRuntimeAction(siteID: string, action: RuntimeAction) {
  switch (action) {
    case "start":
      return api.startSiteRuntime(siteID)
    case "restart":
      return api.restartSiteRuntime(siteID)
    case "stop":
      return api.stopSiteRuntime(siteID)
    default:
      return Promise.reject(new Error("Runtime action tidak didukung"))
  }
}

export function RuntimeActionsProvider({ children }: { children: ReactNode }) {
  const [pendingActions, setPendingActions] = useState<Record<string, PendingRuntimeAction>>({})
  const inFlightActionsRef = useRef<Record<string, Promise<SiteRuntimeStatus>>>({})

  const runRuntimeAction = useCallback((siteID: string, action: RuntimeAction) => {
    const existingRequest = inFlightActionsRef.current[siteID]
    if (existingRequest) {
      return existingRequest
    }

    setPendingActions((current) => ({
      ...current,
      [siteID]: {
        action,
        startedAt: Date.now(),
      },
    }))

    const request = requestRuntimeAction(siteID, action)
    inFlightActionsRef.current[siteID] = request

    void request.finally(() => {
      delete inFlightActionsRef.current[siteID]
      setPendingActions((current) => {
        if (!current[siteID]) {
          return current
        }

        const next = { ...current }
        delete next[siteID]
        return next
      })
    })

    return request
  }, [])

  const getPendingAction = useCallback(
    (siteID: string) => pendingActions[siteID]?.action ?? null,
    [pendingActions]
  )

  const isRuntimeActionPending = useCallback(
    (siteID: string) => pendingActions[siteID] !== undefined,
    [pendingActions]
  )

  const value = useMemo<RuntimeActionsContextValue>(
    () => ({
      pendingActions,
      runRuntimeAction,
      getPendingAction,
      isRuntimeActionPending,
    }),
    [getPendingAction, isRuntimeActionPending, pendingActions, runRuntimeAction]
  )

  return <RuntimeActionsContext.Provider value={value}>{children}</RuntimeActionsContext.Provider>
}

export function useRuntimeActions() {
  const context = useContext(RuntimeActionsContext)

  if (!context) {
    throw new Error("useRuntimeActions must be used within RuntimeActionsProvider")
  }

  return context
}
