"use client"

import { api, type SiteAdminAccessLinkResponse } from "@/lib/api"

export async function openSiteAdminAccessLink(siteID: string): Promise<SiteAdminAccessLinkResponse> {
  const popup = typeof window !== "undefined" ? window.open("", "_blank") : null

  if (popup) {
    popup.opener = null
  }

  try {
    const response = await api.issueSiteAdminAccessLink(siteID)

    if (popup && !popup.closed) {
      popup.location.replace(response.login_url)
      return response
    }

    const opened = window.open(response.login_url, "_blank", "noopener,noreferrer")
    if (!opened) {
      window.location.assign(response.login_url)
    }

    return response
  } catch (error) {
    if (popup && !popup.closed) {
      popup.close()
    }
    throw error
  }
}
