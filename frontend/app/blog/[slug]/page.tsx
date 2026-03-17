'use client'

import { use } from "react"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Calendar, User, Clock, ArrowLeft, Share2, Bookmark, ThumbsUp, MessageSquare } from "lucide-react"
import Link from "next/link"

const mockArticle = {
  id: "1",
  title: "Panduan Lengkap Memulai Moodle untuk Pembelajaran Online",
  excerpt: "Pelajari cara mengatur Moodle dari awal, mulai dari membuat kursus pertama hingga mengundang siswa.",
  category: "Tutorial",
  author: {
    name: "Tim Moodlepilot",
    avatar: "/avatars/team.jpg",
    role: "Content Team"
  },
  date: "10 Mar 2026",
  readTime: "15 menit",
  content: `
## Pendahuluan

Moodle adalah platform pembelajaran online (LMS) open-source yang paling populer di dunia. Dengan lebih dari 300 juta pengguna di seluruh dunia, Moodle menjadi pilihan utama bagi institusi pendidikan untuk menyelenggarakan pembelajaran daring.

## Langkah 1: Membuat Kursus Pertama

Setelah login ke dashboard Moodle Anda, langkah pertama adalah membuat kursus. Berikut caranya:

1. Klik tombol "Buat Kursus Baru" di dashboard
2. Isi nama kursus dan deskripsi singkat
3. Pilih format kursus (Topik, Mingguan, atau Sosial)
4. Atur tanggal mulai dan selesai kursus
5. Simpan perubahan

## Langkah 2: Menambahkan Materi

Setelah kursus dibuat, Anda dapat menambahkan berbagai jenis materi:

- **File**: Upload dokumen PDF, Word, atau PowerPoint
- **Video**: Embed video dari YouTube atau upload langsung
- **Quiz**: Buat quiz interaktif untuk evaluasi
- **Forum**: Diskusi antar siswa
- **Assignment**: Tugas yang harus dikumpulkan siswa

## Langkah 3: Mengundang Siswa

Ada beberapa cara untuk mengundang siswa ke kursus Anda:

1. **Self-enrollment**: Siswa mendaftar sendiri dengan kode enrollment
2. **Manual enrollment**: Anda menambahkan siswa satu per satu
3. **Bulk upload**: Import daftar siswa dari file CSV

## Tips untuk Engagement yang Lebih Baik

Untuk meningkatkan keterlibatan siswa dalam pembelajaran online:

- Gunakan berbagai format konten (video, text, interactive)
- Berikan feedback yang cepat dan konstruktif
- Buat forum diskusi yang aktif
- Gunakan gamifikasi dengan badge dan leaderboard
- Adakan sesi live secara berkala

## Kesimpulan

Memulai dengan Moodle mungkin terasa overwhelming pada awalnya, tetapi dengan panduan yang tepat, Anda dapat menguasai platform ini dengan cepat. Moodlepilot menyediakan semua tools yang Anda butuhkan untuk sukses dalam pembelajaran online.

Jika Anda membutuhkan bantuan lebih lanjut, tim support kami siap membantu 24/7.
  `,
  tags: ["Moodle", "Tutorial", "Pemula", "E-Learning"],
  likes: 124,
  comments: 18
}

const relatedPosts = [
  {
    id: "2",
    title: "10 Tips Meningkatkan Engagement Siswa di Moodle",
    category: "Tips & Trik",
    readTime: "8 menit"
  },
  {
    id: "5",
    title: "Cara Membuat Quiz Interaktif yang Efektif",
    category: "Tutorial",
    readTime: "12 menit"
  },
  {
    id: "6",
    title: "Best Practice Backup dan Recovery di Moodle",
    category: "Tips & Trik",
    readTime: "7 menit"
  }
]

export default function BlogDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      
      <main className="flex-1">
        {/* Article Header */}
        <section className="border-b border-border py-12">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <Link href="/blog">
              <Button variant="ghost" size="sm" className="mb-6">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Kembali ke Blog
              </Button>
            </Link>

            <Badge className="mb-4">{mockArticle.category}</Badge>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              {mockArticle.title}
            </h1>
            <p className="text-lg text-muted-foreground mb-6">
              {mockArticle.excerpt}
            </p>

            <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{mockArticle.author.name}</p>
                  <p className="text-xs">{mockArticle.author.role}</p>
                </div>
              </div>
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {mockArticle.date}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {mockArticle.readTime}
              </span>
            </div>
          </div>
        </section>

        {/* Article Content */}
        <section className="py-12">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-[1fr_200px] gap-12">
              {/* Main Content */}
              <article className="prose prose-neutral dark:prose-invert max-w-none">
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center mb-8">
                  <span className="text-muted-foreground">Featured Image</span>
                </div>

                {mockArticle.content.split('\n').map((paragraph, idx) => {
                  if (paragraph.startsWith('## ')) {
                    return <h2 key={idx} className="text-2xl font-bold mt-8 mb-4">{paragraph.replace('## ', '')}</h2>
                  }
                  if (paragraph.startsWith('- **')) {
                    const match = paragraph.match(/- \*\*(.+?)\*\*: (.+)/)
                    if (match) {
                      return (
                        <li key={idx} className="mb-2">
                          <strong>{match[1]}</strong>: {match[2]}
                        </li>
                      )
                    }
                  }
                  if (paragraph.match(/^\d\./)) {
                    return <li key={idx} className="mb-2">{paragraph.replace(/^\d\.\s/, '')}</li>
                  }
                  if (paragraph.trim()) {
                    return <p key={idx} className="mb-4 text-muted-foreground">{paragraph}</p>
                  }
                  return null
                })}

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mt-8 pt-8 border-t border-border">
                  {mockArticle.tags.map((tag) => (
                    <Badge key={tag} variant="outline">{tag}</Badge>
                  ))}
                </div>
              </article>

              {/* Sidebar */}
              <aside className="hidden lg:block">
                <div className="sticky top-8 space-y-4">
                  <Button variant="outline" className="w-full justify-start">
                    <Share2 className="mr-2 h-4 w-4" />
                    Bagikan
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Bookmark className="mr-2 h-4 w-4" />
                    Simpan
                  </Button>
                  <div className="border-t border-border pt-4">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="h-4 w-4" />
                        {mockArticle.likes}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-4 w-4" />
                        {mockArticle.comments}
                      </span>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </section>

        {/* Related Posts */}
        <section className="border-t border-border py-12">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold mb-8">Artikel Terkait</h2>
            <div className="grid sm:grid-cols-3 gap-6">
              {relatedPosts.map((post) => (
                <Link key={post.id} href={`/blog/${post.id}`}>
                  <Card className="h-full hover:bg-muted/50 transition-colors">
                    <CardHeader className="pb-2">
                      <div className="aspect-video bg-muted rounded-md flex items-center justify-center mb-3">
                        <span className="text-xs text-muted-foreground">Image</span>
                      </div>
                      <Badge variant="outline" className="w-fit text-xs">{post.category}</Badge>
                    </CardHeader>
                    <CardContent>
                      <h3 className="font-medium text-sm line-clamp-2 mb-2">{post.title}</h3>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {post.readTime}
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
