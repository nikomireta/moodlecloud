import type { Metadata } from "next"
import { Calendar, Clock, Sparkles } from "lucide-react"

import { Footer } from "@/components/layout/footer"
import { Header } from "@/components/layout/header"
import { MarkdownContent } from "@/components/content/markdown-content"
import { StructuredData } from "@/components/seo/structured-data"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { getChangelogEntries } from "@/lib/content"
import { buildContentOGImagePath, createContentMetadata } from "@/lib/seo"
import { createCollectionPageStructuredData } from "@/lib/structured-data"

const changelogTypeLabel = {
  "fitur-baru": "Fitur Baru",
  peningkatan: "Peningkatan",
  perbaikan: "Perbaikan",
} as const

export const metadata: Metadata = createContentMetadata({
  title: "Changelog",
  description: "Catatan rilis Moodlepilot berisi fitur baru, peningkatan, dan perbaikan produk yang relevan untuk operasional LMS.",
  pathname: "/changelog",
  keywords: ["changelog Moodlepilot", "rilis fitur Moodlepilot", "update produk LMS"],
  imagePath: buildContentOGImagePath("changelog"),
})

export default function ChangelogPage() {
  const entries = getChangelogEntries()

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <StructuredData
        data={createCollectionPageStructuredData({
          title: "Changelog",
          description:
            "Catatan rilis Moodlepilot berisi fitur baru, peningkatan, dan perbaikan produk yang relevan untuk operasional LMS.",
          path: "/changelog",
          items: entries.map((entry) => ({
            name: entry.title,
            path: entry.url,
            description: entry.summary,
            datePublished: entry.publishedAt,
          })),
        })}
      />
      <Header />

      <main className="flex-1">
        <section className="border-b border-border bg-gradient-to-b from-muted/50 to-background">
          <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 lg:px-8">
            <Badge variant="outline" className="mb-4">
              Changelog
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Perubahan Produk Moodlepilot</h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Catatan rilis singkat untuk fitur baru, peningkatan, dan perbaikan yang sudah masuk ke alur produk.
            </p>
          </div>
        </section>

        <section className="py-12">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="space-y-6">
              {entries.map((entry) => (
                <Card key={entry.slug} id={entry.slug} className="scroll-mt-24">
                  <CardHeader className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{changelogTypeLabel[entry.type]}</Badge>
                      <Badge variant="outline">{entry.productArea}</Badge>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight">{entry.title}</h2>
                      <p className="mt-2 text-muted-foreground">{entry.summary}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {entry.publishedLabel}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {entry.readTimeLabel}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <MarkdownContent content={entry.body} />
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-12 rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Sparkles className="h-6 w-6 text-muted-foreground" />
              </div>
              <h2 className="mt-4 text-xl font-semibold tracking-tight">Butuh ringkasan yang lebih praktis?</h2>
              <p className="mt-2 text-muted-foreground">
                Cek halaman blog dan dokumentasi untuk panduan penggunaan fitur yang sudah dirilis.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
