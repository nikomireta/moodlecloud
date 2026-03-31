import { getAllBlogPosts } from "@/lib/content"
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, buildAbsoluteURL } from "@/lib/seo"

export const revalidate = 3600

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function stripMarkdown(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\(([^)]+)\)/g, " ")
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/[*_#>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function buildItemDescription(excerpt: string, body: string): string {
  const bodyPreview = stripMarkdown(body).slice(0, 320).trim()
  const parts = [excerpt.trim()]

  if (bodyPreview && !bodyPreview.startsWith(excerpt.trim())) {
    parts.push(bodyPreview)
  }

  return parts.join(" ")
}

export async function GET() {
  const items = getAllBlogPosts()
    .map((post) => {
      const link = buildAbsoluteURL(post.url)
      const description = escapeXml(buildItemDescription(post.excerpt, post.body))
      const categories = Array.from(new Set([post.category, ...post.tags]))
        .map((value) => `<category>${escapeXml(value)}</category>`)
        .join("")

      return `
        <item>
          <title>${escapeXml(post.title)}</title>
          <link>${link}</link>
          <guid>${link}</guid>
          <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>
          <author>no-reply@moodlepilot.id (${escapeXml(post.authorName)})</author>
          <description>${description}</description>
          ${categories}
        </item>`
    })
    .join("")

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${buildAbsoluteURL("/")}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>id-ID</language>
    <generator>${escapeXml(SITE_NAME)}</generator>
    <atom:link href="${buildAbsoluteURL("/rss.xml")}" rel="self" type="application/rss+xml" />
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
    },
  })
}
