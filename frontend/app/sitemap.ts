import type { MetadataRoute } from "next"

import { getAllBlogPosts, getAllDocPages, getAllStaticPages, getChangelogEntries } from "@/lib/content"
import { buildAbsoluteURL, buildContentOGImagePath } from "@/lib/seo"

const marketingRoutes = [
  "/",
  "/ai-course-generator",
  "/blog",
  "/buat-situs",
  "/changelog",
  "/checkout",
  "/dokumentasi",
  "/harga",
] as const

function getStaticPagePriority(slug: string): number {
  if (slug === "tentang") {
    return 0.8
  }

  if (slug === "dukungan" || slug === "faq" || slug === "kontak") {
    return 0.75
  }

  return 0.7
}

function toDate(value?: string): Date | undefined {
  return value ? new Date(value) : undefined
}

function resolveMarketingRouteLastModified(pathname: string): Date {
  if (pathname === "/blog") {
    return toDate(getAllBlogPosts()[0]?.publishedAt) ?? new Date()
  }

  if (pathname === "/dokumentasi") {
    return toDate(getAllDocPages()[0]?.updatedAt) ?? new Date()
  }

  if (pathname === "/changelog") {
    return toDate(getChangelogEntries()[0]?.publishedAt) ?? new Date()
  }

  return new Date()
}

function resolveMarketingRouteImages(pathname: string): string[] | undefined {
  if (pathname === "/") {
    return [buildAbsoluteURL("/hero-dashboard-safe.svg")]
  }

  if (pathname === "/blog") {
    return [buildAbsoluteURL(buildContentOGImagePath("blog"))]
  }

  if (pathname === "/dokumentasi") {
    return [buildAbsoluteURL(buildContentOGImagePath("docs"))]
  }

  if (pathname === "/changelog") {
    return [buildAbsoluteURL(buildContentOGImagePath("changelog"))]
  }

  return undefined
}

export default function sitemap(): MetadataRoute.Sitemap {
  const routeEntries: MetadataRoute.Sitemap = marketingRoutes.map((pathname) => ({
    url: buildAbsoluteURL(pathname),
    lastModified: resolveMarketingRouteLastModified(pathname),
    changeFrequency:
      pathname === "/" || pathname === "/blog" || pathname === "/dokumentasi" || pathname === "/changelog"
        ? "weekly"
        : "monthly",
    priority: pathname === "/" ? 1 : pathname === "/harga" || pathname === "/buat-situs" ? 0.9 : 0.8,
    images: resolveMarketingRouteImages(pathname),
  }))

  const staticPageEntries: MetadataRoute.Sitemap = getAllStaticPages().map((page) => ({
    url: buildAbsoluteURL(page.url),
    lastModified: new Date(page.updatedAt),
    changeFrequency: "monthly",
    priority: getStaticPagePriority(page.slug),
    images: [buildAbsoluteURL(buildContentOGImagePath("page", page.slug))],
  }))

  const blogEntries: MetadataRoute.Sitemap = getAllBlogPosts().map((post) => ({
    url: buildAbsoluteURL(post.url),
    lastModified: new Date(post.publishedAt),
    changeFrequency: "monthly",
    priority: post.featured ? 0.9 : 0.7,
    images: [buildAbsoluteURL(post.coverImage ?? buildContentOGImagePath("blog", post.slug))],
  }))

  const docsEntries: MetadataRoute.Sitemap = getAllDocPages()
    .filter((page) => !page.faq)
    .map((page) => ({
      url: buildAbsoluteURL(page.url),
      lastModified: new Date(page.updatedAt),
      changeFrequency: "monthly" as const,
      priority: page.popular ? 0.8 : 0.7,
      images: [buildAbsoluteURL(buildContentOGImagePath("docs", page.slugSegments.join("/")))],
    }))

  const seen = new Set<string>()

  return [...routeEntries, ...staticPageEntries, ...blogEntries, ...docsEntries].filter((entry) => {
    if (seen.has(entry.url)) {
      return false
    }

    seen.add(entry.url)
    return true
  })
}
