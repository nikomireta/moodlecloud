'use client'

import { useState } from "react"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, X, HelpCircle, ArrowRight } from "lucide-react"
import Link from "next/link"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const plans = [
  {
    name: "Starter",
    description: "Untuk individu dan kelas kecil",
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: {
      sites: "1 situs",
      users: "100 pengguna",
      storage: "2 GB",
      bandwidth: "10 GB/bulan",
      backup: "Mingguan",
      support: "Email",
      ssl: true,
      customDomain: false,
      api: false,
      analytics: false,
      plugins: "Terbatas",
      sla: "-"
    }
  },
  {
    name: "Professional",
    description: "Untuk institusi menengah",
    monthlyPrice: 499000,
    yearlyPrice: 4990000,
    popular: true,
    features: {
      sites: "5 situs",
      users: "1.000 pengguna",
      storage: "100 GB",
      bandwidth: "100 GB/bulan",
      backup: "Harian",
      support: "Prioritas",
      ssl: true,
      customDomain: true,
      api: true,
      analytics: true,
      plugins: "Semua",
      sla: "99.5%"
    }
  },
  {
    name: "Enterprise",
    description: "Untuk institusi besar",
    monthlyPrice: null,
    yearlyPrice: null,
    features: {
      sites: "Unlimited",
      users: "Unlimited",
      storage: "Unlimited",
      bandwidth: "Unlimited",
      backup: "Real-time",
      support: "Dedicated",
      ssl: true,
      customDomain: true,
      api: true,
      analytics: true,
      plugins: "Semua + Custom",
      sla: "99.99%"
    }
  }
]

const featureComparison = [
  { name: "Jumlah Situs", key: "sites", tooltip: "Jumlah situs Moodle yang dapat dibuat" },
  { name: "Pengguna", key: "users", tooltip: "Maksimal pengguna per situs" },
  { name: "Storage", key: "storage", tooltip: "Kapasitas penyimpanan total" },
  { name: "Bandwidth", key: "bandwidth", tooltip: "Transfer data per bulan" },
  { name: "Backup", key: "backup", tooltip: "Frekuensi backup otomatis" },
  { name: "Support", key: "support", tooltip: "Jenis dukungan pelanggan" },
  { name: "SSL Certificate", key: "ssl", tooltip: "Sertifikat SSL gratis" },
  { name: "Custom Domain", key: "customDomain", tooltip: "Gunakan domain sendiri" },
  { name: "API Access", key: "api", tooltip: "Akses API untuk integrasi" },
  { name: "Analytics", key: "analytics", tooltip: "Dashboard analitik lanjutan" },
  { name: "Plugin Support", key: "plugins", tooltip: "Dukungan plugin Moodle" },
  { name: "SLA Uptime", key: "sla", tooltip: "Jaminan uptime" },
]

const faqs = [
  {
    question: "Apakah ada biaya tersembunyi?",
    answer: "Tidak ada biaya tersembunyi. Harga yang tertera sudah mencakup semua fitur yang disebutkan. Anda hanya membayar sesuai paket yang dipilih."
  },
  {
    question: "Bagaimana cara upgrade atau downgrade paket?",
    answer: "Anda dapat mengubah paket kapan saja melalui dashboard. Perubahan akan berlaku di siklus billing berikutnya. Untuk upgrade, Anda akan dikenakan biaya prorata."
  },
  {
    question: "Apakah ada periode trial gratis?",
    answer: "Ya, paket Starter gratis selamanya. Untuk paket berbayar, kami menyediakan trial 14 hari dengan akses penuh ke semua fitur."
  },
  {
    question: "Metode pembayaran apa yang tersedia?",
    answer: "Kami menerima pembayaran melalui kartu kredit/debit, transfer bank, dan e-wallet populer di Indonesia seperti GoPay, OVO, dan DANA."
  },
  {
    question: "Bagaimana jika saya melebihi kuota?",
    answer: "Anda akan menerima notifikasi saat mendekati batas kuota. Jika melebihi, layanan tidak akan langsung berhenti, namun kami akan menghubungi Anda untuk upgrade paket."
  },
  {
    question: "Apakah data saya aman?",
    answer: "Keamanan adalah prioritas kami. Semua data dienkripsi, backup dilakukan secara rutin, dan server kami memenuhi standar keamanan internasional."
  }
]

function formatPrice(price: number) {
  return new Intl.NumberFormat('id-ID').format(price)
}

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="border-b border-border py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
            <Badge variant="outline" className="mb-4">
              Harga Transparan
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl text-balance">
              Paket Harga yang Sesuai Kebutuhan
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
              Mulai gratis, upgrade kapan saja. Hemat hingga 20% dengan pembayaran tahunan.
            </p>

            {/* Billing Toggle */}
            <div className="mt-8 flex items-center justify-center gap-3">
              <span className={`text-sm ${!isYearly ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                Bulanan
              </span>
              <Switch
                checked={isYearly}
                onCheckedChange={setIsYearly}
              />
              <span className={`text-sm ${isYearly ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                Tahunan
              </span>
              {isYearly && (
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                  Hemat 20%
                </Badge>
              )}
            </div>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-3 gap-8">
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative rounded-xl border-2 p-8 transition-all ${
                    plan.popular
                      ? 'border-primary bg-card shadow-lg scale-105'
                      : 'border-border bg-card/50 hover:border-muted-foreground/50'
                  }`}
                >
                  {plan.popular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                      Direkomendasikan
                    </Badge>
                  )}

                  <div className="mb-6">
                    <h3 className="text-2xl font-bold">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                  </div>

                  <div className="mb-6">
                    {plan.monthlyPrice !== null ? (
                      <>
                        <span className="text-4xl font-bold">
                          Rp {formatPrice(isYearly ? Math.round(plan.yearlyPrice! / 12) : plan.monthlyPrice)}
                        </span>
                        <span className="text-muted-foreground">/bulan</span>
                        {isYearly && plan.yearlyPrice! > 0 && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Ditagih Rp {formatPrice(plan.yearlyPrice!)}/tahun
                          </p>
                        )}
                      </>
                    ) : (
                      <span className="text-4xl font-bold">Custom</span>
                    )}
                  </div>

                  <ul className="space-y-3 mb-8">
                    <li className="flex items-center gap-3 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                      {plan.features.sites}
                    </li>
                    <li className="flex items-center gap-3 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                      Hingga {plan.features.users}
                    </li>
                    <li className="flex items-center gap-3 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                      {plan.features.storage} storage
                    </li>
                    <li className="flex items-center gap-3 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                      Backup {plan.features.backup.toLowerCase()}
                    </li>
                    <li className="flex items-center gap-3 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                      Support {plan.features.support.toLowerCase()}
                    </li>
                    {plan.features.customDomain && (
                      <li className="flex items-center gap-3 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                        Custom domain
                      </li>
                    )}
                    {plan.features.api && (
                      <li className="flex items-center gap-3 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                        API access
                      </li>
                    )}
                  </ul>

                  <Link href={plan.monthlyPrice !== null ? "/daftar" : "/kontak"}>
                    <Button
                      className="w-full"
                      variant={plan.popular ? "default" : "outline"}
                    >
                      {plan.monthlyPrice === 0 ? "Mulai Gratis" : plan.monthlyPrice === null ? "Hubungi Sales" : "Pilih Paket"}
                      {plan.monthlyPrice !== null && <ArrowRight className="ml-2 h-4 w-4" />}
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Feature Comparison Table */}
        <section className="border-t border-border py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-center mb-12">
              Perbandingan Fitur Lengkap
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-4 px-4 font-medium text-muted-foreground">Fitur</th>
                    {plans.map((plan) => (
                      <th key={plan.name} className="text-center py-4 px-4 font-semibold">
                        {plan.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <TooltipProvider>
                    {featureComparison.map((feature) => (
                      <tr key={feature.key} className="border-b border-border hover:bg-muted/50">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{feature.name}</span>
                            <Tooltip>
                              <TooltipTrigger>
                                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{feature.tooltip}</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </td>
                        {plans.map((plan) => {
                          const value = plan.features[feature.key as keyof typeof plan.features]
                          return (
                            <td key={plan.name} className="text-center py-4 px-4">
                              {typeof value === 'boolean' ? (
                                value ? (
                                  <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                                ) : (
                                  <X className="h-5 w-5 text-muted-foreground mx-auto" />
                                )
                              ) : (
                                <span className="text-sm">{value}</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </TooltipProvider>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="border-t border-border py-16">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-center mb-12">
              Pertanyaan yang Sering Diajukan
            </h2>

            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, idx) => (
                <AccordionItem key={idx} value={`item-${idx}`}>
                  <AccordionTrigger className="text-left">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* CTA Section */}
        <section className="border-t border-border py-16 bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl font-bold mb-4">
              Masih Ragu? Coba Dulu Gratis!
            </h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Daftar sekarang dan dapatkan akses ke paket Starter gratis selamanya. Tidak perlu kartu kredit.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/daftar">
                <Button size="lg">
                  Mulai Gratis Sekarang
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/kontak">
                <Button variant="outline" size="lg">
                  Hubungi Sales
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
