'use client'

import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CloudUpload,
  Database,
  Globe,
  Server,
  Shield,
  Sparkles,
} from "lucide-react"

import { Footer } from "@/components/layout/footer"
import { Header } from "@/components/layout/header"
import { useAuth } from "@/components/providers/auth-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatPrice, getGroupStartingPlan, pricingPlanGroups } from "@/lib/pricing"

const heroHighlights = [
  "Provisioning lebih cepat",
  "Domain lebih fleksibel",
  "Backup lebih rapi",
]

const featurePillars = [
  {
    icon: CloudUpload,
    title: "Provisioning lebih rapi",
    description:
      "Daftar, pilih paket, cek subdomain, lalu pantau progres pembuatan site sampai aktif tanpa setup server manual.",
  },
  {
    icon: Globe,
    title: "Branding lebih siap pakai",
    description:
      "Mulai cepat dengan subdomain bawaan, lalu sambungkan custom domain ketika butuh domain institusi sendiri.",
  },
  {
    icon: Shield,
    title: "Backup tidak ditaruh di belakang",
    description:
      "Backup manual dan terjadwal sudah masuk ke alur produk sehingga operasional tidak bergantung pada proses ad hoc.",
  },
  {
    icon: BarChart3,
    title: "Laporan lebih mudah dilihat",
    description:
      "Ada reporting dan snapshot aktivitas agar tim admin lebih cepat membaca kondisi penggunaan site.",
  },
  {
    icon: Server,
    title: "Kontrol runtime tetap ada",
    description:
      "Saat perlu penanganan cepat, runtime site bisa di-start, stop, atau restart dari alur operasional yang sama.",
  },
  {
    icon: Sparkles,
    title: "Workflow AI mulai disiapkan",
    description:
      "AI outline dan export MBZ sudah ada sebagai jalur awal untuk mempercepat penyusunan course.",
    badge: "Eksperimen",
  },
]

const comparisonCards = [
  {
    title: "Moodlepilot",
    subtitle: "Fokus operasional institusi",
    badge: "Paling lengkap",
    items: [
      "Provisioning diarahkan dari alur produk",
      "Subdomain bawaan plus custom domain",
      "Backup terjadwal dan kontrol runtime",
      "Reporting, snapshot, dan notifikasi operasional",
    ],
  },
  {
    title: "MoodleCloud",
    subtitle: "Layanan paket siap pakai",
    items: [
      "Mulai cepat dengan model paket",
      "Domain sendiri tersedia di paket tertentu",
      "Kontrol mengikuti batas layanan paket",
      "Lebih fokus pada hosting siap jalan",
    ],
  },
  {
    title: "Hosting Moodle biasa",
    subtitle: "Lebih banyak setup di pihak Anda",
    items: [
      "Sering butuh setup dan maintain manual",
      "Fleksibel, tetapi konfigurasi ada di pihak Anda",
      "Backup dan kontrol bergantung provider atau admin",
      "Laporan sering perlu plugin atau integrasi tambahan",
    ],
  },
]

const workflowSteps = [
  {
    number: "01",
    title: "Mulai dari paket yang pas",
    description:
      "Pilih kapasitas yang sesuai kebutuhan institusi, bukan langsung masuk ke pekerjaan teknis server.",
  },
  {
    number: "02",
    title: "Atur identitas site",
    description:
      "Tentukan nama site, subdomain, admin utama, lalu lanjutkan ke provisioning dengan alur yang jelas.",
  },
  {
    number: "03",
    title: "Pantau sampai site aktif",
    description:
      "Progress provisioning, status langkah kerja, dan error terakhir bisa dibaca tanpa menebak-nebak.",
  },
  {
    number: "04",
    title: "Kelola operasional harian",
    description:
      "Masuk ke backup, laporan, notifikasi, dan kontrol runtime dari satu dashboard operasional.",
  },
]

const mockupItems = [
  {
    title: "Pendampingan migrasi terarah",
    description: "Framing onboarding untuk institusi yang pindah dari hosting manual atau LMS lama.",
  },
  {
    title: "Ringkasan health lintas site",
    description: "Ikhtisar operasional untuk membantu admin memantau beberapa site dengan lebih cepat.",
  },
]

export default function HomePage() {
  const { status } = useAuth()
  const isLoggedIn = status === "authenticated"

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-border">
          <div className="absolute inset-0 bg-gradient-to-b from-muted/40 via-background to-background" />
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:py-18">
            <div className="relative flex flex-col justify-center">
              <Badge variant="outline" className="w-fit">
                Untuk sekolah, kampus, dan lembaga pelatihan
              </Badge>
              <h1 className="mt-4 max-w-2xl text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-[3.35rem] lg:leading-[1.05]">
                Jalankan Moodle lebih cepat tanpa repot mengurus operasional server dari nol
              </h1>
              <p className="mt-4 max-w-xl text-base text-muted-foreground text-pretty sm:text-lg">
                Moodlepilot membantu institusi menyiapkan site, mengatur domain, memantau backup, membaca laporan,
                dan menangani operasional penting dari satu alur yang lebih rapi.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link href={isLoggedIn ? "/dashboard" : "/daftar"}>
                  <Button size="lg" className="w-full sm:w-auto">
                    Mulai Sekarang
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/harga">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">
                    Lihat Harga
                  </Button>
                </Link>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {heroHighlights.map((item) => (
                  <div
                    key={item}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs text-muted-foreground sm:text-sm"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
                <div className="mb-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold tracking-tight">Dashboard nyata Moodlepilot</p>
                    <p className="text-xs text-muted-foreground sm:text-sm">Ringkasan site dan operasional dalam satu layar.</p>
                  </div>
                  <Badge variant="secondary">Contoh dashboard</Badge>
                </div>

                <div className="overflow-hidden rounded-xl border border-border bg-background">
                  <Image
                    src="/hero-dashboard-safe.svg"
                    alt="Screenshot dashboard Moodlepilot"
                    width={1280}
                    height={720}
                    className="h-auto w-full"
                    priority
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-border py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <Badge variant="outline">Kenapa ini lebih pas untuk institusi</Badge>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                Bukan sekadar hosting Moodle, tetapi alur operasional yang lebih mudah dijalankan
              </h2>
              <p className="mt-4 text-lg text-muted-foreground text-pretty">
                Fokus homepage ini hanya pada hal yang paling penting: memudahkan tim akademik dan admin menjalankan LMS
                tanpa memecah pekerjaan ke banyak alat dan proses manual.
              </p>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {featurePillars.map((feature) => {
                const Icon = feature.icon

                return (
                  <div key={feature.title} className="rounded-xl border border-border bg-card p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      {feature.badge ? <Badge variant="secondary">{feature.badge}</Badge> : null}
                    </div>
                    <h3 className="mt-5 text-lg font-semibold">{feature.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                )
              })}
            </div>

            <div className="mt-8 rounded-xl border border-dashed border-border bg-muted/30 p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Segera</Badge>
                    <p className="text-sm font-semibold">Beberapa alur bisa dimockup dulu untuk memperjelas arah produk</p>
                  </div>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                    Item di bawah ini dapat tampil sebagai sinyal arah pengembangan tanpa diposisikan sebagai fitur yang sudah live.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {mockupItems.map((item) => (
                  <div key={item.title} className="rounded-lg border border-border bg-background p-4">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-border py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <Badge variant="outline">Perbandingan singkat</Badge>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                Bandingkan model pengelolaannya, bukan sekadar tempat menjalankan Moodle
              </h2>
              <p className="mt-4 text-lg text-muted-foreground text-pretty">
                Ringkasan ini mengikuti capability produk di repo dan framing dari dokumentasi publik layanan pembanding.
                Tujuannya untuk membantu tim institusi membaca perbedaan model kerja dengan cepat.
              </p>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              {comparisonCards.map((card) => (
                <div key={card.title} className="rounded-2xl border border-border bg-card p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold">{card.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{card.subtitle}</p>
                    </div>
                    {card.badge ? <Badge>{card.badge}</Badge> : null}
                  </div>

                  <div className="mt-6 space-y-3">
                    {card.items.map((item) => (
                      <div key={item} className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <p className="text-sm text-muted-foreground">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <Badge variant="outline">Cara kerja</Badge>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                Dari daftar sampai site aktif, alurnya dibuat agar mudah diikuti
              </h2>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {workflowSteps.map((step) => (
                <div key={step.number} className="rounded-xl border border-border bg-card p-6">
                  <p className="text-4xl font-bold text-muted-foreground">{step.number}</p>
                  <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-3 text-sm text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <Badge variant="outline">Paket ringkas</Badge>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                Mulai dari kapasitas yang sesuai, lalu naik saat kebutuhan bertambah
              </h2>
              <p className="mt-4 text-lg text-muted-foreground text-pretty">
                Homepage cukup menunjukkan pilihan awal. Detail lengkap, FAQ, dan opsi pembayaran tetap ada di halaman harga.
              </p>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {pricingPlanGroups.map((group) => {
                const startingPlan = getGroupStartingPlan(group)

                return (
                  <div key={group.id} className="rounded-xl border border-border bg-card p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-semibold">{group.name}</h3>
                          {group.popular ? <Badge>Populer</Badge> : null}
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{group.description}</p>
                      </div>
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Database className="h-5 w-5" />
                      </div>
                    </div>

                    <div className="mt-6 rounded-xl bg-muted/40 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Mulai dari</p>
                      <p className="mt-1 text-2xl font-bold">Rp {formatPrice(startingPlan.monthlyPrice)}/bulan</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {startingPlan.usersLabel} • {startingPlan.storageLabel}
                      </p>
                    </div>

                    <div className="mt-6 space-y-3">
                      {group.summaryFeatures.map((feature) => (
                        <div key={feature} className="flex items-start gap-3">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <p className="text-sm text-muted-foreground">{feature}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-8 flex justify-center">
              <Link href="/harga">
                <Button variant="outline" size="lg">
                  Lihat Detail Paket
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
            <Badge variant="outline">Siap mulai</Badge>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Jika yang Anda cari adalah Moodle yang lebih siap dijalankan, mulai dari sini
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground text-pretty">
              Mulai dari paket yang sesuai, aktifkan site, lalu kelola domain, backup, laporan, dan operasional harian
              dari alur yang lebih rapi.
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href={isLoggedIn ? "/dashboard" : "/daftar"}>
                <Button size="lg">
                  Mulai Sekarang
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/harga">
                <Button variant="outline" size="lg">
                  Bandingkan Paket
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
