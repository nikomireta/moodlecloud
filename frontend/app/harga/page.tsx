'use client'

import { useState } from "react"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, ArrowRight } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/components/providers/auth-provider"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  formatPrice,
  getGroupStartingPlan,
  pricingFaqs,
  pricingPlanGroups,
  pricingSiteNote,
} from "@/lib/pricing"

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false)
  const { status } = useAuth()
  const isLoggedIn = status === "authenticated"

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        <section className="border-b border-border bg-gradient-to-b from-muted/50 to-background">
          <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 lg:px-8">
            <Badge variant="outline" className="mb-4">
              Harga Moodlepilot
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Pilih paket yang sesuai kapasitas institusi Anda
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Langsung pilih kapasitas pengguna dan storage yang dibutuhkan sekarang, lalu upgrade saat kebutuhan bertambah.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <span className={`text-sm ${!isYearly ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                Bulanan
              </span>
              <Switch checked={isYearly} onCheckedChange={setIsYearly} />
              <span className={`text-sm ${isYearly ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                Tahunan
              </span>
              {isYearly && (
                <Badge className="border-green-500/20 bg-green-500/10 text-green-600">
                  Hemat 20%
                </Badge>
              )}
            </div>

            <p className="mx-auto mt-5 max-w-2xl text-sm text-muted-foreground">
              {pricingSiteNote}
            </p>
          </div>
        </section>

        <section id="paket" className="py-12 sm:py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="space-y-12">
              {pricingPlanGroups.map((group) => (
                <section key={group.id}>
                  <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-2xl font-bold tracking-tight">{group.name}</h2>
                        {group.popular ? <Badge>Populer</Badge> : null}
                      </div>
                      <p className="mt-2 max-w-2xl text-muted-foreground">{group.description}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {group.summaryFeatures.map((feature) => (
                          <Badge key={feature} variant="secondary" className="font-normal">
                            {feature}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl border border-border bg-card px-4 py-3 lg:min-w-52">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Mulai dari</p>
                      <p className="mt-1 text-xl font-bold">Rp {formatPrice(getGroupStartingPlan(group).monthlyPrice)}/bulan</p>
                    </div>
                  </div>

                  <div
                    className={`grid gap-6 ${
                      group.plans.length === 4
                        ? "md:grid-cols-2 xl:grid-cols-4"
                        : "md:grid-cols-2 xl:grid-cols-3"
                    }`}
                  >
                    {group.plans.map((plan) => {
                      const displayPrice = isYearly ? plan.yearlyPrice : plan.monthlyPrice
                      const equivalentMonthly = Math.round(plan.yearlyPrice / 12)

                      return (
                        <div
                          key={plan.code}
                          className={`relative rounded-xl border p-5 transition-all ${
                            plan.recommended
                              ? "border-primary bg-card shadow-lg"
                              : "border-border bg-card/50 hover:border-muted-foreground/50"
                          }`}
                        >
                          {plan.recommended && (
                            <Badge className="absolute -top-3 left-5 bg-primary text-primary-foreground">
                              Direkomendasikan
                            </Badge>
                          )}

                          <div className="mb-4">
                            <h3 className="text-xl font-bold">{plan.label}</h3>
                            <p className="mt-1 text-sm text-muted-foreground">{plan.groupLabel}</p>
                          </div>

                          <div className="mb-4 rounded-xl bg-muted/40 p-4">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                              {isYearly ? "Komitmen tahunan" : "Tagihan bulanan"}
                            </p>
                            <span className="text-3xl font-bold">
                              Rp {formatPrice(displayPrice)}
                            </span>
                            <span className="text-muted-foreground">/{isYearly ? "tahun" : "bulan"}</span>
                            {isYearly && (
                              <p className="mt-1 text-sm text-muted-foreground">
                                Setara Rp {formatPrice(equivalentMonthly)}/bulan
                              </p>
                            )}
                          </div>

                          <div className="mb-4 space-y-1.5 text-sm">
                            <p className="font-medium">{plan.usersLabel}</p>
                            <p className="text-muted-foreground">{plan.storageLabel} storage</p>
                          </div>

                          <ul className="mb-5 space-y-2.5">
                            {plan.highlights.map((highlight) => (
                              <li key={highlight} className="flex items-center gap-3 text-sm">
                                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-500" />
                                {highlight}
                              </li>
                            ))}
                          </ul>

                          <Link href={isLoggedIn ? "/buat-situs" : "/daftar"}>
                            <Button className="w-full" variant={plan.recommended ? "default" : "outline"}>
                              Pilih Paket
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border py-16">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <Badge variant="outline" className="mb-4">
              FAQ
            </Badge>
            <h2 className="mb-12 text-center text-2xl font-bold">
              Pertanyaan yang Sering Diajukan
            </h2>

            <Accordion type="single" collapsible className="w-full">
              {pricingFaqs.map((faq, idx) => (
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

        <section className="border-t border-border bg-muted/30 py-12">
          <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="mb-4 text-2xl font-bold">
              Sudah tahu paket yang dibutuhkan?
            </h2>
            <p className="mx-auto mb-8 max-w-xl text-muted-foreground">
              Pilih paket yang paling mendekati kebutuhan Anda sekarang, lalu lanjutkan ke pembuatan site. Jika masih ragu,
              dokumentasi dan panduan tetap bisa dipakai untuk membantu keputusan awal.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Link href={isLoggedIn ? "/buat-situs" : "/daftar"}>
                <Button size="lg">
                  Mulai Pilih Paket
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
