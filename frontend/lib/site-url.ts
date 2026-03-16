"use client"

const SITE_URL_SCHEME = (process.env.NEXT_PUBLIC_SITE_URL_SCHEME ?? "http").replace(/:$/, "")
export const SITE_BASE_DOMAIN = (process.env.NEXT_PUBLIC_SITE_BASE_DOMAIN ?? "lvh.me").replace(/^\.+|\.+$/g, "")

export function buildSiteHost(subdomain: string): string {
  return `${subdomain.trim()}.${SITE_BASE_DOMAIN}`
}

export function buildSiteURL(subdomain: string): string {
  return `${SITE_URL_SCHEME}://${buildSiteHost(subdomain)}`
}

export function buildAdminURL(subdomain: string): string {
  return `${buildSiteURL(subdomain)}/admin`
}

export function siteHostFromURL(siteURL: string, fallbackSubdomain?: string): string {
  try {
    return new URL(siteURL).host
  } catch {
    if (fallbackSubdomain) {
      return buildSiteHost(fallbackSubdomain)
    }
    return siteURL
  }
}
