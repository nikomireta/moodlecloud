import { notFound } from "next/navigation"

import { StaticPageLayout } from "@/components/content/static-page-layout"
import { getStaticPageBySlug } from "@/lib/content"
import { buildContentOGImagePath, createContentMetadata } from "@/lib/seo"

export const metadata = createContentMetadata({
  title: "Dukungan",
  description: "Panduan kanal bantuan Moodlepilot Indonesia, alur eskalasi, dan checklist sebelum menghubungi tim support.",
  pathname: "/dukungan",
  keywords: ["dukungan Moodlepilot", "support Moodlepilot", "bantuan LMS Moodlepilot"],
  imagePath: buildContentOGImagePath("page", "dukungan"),
})

export default function SupportPage() {
  const page = getStaticPageBySlug("dukungan")

  if (!page) {
    notFound()
  }

  return <StaticPageLayout page={page} badgeLabel="Dukungan" />
}
