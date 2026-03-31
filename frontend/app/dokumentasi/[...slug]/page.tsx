import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Calendar, ChevronRight, Clock, FileText } from "lucide-react"

import { Footer } from "@/components/layout/footer"
import { Header } from "@/components/layout/header"
import { MarkdownContent } from "@/components/content/markdown-content"
import { StructuredData } from "@/components/seo/structured-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getAllDocPages, getDocPageBySlugSegments, getDocSiblingPages } from "@/lib/content"
import { buildContentOGImagePath, createContentMetadata, SITE_NAME } from "@/lib/seo"
import { createArticleStructuredData, createBreadcrumbStructuredData } from "@/lib/structured-data"

type DocumentationDetailPageProps = {
  params: Promise<{ slug: string[] }>
}

export function generateStaticParams() {
  return getAllDocPages().map((page) => ({
    slug: page.slugSegments,
  }))
}

export async function generateMetadata({ params }: DocumentationDetailPageProps): Promise<Metadata> {
  const { slug } = await params
  const page = getDocPageBySlugSegments(slug)

  if (!page) {
    return {}
  }

  return createContentMetadata({
    title: page.title,
    description: page.description,
    pathname: page.url,
    keywords: [page.category, "dokumentasi Moodlepilot", "panduan Moodlepilot"],
    imagePath: buildContentOGImagePath("docs", page.slugSegments.join("/")),
    type: "article",
    modifiedTime: page.updatedAt,
  })
}

export default async function DocumentationDetailPage({ params }: DocumentationDetailPageProps) {
  const { slug } = await params
  const page = getDocPageBySlugSegments(slug)

  if (!page) {
    notFound()
  }

  const siblingPages = getDocSiblingPages(page)
  const structuredData = [
    createBreadcrumbStructuredData([
      { name: "Beranda", path: "/" },
      { name: "Dokumentasi", path: "/dokumentasi" },
      { name: page.category, path: `/dokumentasi?category=${page.categorySlug}` },
      { name: page.title, path: page.url },
    ]),
    createArticleStructuredData({
      title: page.title,
      description: page.description,
      path: page.url,
      dateModified: page.updatedAt,
      authorName: SITE_NAME,
      type: "TechArticle",
    }),
  ]

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <StructuredData data={structuredData} />
      <Header />

      <main className="flex-1">
        <section className="border-b border-border py-12">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <Link href="/dokumentasi">
              <Button variant="ghost" size="sm" className="mb-6">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Kembali ke Dokumentasi
              </Button>
            </Link>

            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Link href="/dokumentasi" className="hover:text-foreground">
                Dokumentasi
              </Link>
              <ChevronRight className="h-4 w-4" />
              <Link href={`/dokumentasi?category=${page.categorySlug}`} className="hover:text-foreground">
                {page.category}
              </Link>
            </div>

            <Badge className="mt-4 mb-4">{page.category}</Badge>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{page.title}</h1>
            <p className="mt-4 max-w-3xl text-lg text-muted-foreground">{page.description}</p>

            <div className="mt-6 flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Diperbarui {page.updatedLabel}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {page.readTimeLabel}
              </span>
              {page.faq ? (
                <span className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  FAQ
                </span>
              ) : null}
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[1fr_260px]">
              <article className="min-w-0">
                <MarkdownContent content={page.body} />
              </article>

              <aside className="space-y-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Dalam kategori ini</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {siblingPages.length > 0 ? (
                      siblingPages.map((sibling) => (
                        <Link
                          key={sibling.slug}
                          href={sibling.url}
                          className="block text-sm text-muted-foreground hover:text-foreground"
                        >
                          {sibling.title}
                        </Link>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Artikel ini saat ini berdiri sendiri di kategori {page.category}.
                      </p>
                    )}
                    <Link
                      href={`/dokumentasi?category=${page.categorySlug}`}
                      className="inline-flex items-center text-sm font-medium hover:underline"
                    >
                      Lihat kategori
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Link>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Butuh konteks lebih lanjut?</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>
                      Cek juga halaman{" "}
                      <Link href="/changelog" className="font-medium text-foreground underline underline-offset-4">
                        changelog
                      </Link>{" "}
                      untuk melihat pembaruan fitur terbaru.
                    </p>
                    <p>
                      Jika Anda sedang menyiapkan site baru, halaman{" "}
                      <Link href="/buat-situs" className="font-medium text-foreground underline underline-offset-4">
                        Buat Situs
                      </Link>{" "}
                      bisa membantu menerapkan panduan ini langsung di dashboard.
                    </p>
                  </CardContent>
                </Card>
              </aside>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
