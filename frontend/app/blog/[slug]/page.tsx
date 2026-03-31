import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Bookmark, Calendar, Clock, MessageSquare, Share2, ThumbsUp, User } from "lucide-react"

import { Footer } from "@/components/layout/footer"
import { Header } from "@/components/layout/header"
import { MarkdownContent } from "@/components/content/markdown-content"
import { StructuredData } from "@/components/seo/structured-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { getAllBlogPosts, getBlogPostBySlug, getRelatedBlogPosts } from "@/lib/content"
import { buildContentOGImagePath, createContentMetadata } from "@/lib/seo"
import { createArticleStructuredData, createBreadcrumbStructuredData } from "@/lib/structured-data"

type BlogDetailPageProps = {
  params: Promise<{ slug: string }>
}

function BlogCover({
  title,
  coverImage,
  label,
  className = "rounded-lg mb-8",
}: {
  title: string
  coverImage?: string
  label: string
  className?: string
}) {
  if (coverImage) {
    return (
      <div className={`relative aspect-video overflow-hidden bg-muted ${className}`}>
        <Image src={coverImage} alt={title} fill className="object-cover" />
      </div>
    )
  }

  return (
    <div className={`aspect-video bg-muted flex items-center justify-center ${className}`}>
      <span className="text-muted-foreground">{label}</span>
    </div>
  )
}

export function generateStaticParams() {
  return getAllBlogPosts().map((post) => ({
    slug: post.slug,
  }))
}

export async function generateMetadata({ params }: BlogDetailPageProps): Promise<Metadata> {
  const { slug } = await params
  const article = getBlogPostBySlug(slug)

  if (!article) {
    return {}
  }

  return createContentMetadata({
    title: article.title,
    description: article.excerpt,
    pathname: article.url,
    keywords: article.tags,
    imagePath: article.coverImage ?? buildContentOGImagePath("blog", article.slug),
    type: "article",
    publishedTime: article.publishedAt,
  })
}

export default async function BlogDetailPage({ params }: BlogDetailPageProps) {
  const { slug } = await params
  const article = getBlogPostBySlug(slug)

  if (!article) {
    notFound()
  }

  const relatedPosts = getRelatedBlogPosts(slug)
  const structuredData = [
    createBreadcrumbStructuredData([
      { name: "Beranda", path: "/" },
      { name: "Blog", path: "/blog" },
      { name: article.title, path: article.url },
    ]),
    createArticleStructuredData({
      title: article.title,
      description: article.excerpt,
      path: article.url,
      datePublished: article.publishedAt,
      authorName: article.authorName,
      imagePath: article.coverImage,
    }),
  ]

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <StructuredData data={structuredData} />
      <Header />

      <main className="flex-1">
        <section className="border-b border-border py-12">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <Link href="/blog">
              <Button variant="ghost" size="sm" className="mb-6">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Kembali ke Blog
              </Button>
            </Link>

            <Badge className="mb-4">{article.category}</Badge>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">{article.title}</h1>
            <p className="text-lg text-muted-foreground mb-6">{article.excerpt}</p>

            <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{article.authorName}</p>
                  <p className="text-xs">{article.authorRole}</p>
                </div>
              </div>
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {article.publishedLabel}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {article.readTimeLabel}
              </span>
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-[1fr_200px] gap-12">
              <article>
                <BlogCover title={article.title} coverImage={article.coverImage} label="Featured Image" />
                <MarkdownContent content={article.body} />

                <div className="flex flex-wrap gap-2 mt-8 pt-8 border-t border-border">
                  {article.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </article>

              <aside className="hidden lg:block">
                <div className="sticky top-8 space-y-4">
                  <Button variant="outline" className="w-full justify-start" type="button">
                    <Share2 className="mr-2 h-4 w-4" />
                    Bagikan
                  </Button>
                  <Button variant="outline" className="w-full justify-start" type="button">
                    <Bookmark className="mr-2 h-4 w-4" />
                    Simpan
                  </Button>
                  <div className="border-t border-border pt-4">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="h-4 w-4" />
                        {article.likes}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-4 w-4" />
                        {article.comments}
                      </span>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </section>

        <section className="border-t border-border py-12">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold mb-8">Artikel Terkait</h2>
            <div className="grid sm:grid-cols-3 gap-6">
              {relatedPosts.map((post) => (
                <Link key={post.slug} href={post.url}>
                  <Card className="h-full hover:bg-muted/50 transition-colors">
                    <CardHeader className="pb-2">
                      <BlogCover title={post.title} coverImage={post.coverImage} label="Image" className="rounded-md mb-3" />
                      <Badge variant="outline" className="w-fit text-xs">
                        {post.category}
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <h3 className="font-medium text-sm line-clamp-2 mb-2">{post.title}</h3>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {post.readTimeLabel}
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
