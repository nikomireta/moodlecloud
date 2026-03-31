import type { Metadata } from "next"

import { DocsPageClient } from "@/components/content/docs-page-client"
import { StructuredData } from "@/components/seo/structured-data"
import { getDocLandingData } from "@/lib/content"
import { buildContentOGImagePath, createContentMetadata } from "@/lib/seo"
import { createCollectionPageStructuredData, createFAQPageStructuredData } from "@/lib/structured-data"

type DocumentationPageProps = {
  searchParams: Promise<{ category?: string }>
}

export const metadata: Metadata = createContentMetadata({
  title: "Pusat Bantuan",
  description: "Dokumentasi Moodlepilot dalam bahasa Indonesia untuk memulai, operasional site, backup, laporan, billing, dan keamanan akun.",
  pathname: "/dokumentasi",
  keywords: ["dokumentasi Moodlepilot", "pusat bantuan Moodle", "panduan LMS Indonesia", "help center Moodlepilot"],
  imagePath: buildContentOGImagePath("docs"),
})

export default async function DocumentationPage({ searchParams }: DocumentationPageProps) {
  const resolvedSearchParams = await searchParams
  const selectedCategory = resolvedSearchParams.category ?? null
  const { categories, quickLinks, faqs, popularArticles } = getDocLandingData(selectedCategory)
  const structuredArticles = categories.flatMap((category) => category.articles).slice(0, 18)

  return (
    <>
      <StructuredData
        data={createCollectionPageStructuredData({
          title: "Pusat Bantuan",
          description:
            "Dokumentasi Moodlepilot dalam bahasa Indonesia untuk memulai, operasional site, backup, laporan, billing, dan keamanan akun.",
          path: selectedCategory ? `/dokumentasi?category=${selectedCategory}` : "/dokumentasi",
          items: structuredArticles.map((article) => ({
            name: article.title,
            path: article.url,
            description: article.description,
            dateModified: article.updatedAt,
          })),
        })}
      />
      {faqs.length > 0 ? (
        <StructuredData
          data={createFAQPageStructuredData(
            selectedCategory ? `/dokumentasi?category=${selectedCategory}` : "/dokumentasi",
            faqs.map((faq) => ({
              question: faq.title,
              answer: faq.body,
            })),
          )}
        />
      ) : null}
      <DocsPageClient
        categories={categories}
        quickLinks={quickLinks}
        faqs={faqs}
        popularArticles={popularArticles}
        initialCategory={selectedCategory}
      />
    </>
  )
}
