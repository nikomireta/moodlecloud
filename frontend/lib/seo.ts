import type { Metadata } from "next"

export const SITE_NAME = "Moodlepilot Indonesia"
export const SITE_TITLE = "Moodlepilot Indonesia - Kelola Moodle Anda dengan Mudah"
export const SITE_DESCRIPTION =
  "Platform manajemen Moodlepilot terpercaya di Indonesia. Buat, kelola, dan kembangkan situs Moodle Anda dalam hitungan menit."
export const RSS_FEED_PATH = "/rss.xml"

type ContentOGKind = "blog" | "docs" | "changelog" | "page"

function normalizeBaseURL(value?: string | null): string {
  const fallback = "http://localhost:3000"
  const trimmed = value?.trim()
  if (!trimmed) {
    return fallback
  }

  return trimmed.replace(/\/$/, "")
}

export const siteBaseURL = normalizeBaseURL(process.env.NEXT_PUBLIC_APP_URL)
export const siteMetadataBase = new URL(siteBaseURL)

export function buildAbsoluteURL(pathname: string): string {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`
  return new URL(normalizedPath, siteMetadataBase).toString()
}

export function buildContentOGImagePath(kind: ContentOGKind, slug?: string): string {
  const searchParams = new URLSearchParams({ kind })

  if (slug) {
    searchParams.set("slug", slug)
  }

  return `/api/og/content?${searchParams.toString()}`
}

type ContentMetadataOptions = {
  title: string
  description: string
  pathname: string
  keywords?: string[]
  imagePath?: string
  type?: "website" | "article"
  publishedTime?: string
  modifiedTime?: string
}

export function createContentMetadata({
  title,
  description,
  pathname,
  keywords = [],
  imagePath,
  type = "website",
  publishedTime,
  modifiedTime,
}: ContentMetadataOptions): Metadata {
  const absoluteURL = buildAbsoluteURL(pathname)
  const imageURL = imagePath ? buildAbsoluteURL(imagePath) : undefined

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: pathname,
    },
    openGraph: {
      title,
      description,
      url: absoluteURL,
      siteName: SITE_NAME,
      locale: "id_ID",
      type,
      ...(imageURL
        ? {
            images: [
              {
                url: imageURL,
                alt: title,
              },
            ],
          }
        : {}),
      ...(publishedTime ? { publishedTime } : {}),
      ...(modifiedTime ? { modifiedTime } : {}),
    },
    twitter: {
      card: imageURL ? "summary_large_image" : "summary",
      title,
      description,
      ...(imageURL ? { images: [imageURL] } : {}),
    },
  }
}
