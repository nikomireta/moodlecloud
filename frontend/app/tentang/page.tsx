import { notFound } from "next/navigation"

import { StaticPageLayout } from "@/components/content/static-page-layout"
import { getStaticPageBySlug } from "@/lib/content"
import { buildContentOGImagePath, createContentMetadata } from "@/lib/seo"

export const metadata = createContentMetadata({
  title: "Tentang",
  description: "Gambaran singkat tentang fokus Moodlepilot Indonesia, masalah yang ingin diselesaikan, dan area produk yang sedang kami bangun.",
  pathname: "/tentang",
  keywords: ["tentang Moodlepilot", "profil Moodlepilot Indonesia", "platform operasional Moodle"],
  imagePath: buildContentOGImagePath("page", "tentang"),
})

export default function AboutPage() {
  const page = getStaticPageBySlug("tentang")

  if (!page) {
    notFound()
  }

  return <StaticPageLayout page={page} badgeLabel="Tentang" />
}
