"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  ChevronRight,
  CreditCard,
  Database,
  ExternalLink,
  FileText,
  HelpCircle,
  MessageCircle,
  PlayCircle,
  Rocket,
  Search,
  Settings,
  Shield,
  Users,
  Zap,
  ArrowRight,
} from "lucide-react"

import { Footer } from "@/components/layout/footer"
import { Header } from "@/components/layout/header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { DOC_CATEGORY_CONFIG, type DocLandingCategory, type DocPage, type DocPageMeta } from "@/lib/content-model"

type DocsPageClientProps = {
  categories: DocLandingCategory[]
  quickLinks: DocPageMeta[]
  faqs: DocPage[]
  popularArticles: DocPageMeta[]
  initialCategory?: string | null
}

const categoryIcons = {
  [DOC_CATEGORY_CONFIG.memulai.icon]: Rocket,
  [DOC_CATEGORY_CONFIG["pembuatan-situs-dan-domain"].icon]: Settings,
  [DOC_CATEGORY_CONFIG["operasional-dan-runtime"].icon]: Shield,
  [DOC_CATEGORY_CONFIG["backup-dan-pemulihan"].icon]: Database,
  [DOC_CATEGORY_CONFIG["laporan-dan-analytics"].icon]: Users,
  [DOC_CATEGORY_CONFIG["akun-billing-dan-keamanan"].icon]: CreditCard,
} as const

export function DocsPageClient({
  categories,
  quickLinks,
  faqs,
  popularArticles,
  initialCategory,
}: DocsPageClientProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)

  const filteredCategories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return categories
      .map((category) => ({
        ...category,
        articles: category.articles.filter((article) => {
          if (!query) {
            return true
          }
          return article.searchText.toLowerCase().includes(query)
        }),
      }))
      .filter((category) => category.articles.length > 0 || !query)
  }, [categories, searchQuery])

  const filteredPopularArticles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) {
      return popularArticles
    }
    return popularArticles.filter((article) => article.searchText.toLowerCase().includes(query))
  }, [popularArticles, searchQuery])

  const filteredFaqs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) {
      return faqs
    }
    return faqs.filter((faq) => faq.searchText.toLowerCase().includes(query) || faq.body.toLowerCase().includes(query))
  }, [faqs, searchQuery])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        <section className="border-b border-border bg-gradient-to-b from-muted/50 to-background">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Pusat Bantuan</h1>
              <p className="mt-4 text-lg text-muted-foreground">
                Temukan jawaban, panduan, dan dokumentasi untuk Moodlepilot
              </p>

              <div className="mt-8 mx-auto max-w-xl">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Cari dokumentasi..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="h-12 pl-12 pr-4 text-base"
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                {quickLinks.map((link) => (
                  <Link key={link.slug} href={link.url}>
                    <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80">
                      {link.title}
                    </Badge>
                  </Link>
                ))}
              </div>

              {initialCategory ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Menampilkan kategori terpilih. Hapus filter dengan kembali ke{" "}
                  <Link href="/dokumentasi" className="font-medium text-foreground underline underline-offset-4">
                    semua dokumentasi
                  </Link>
                  .
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="border-b border-border py-8">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="group cursor-pointer transition-colors hover:border-foreground/20">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                    <PlayCircle className="h-6 w-6 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                  <div>
                    <p className="font-medium">Video Tutorial</p>
                    <p className="text-sm text-muted-foreground">Panduan visual step-by-step</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="group cursor-pointer transition-colors hover:border-foreground/20">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                    <MessageCircle className="h-6 w-6 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                  <div>
                    <p className="font-medium">Live Chat</p>
                    <p className="text-sm text-muted-foreground">Hubungi tim support</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="group cursor-pointer transition-colors hover:border-foreground/20">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                    <Zap className="h-6 w-6 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                  <div>
                    <p className="font-medium">Status Sistem</p>
                    <p className="text-sm text-muted-foreground">Semua sistem beroperasi</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
              <h2 className="text-xl font-semibold tracking-tight">Dokumentasi</h2>
              <p className="text-muted-foreground">Jelajahi panduan berdasarkan kategori</p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCategories.map((category) => {
                const Icon = categoryIcons[category.icon]

                return (
                  <Card key={category.slug} className="group cursor-pointer transition-all hover:border-foreground/20 hover:shadow-sm">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${category.bgColor}`}>
                          <Icon className={`h-5 w-5 ${category.color}`} />
                        </div>
                        <CardTitle className="text-base">{category.title}</CardTitle>
                      </div>
                      <CardDescription className="text-sm">{category.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <ul className="space-y-2">
                        {category.articles.slice(0, 4).map((article) => (
                          <li key={article.slug}>
                            <Link
                              href={article.url}
                              className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <ChevronRight className="mr-1 h-3 w-3" />
                              {article.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                      <Link
                        href={`/dokumentasi?category=${category.slug}`}
                        className="mt-4 inline-flex items-center text-sm font-medium hover:underline"
                      >
                        Lihat semua
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </Link>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {filteredCategories.length === 0 ? (
              <div className="mt-8 rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
                Tidak ada artikel dokumentasi yang cocok dengan pencarian Anda.
              </div>
            ) : null}
          </div>
        </section>

        <section className="border-t border-border py-12">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-2">
              <div>
                <div className="mb-6">
                  <h2 className="text-xl font-semibold tracking-tight">Artikel Populer</h2>
                  <p className="text-muted-foreground">Artikel yang paling sering dibaca</p>
                </div>
                <div className="space-y-3">
                  {filteredPopularArticles.map((article) => (
                    <Link
                      key={article.slug}
                      href={article.url}
                      className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:border-foreground/20 hover:bg-muted/50"
                    >
                      <div className="flex items-start gap-3">
                        <FileText className="mt-0.5 h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">{article.title}</p>
                          <p className="text-xs text-muted-foreground">{article.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{article.viewsLabel ?? "Populer"}</span>
                        <ExternalLink className="h-3 w-3" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-6">
                  <h2 className="text-xl font-semibold tracking-tight">Pertanyaan Umum</h2>
                  <p className="text-muted-foreground">Jawaban untuk pertanyaan yang sering diajukan</p>
                </div>
                <div className="space-y-3">
                  {filteredFaqs.map((faq, index) => (
                    <div key={faq.slug} className="rounded-lg border border-border overflow-hidden">
                      <button
                        className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
                        onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                        type="button"
                      >
                        <div className="flex items-start gap-3">
                          <HelpCircle className="mt-0.5 h-5 w-5 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium text-sm">{faq.title}</span>
                        </div>
                        <ChevronRight
                          className={`h-5 w-5 text-muted-foreground transition-transform flex-shrink-0 ${
                            expandedFaq === index ? "rotate-90" : ""
                          }`}
                        />
                      </button>
                      {expandedFaq === index ? (
                        <div className="border-t border-border bg-muted/30 p-4">
                          <div className="pl-8 text-sm">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                p: ({ children }) => <p className="text-sm leading-6 text-muted-foreground">{children}</p>,
                                a: ({ href, children }) => {
                                  if (!href) {
                                    return <span>{children}</span>
                                  }
                                  if (href.startsWith("/")) {
                                    return (
                                      <Link
                                        href={href}
                                        className="font-medium text-foreground underline underline-offset-4 hover:text-foreground/80"
                                      >
                                        {children}
                                      </Link>
                                    )
                                  }
                                  return (
                                    <a
                                      href={href}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="font-medium text-foreground underline underline-offset-4 hover:text-foreground/80"
                                    >
                                      {children}
                                    </a>
                                  )
                                },
                              }}
                            >
                              {faq.body}
                            </ReactMarkdown>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-muted/30 py-12">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
                <MessageCircle className="h-7 w-7 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold tracking-tight">Masih butuh bantuan?</h2>
              <p className="mt-2 text-muted-foreground max-w-md">
                Tim support kami siap membantu Anda. Hubungi kami melalui live chat atau kirim tiket support.
              </p>
              <div className="mt-6 flex gap-3">
                <Button variant="outline" type="button">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Mulai Live Chat
                </Button>
                <Button type="button">Kirim Tiket Support</Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
