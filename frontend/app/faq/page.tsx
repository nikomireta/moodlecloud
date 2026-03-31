import { notFound } from "next/navigation"

import { StaticPageLayout } from "@/components/content/static-page-layout"
import { StructuredData } from "@/components/seo/structured-data"
import { getStaticPageBySlug } from "@/lib/content"
import { buildContentOGImagePath, createContentMetadata } from "@/lib/seo"
import { createFAQPageStructuredData } from "@/lib/structured-data"

export const metadata = createContentMetadata({
  title: "FAQ",
  description: "Jawaban cepat untuk pertanyaan umum seputar paket, provisioning, domain, backup, laporan, dan area eksperimen Moodlepilot.",
  pathname: "/faq",
  keywords: ["faq Moodlepilot", "pertanyaan umum Moodlepilot", "help Moodlepilot Indonesia"],
  imagePath: buildContentOGImagePath("page", "faq"),
})

function stripMarkdown(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\(([^)]+)\)/g, " ")
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^[*-]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/[*_#>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function extractFaqEntries(markdown: string) {
  return markdown
    .split(/^##\s+/gm)
    .slice(1)
    .map((section) => {
      const [questionLine, ...answerLines] = section.trim().split("\n")
      return {
        question: questionLine.trim(),
        answer: stripMarkdown(answerLines.join("\n")),
      }
    })
    .filter((entry) => entry.question.length > 0 && entry.answer.length > 0)
}

export default function FaqPage() {
  const page = getStaticPageBySlug("faq")

  if (!page) {
    notFound()
  }

  return (
    <>
      <StructuredData data={createFAQPageStructuredData(page.url, extractFaqEntries(page.body))} />
      <StaticPageLayout page={page} badgeLabel="FAQ" />
    </>
  )
}
