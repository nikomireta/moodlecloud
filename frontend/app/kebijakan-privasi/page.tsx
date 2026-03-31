import { notFound } from "next/navigation"

import { StaticPageLayout } from "@/components/content/static-page-layout"
import { getStaticPageBySlug } from "@/lib/content"
import { buildContentOGImagePath, createContentMetadata } from "@/lib/seo"

export const metadata = createContentMetadata({
  title: "Kebijakan Privasi",
  description: "Ringkasan cara Moodlepilot Indonesia mengumpulkan, menggunakan, menyimpan, dan melindungi data pengguna serta data situs Moodle Anda.",
  pathname: "/kebijakan-privasi",
  keywords: ["kebijakan privasi Moodlepilot", "privasi data LMS", "perlindungan data Moodlepilot"],
  imagePath: buildContentOGImagePath("page", "kebijakan-privasi"),
})

export default function PrivacyPolicyPage() {
  const page = getStaticPageBySlug("kebijakan-privasi")

  if (!page) {
    notFound()
  }

  return <StaticPageLayout page={page} badgeLabel="Privasi" />
}
