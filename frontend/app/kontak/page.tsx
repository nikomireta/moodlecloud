import { notFound } from "next/navigation"

import { StaticPageLayout } from "@/components/content/static-page-layout"
import { getStaticPageBySlug } from "@/lib/content"
import { buildContentOGImagePath, createContentMetadata } from "@/lib/seo"

export const metadata = createContentMetadata({
  title: "Kontak",
  description: "Cara menghubungi tim Moodlepilot Indonesia untuk pertanyaan umum, kebutuhan operasional, dan koordinasi lanjutan.",
  pathname: "/kontak",
  keywords: ["kontak Moodlepilot", "hubungi Moodlepilot", "support Moodlepilot Indonesia"],
  imagePath: buildContentOGImagePath("page", "kontak"),
})

export default function ContactPage() {
  const page = getStaticPageBySlug("kontak")

  if (!page) {
    notFound()
  }

  return <StaticPageLayout page={page} badgeLabel="Kontak" />
}
