import Link from "next/link"
import { ArrowLeft, Calendar, Clock, LifeBuoy, ShieldCheck } from "lucide-react"

import { Footer } from "@/components/layout/footer"
import { Header } from "@/components/layout/header"
import { MarkdownContent } from "@/components/content/markdown-content"
import { StructuredData } from "@/components/seo/structured-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { StaticPage } from "@/lib/content-model"
import { createBreadcrumbStructuredData, createWebPageStructuredData } from "@/lib/structured-data"

type StaticPageLayoutProps = {
  page: StaticPage
  badgeLabel: string
}

export function StaticPageLayout({ page, badgeLabel }: StaticPageLayoutProps) {
  const structuredData = [
    createBreadcrumbStructuredData([
      { name: "Beranda", path: "/" },
      { name: page.title, path: page.url },
    ]),
    createWebPageStructuredData({
      title: page.title,
      description: page.description,
      path: page.url,
      dateModified: page.updatedAt,
    }),
  ]

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <StructuredData data={structuredData} />
      <Header />

      <main className="flex-1">
        <section className="border-b border-border py-12">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <Link href="/">
              <Button variant="ghost" size="sm" className="mb-6">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Kembali ke Beranda
              </Button>
            </Link>

            <Badge className="mb-4">{badgeLabel}</Badge>
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
                    <CardTitle className="text-base">Butuh bantuan cepat?</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p className="flex items-start gap-2">
                      <LifeBuoy className="mt-0.5 h-4 w-4 shrink-0" />
                      Mulai dari halaman{" "}
                      <Link href="/dukungan" className="font-medium text-foreground underline underline-offset-4">
                        dukungan
                      </Link>{" "}
                      untuk alur bantuan, status respon, dan panduan eskalasi.
                    </p>
                    <p className="flex items-start gap-2">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                      Baca juga{" "}
                      <Link href="/kebijakan-privasi" className="font-medium text-foreground underline underline-offset-4">
                        kebijakan privasi
                      </Link>{" "}
                      dan{" "}
                      <Link href="/syarat-layanan" className="font-medium text-foreground underline underline-offset-4">
                        syarat layanan
                      </Link>{" "}
                      untuk konteks kebijakan lengkap.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Referensi Produk</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>
                      Untuk panduan langkah demi langkah, buka{" "}
                      <Link href="/dokumentasi" className="font-medium text-foreground underline underline-offset-4">
                        dokumentasi
                      </Link>
                      .
                    </p>
                    <p>
                      Untuk update fitur terbaru, cek{" "}
                      <Link href="/changelog" className="font-medium text-foreground underline underline-offset-4">
                        changelog
                      </Link>{" "}
                      dan{" "}
                      <Link href="/blog" className="font-medium text-foreground underline underline-offset-4">
                        blog
                      </Link>
                      .
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
