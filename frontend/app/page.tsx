'use client'

// MoodleCloud Indonesia - Landing Page
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"
import { ArrowRight, CloudUpload, BarChart3, Lock, Users, Zap, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/components/providers/auth-provider"

export default function HomePage() {
  const { status } = useAuth()
  const isLoggedIn = status === "authenticated"

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-border">
          <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-8 items-center">
              <div className="flex flex-col justify-center">
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl text-balance">
                  Platform Manajemen Moodle Cloud untuk Indonesia
                </h1>
                <p className="mt-6 text-lg text-muted-foreground max-w-lg text-pretty">
                  Buat, kelola, dan skalakan situs Moodle Anda dengan mudah. Infrastruktur cloud yang andal, performa tinggi, dan dukungan penuh dalam bahasa Indonesia.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link href={isLoggedIn ? "/dashboard" : "/daftar"}>
                    <Button size="lg" className="w-full sm:w-auto">
                      Mulai Gratis
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/dokumentasi">
                    <Button variant="outline" size="lg" className="w-full sm:w-auto">
                      Pelajari Lebih Lanjut
                    </Button>
                  </Link>
                </div>
                
                {/* Stats */}
                <div className="mt-12 grid grid-cols-3 gap-8">
                  <div>
                    <p className="text-2xl font-bold">500+</p>
                    <p className="text-sm text-muted-foreground">Institusi Pendidikan</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">50K+</p>
                    <p className="text-sm text-muted-foreground">Pengguna Aktif</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">99.9%</p>
                    <p className="text-sm text-muted-foreground">Uptime</p>
                  </div>
                </div>
              </div>

              {/* Visual Element */}
              <div className="relative h-96 rounded-lg border border-border bg-card overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5" />
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <CloudUpload className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Dashboard Manajemen Intuitif</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="border-b border-border py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Fitur Unggulan
              </h2>
              <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                Semua yang Anda butuhkan untuk mengelola Moodle dengan efisien
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  icon: CloudUpload,
                  title: "Pembuatan Situs Instant",
                  description: "Buat situs Moodle baru dalam hitungan menit tanpa perlu konfigurasi server yang rumit"
                },
                {
                  icon: BarChart3,
                  title: "Analytics Mendalam",
                  description: "Pantau performa situs dengan dashboard analytics yang comprehensive dan real-time"
                },
                {
                  icon: Lock,
                  title: "Keamanan Enterprise",
                  description: "Enkripsi end-to-end, backup otomatis harian, dan compliance dengan standar internasional"
                },
                {
                  icon: Zap,
                  title: "Performa Tinggi",
                  description: "CDN global, caching otomatis, dan optimasi server untuk kecepatan maksimal"
                },
                {
                  icon: Users,
                  title: "Manajemen Tim",
                  description: "Kelola anggota tim, atur role dan permission dengan sistem kontrol akses yang fleksibel"
                },
                {
                  icon: CheckCircle2,
                  title: "Dukungan Lokal",
                  description: "Tim support berpengalaman siap membantu dalam bahasa Indonesia 24/7"
                }
              ].map((feature, idx) => {
                const Icon = feature.icon
                return (
                  <div key={idx} className="rounded-lg border border-border bg-card p-6 hover:bg-card/80 transition-colors">
                    <Icon className="h-8 w-8 mb-4 text-primary" />
                    <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="border-b border-border py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Cara Kerja
              </h2>
              <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                Tiga langkah sederhana untuk mulai menggunakan MoodleCloud
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  number: "01",
                  title: "Daftar Akun",
                  description: "Buat akun MoodleCloud Anda dengan email dalam waktu kurang dari 2 menit"
                },
                {
                  number: "02",
                  title: "Konfigurasi Situs",
                  description: "Pilih subdomain, atur informasi dasar, dan sesuaikan pengaturan situs sesuai kebutuhan"
                },
                {
                  number: "03",
                  title: "Mulai Mengajar",
                  description: "Situs Anda siap digunakan! Mulai buat kursus dan undang pengguna sekarang"
                }
              ].map((step, idx) => (
                <div key={idx} className="relative">
                  <div className="rounded-lg border border-border bg-card p-8">
                    <div className="text-4xl font-bold text-muted-foreground mb-4">{step.number}</div>
                    <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                    <p className="text-muted-foreground text-sm">{step.description}</p>
                  </div>
                  {idx < 2 && (
                    <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-border" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="border-b border-border py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Paket Harga Terjangkau
              </h2>
              <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                Pilih paket yang sesuai dengan kebutuhan Anda
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  name: "Starter",
                  price: "Gratis",
                  description: "Untuk individu dan kelas kecil",
                  features: ["1 situs Moodle", "hingga 100 pengguna", "2 GB storage", "Support email"]
                },
                {
                  name: "Professional",
                  price: "Rp 499K",
                  period: "/bulan",
                  description: "Untuk institusi menengah",
                  features: ["Hingga 5 situs", "hingga 1000 pengguna", "100 GB storage", "Support prioritas", "Backup harian"],
                  highlighted: true
                },
                {
                  name: "Enterprise",
                  price: "Custom",
                  description: "Untuk institusi besar",
                  features: ["Unlimited situs", "Unlimited pengguna", "Unlimited storage", "Dedicated support", "SLA guarantee"]
                }
              ].map((plan, idx) => (
                <div key={idx} className={`rounded-lg border-2 p-8 transition-colors ${
                  plan.highlighted 
                    ? 'border-primary bg-card' 
                    : 'border-border bg-card/50'
                }`}>
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
                  <div className="mb-6">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    {plan.period && <span className="text-muted-foreground ml-1">{plan.period}</span>}
                  </div>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button 
                    variant={plan.highlighted ? "default" : "outline"} 
                    className="w-full"
                  >
                    Pilih Paket
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              Siap Memulai?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Bergabunglah dengan ribuan institusi pendidikan yang telah mempercayai MoodleCloud untuk mengelola pembelajaran mereka
            </p>
            <div className="flex flex-col gap-3 sm:flex-row justify-center">
              <Link href={isLoggedIn ? "/dashboard" : "/daftar"}>
                <Button size="lg">
                  Mulai Sekarang - Gratis
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/dokumentasi">
                <Button variant="outline" size="lg">
                  Lihat Dokumentasi
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
