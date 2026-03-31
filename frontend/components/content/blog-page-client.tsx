"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { ArrowRight, Calendar, Clock, Search, User } from "lucide-react"

import { Footer } from "@/components/layout/footer"
import { Header } from "@/components/layout/header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { BlogPostMeta } from "@/lib/content-model"

type BlogPageClientProps = {
  categories: string[]
  featuredPost: BlogPostMeta | null
  posts: BlogPostMeta[]
}

function PostCover({ coverImage, title, label, compact = false }: { coverImage?: string; title: string; label: string; compact?: boolean }) {
  const heightClassName = compact ? "rounded-md" : "rounded-none"

  if (coverImage) {
    return (
      <div className={`relative aspect-video overflow-hidden bg-muted ${heightClassName}`}>
        <Image src={coverImage} alt={title} fill className="object-cover" />
      </div>
    )
  }

  return (
    <div className={`aspect-video bg-muted flex items-center justify-center ${heightClassName}`}>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  )
}

export function BlogPageClient({ categories, featuredPost, posts }: BlogPageClientProps) {
  const [selectedCategory, setSelectedCategory] = useState("Semua")
  const [searchQuery, setSearchQuery] = useState("")

  const filteredPosts = posts.filter((post) => {
    const matchesCategory = selectedCategory === "Semua" || post.category === selectedCategory
    const matchesSearch = post.searchText.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        <section className="border-b border-border py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">Blog & Knowledge Base</h1>
              <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                Tips, tutorial, dan berita terbaru seputar Moodle dan e-learning
              </p>
            </div>

            <div className="max-w-xl mx-auto relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Cari artikel..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-10 h-12"
              />
            </div>

            <div className="flex flex-wrap justify-center gap-2 mt-8">
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>
        </section>

        {featuredPost && selectedCategory === "Semua" && searchQuery === "" ? (
          <section className="border-b border-border py-12">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <Link href={featuredPost.url}>
                <Card className="overflow-hidden hover:bg-muted/50 transition-colors">
                  <div className="grid md:grid-cols-2 gap-6">
                    <PostCover coverImage={featuredPost.coverImage} title={featuredPost.title} label="Featured Image" />
                    <div className="p-6 flex flex-col justify-center">
                      <Badge className="w-fit mb-4">{featuredPost.category}</Badge>
                      <h2 className="text-2xl font-bold mb-3">{featuredPost.title}</h2>
                      <p className="text-muted-foreground mb-4">{featuredPost.excerpt}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          {featuredPost.authorName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {featuredPost.publishedLabel}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {featuredPost.readTimeLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            </div>
          </section>
        ) : null}

        <section className="py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPosts.map((post) => (
                <Link key={post.slug} href={post.url}>
                  <Card className="h-full hover:bg-muted/50 transition-colors">
                    <CardHeader className="pb-3">
                      <PostCover coverImage={post.coverImage} title={post.title} label="Image" compact />
                      <Badge variant="outline" className="w-fit mt-4">
                        {post.category}
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <h3 className="font-semibold mb-2 line-clamp-2">{post.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{post.excerpt}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {post.authorName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {post.readTimeLabel}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            {filteredPosts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Tidak ada artikel yang ditemukan</p>
              </div>
            ) : null}

            {filteredPosts.length > 0 ? (
              <div className="text-center mt-12">
                <Button variant="outline" type="button">
                  Muat Lebih Banyak
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            ) : null}
          </div>
        </section>

        <section className="border-t border-border py-16 bg-muted/30">
          <div className="mx-auto max-w-xl px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Berlangganan Newsletter</h2>
            <p className="text-muted-foreground mb-6">Dapatkan tips dan update terbaru langsung di inbox Anda</p>
            <div className="flex gap-2">
              <Input type="email" placeholder="Masukkan email Anda" className="flex-1" />
              <Button type="button">Langganan</Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
