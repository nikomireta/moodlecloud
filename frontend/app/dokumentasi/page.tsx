"use client"

import { useState } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Search, 
  Book, 
  Rocket, 
  Settings, 
  Shield, 
  Database,
  Users,
  CreditCard,
  MessageCircle,
  ExternalLink,
  ChevronRight,
  PlayCircle,
  FileText,
  HelpCircle,
  Zap,
  ArrowRight
} from "lucide-react"

// Mock documentation categories
const docCategories = [
  {
    icon: Rocket,
    title: "Memulai",
    description: "Panduan langkah demi langkah untuk memulai dengan Moodlepilot",
    articles: [
      "Membuat Akun Moodlepilot",
      "Membuat Situs Moodle Pertama",
      "Mengonfigurasi Domain Kustom",
      "Mengelola Pengguna Moodle",
    ],
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    icon: Settings,
    title: "Konfigurasi",
    description: "Cara mengonfigurasi dan menyesuaikan situs Moodle Anda",
    articles: [
      "Pengaturan Situs Dasar",
      "Konfigurasi Tema dan Tampilan",
      "Mengatur Plugin Moodle",
      "Pengaturan Email dan Notifikasi",
    ],
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  {
    icon: Shield,
    title: "Keamanan",
    description: "Panduan keamanan dan praktik terbaik",
    articles: [
      "Mengaktifkan SSL/HTTPS",
      "Konfigurasi Autentikasi",
      "Backup dan Pemulihan Data",
      "Audit Log dan Monitoring",
    ],
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  {
    icon: Database,
    title: "Database",
    description: "Pengelolaan database dan optimasi performa",
    articles: [
      "Akses Database phpMyAdmin",
      "Optimasi Performa Database",
      "Migrasi dan Import Data",
      "Troubleshooting Database",
    ],
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
  {
    icon: Users,
    title: "Manajemen Tim",
    description: "Kolaborasi dan pengelolaan akses tim",
    articles: [
      "Mengundang Anggota Tim",
      "Mengatur Role dan Izin",
      "Kolaborasi Multi-Admin",
      "Audit Aktivitas Tim",
    ],
    color: "text-pink-500",
    bgColor: "bg-pink-500/10",
  },
  {
    icon: CreditCard,
    title: "Billing",
    description: "Informasi tagihan dan langganan",
    articles: [
      "Memahami Paket Harga",
      "Metode Pembayaran",
      "Upgrade dan Downgrade",
      "Invoice dan Riwayat Pembayaran",
    ],
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
  },
]

// Mock FAQ
const faqs = [
  {
    question: "Berapa lama waktu yang dibutuhkan untuk membuat situs Moodle?",
    answer: "Pembuatan situs Moodle biasanya memakan waktu 2-5 menit tergantung pada konfigurasi yang dipilih. Anda akan mendapat notifikasi ketika situs siap digunakan.",
  },
  {
    question: "Apakah saya bisa menggunakan domain sendiri?",
    answer: "Ya, semua paket mendukung custom domain. Anda dapat menghubungkan domain kustom melalui pengaturan situs dengan menambahkan CNAME record.",
  },
  {
    question: "Bagaimana cara melakukan backup situs?",
    answer: "Backup otomatis dilakukan setiap hari pukul 03:00 WIB. Anda juga dapat membuat backup manual kapan saja melalui halaman pengaturan situs.",
  },
  {
    question: "Plugin apa saja yang didukung?",
    answer: "Moodlepilot mendukung sebagian besar plugin resmi Moodle. Untuk plugin khusus, silakan hubungi tim support kami untuk instalasi.",
  },
  {
    question: "Bagaimana cara menghubungi support?",
    answer: "Anda dapat menghubungi tim support melalui fitur live chat di dashboard, email ke support@moodlepilot.id, atau melalui WhatsApp di jam kerja.",
  },
]

// Mock popular articles
const popularArticles = [
  { title: "Cara Membuat Situs Moodle Baru", views: "2.4k", category: "Memulai" },
  { title: "Mengonfigurasi Custom Domain", views: "1.8k", category: "Konfigurasi" },
  { title: "Panduan Backup dan Restore", views: "1.5k", category: "Keamanan" },
  { title: "Mengoptimalkan Performa Situs", views: "1.2k", category: "Database" },
  { title: "Mengatur Hak Akses Pengguna", views: "980", category: "Manajemen Tim" },
]

export default function DocumentationPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="border-b border-border bg-gradient-to-b from-muted/50 to-background">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Pusat Bantuan
              </h1>
              <p className="mt-4 text-lg text-muted-foreground">
                Temukan jawaban, panduan, dan dokumentasi untuk Moodlepilot
              </p>
              
              {/* Search */}
              <div className="mt-8 mx-auto max-w-xl">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Cari dokumentasi..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-12 pl-12 pr-4 text-base"
                  />
                </div>
              </div>

              {/* Quick Links */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80">
                  Membuat Situs
                </Badge>
                <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80">
                  Custom Domain
                </Badge>
                <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80">
                  Backup
                </Badge>
                <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80">
                  SSL
                </Badge>
                <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80">
                  API
                </Badge>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Actions */}
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

        {/* Documentation Categories */}
        <section className="py-12">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
              <h2 className="text-xl font-semibold tracking-tight">Dokumentasi</h2>
              <p className="text-muted-foreground">Jelajahi panduan berdasarkan kategori</p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {docCategories.map((category, index) => (
                <Card key={index} className="group cursor-pointer transition-all hover:border-foreground/20 hover:shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${category.bgColor}`}>
                        <category.icon className={`h-5 w-5 ${category.color}`} />
                      </div>
                      <CardTitle className="text-base">{category.title}</CardTitle>
                    </div>
                    <CardDescription className="text-sm">
                      {category.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="space-y-2">
                      {category.articles.map((article, i) => (
                        <li key={i}>
                          <Link 
                            href="#" 
                            className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <ChevronRight className="mr-1 h-3 w-3" />
                            {article}
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <Link 
                      href="#"
                      className="mt-4 inline-flex items-center text-sm font-medium hover:underline"
                    >
                      Lihat semua
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Popular Articles & FAQ */}
        <section className="border-t border-border py-12">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-2">
              {/* Popular Articles */}
              <div>
                <div className="mb-6">
                  <h2 className="text-xl font-semibold tracking-tight">Artikel Populer</h2>
                  <p className="text-muted-foreground">Artikel yang paling sering dibaca</p>
                </div>
                <div className="space-y-3">
                  {popularArticles.map((article, index) => (
                    <Link
                      key={index}
                      href="#"
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
                        <span>{article.views} views</span>
                        <ExternalLink className="h-3 w-3" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* FAQ */}
              <div>
                <div className="mb-6">
                  <h2 className="text-xl font-semibold tracking-tight">Pertanyaan Umum</h2>
                  <p className="text-muted-foreground">Jawaban untuk pertanyaan yang sering diajukan</p>
                </div>
                <div className="space-y-3">
                  {faqs.map((faq, index) => (
                    <div
                      key={index}
                      className="rounded-lg border border-border overflow-hidden"
                    >
                      <button
                        className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
                        onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                      >
                        <div className="flex items-start gap-3">
                          <HelpCircle className="mt-0.5 h-5 w-5 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium text-sm">{faq.question}</span>
                        </div>
                        <ChevronRight 
                          className={`h-5 w-5 text-muted-foreground transition-transform flex-shrink-0 ${
                            expandedFaq === index ? "rotate-90" : ""
                          }`}
                        />
                      </button>
                      {expandedFaq === index && (
                        <div className="border-t border-border bg-muted/30 p-4">
                          <p className="text-sm text-muted-foreground pl-8">{faq.answer}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
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
                <Button variant="outline">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Mulai Live Chat
                </Button>
                <Button>
                  Kirim Tiket Support
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
