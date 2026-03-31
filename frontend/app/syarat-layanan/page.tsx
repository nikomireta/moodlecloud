import { notFound } from "next/navigation"

import { StaticPageLayout } from "@/components/content/static-page-layout"
import { getStaticPageBySlug } from "@/lib/content"
import { buildContentOGImagePath, createContentMetadata } from "@/lib/seo"

export const metadata = createContentMetadata({
  title: "Syarat Layanan",
  description: "Ketentuan penggunaan layanan Moodlepilot Indonesia untuk akun, billing, operasional situs, batasan penggunaan, dan penghentian layanan.",
  pathname: "/syarat-layanan",
  keywords: ["syarat layanan Moodlepilot", "terms Moodlepilot", "ketentuan layanan LMS"],
  imagePath: buildContentOGImagePath("page", "syarat-layanan"),
})

export default function TermsOfServicePage() {
  const page = getStaticPageBySlug("syarat-layanan")

  if (!page) {
    notFound()
  }

  return <StaticPageLayout page={page} badgeLabel="Syarat Layanan" />
}
