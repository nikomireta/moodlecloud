'use client'

import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sparkles } from "lucide-react"

export default function AICourseGeneratorPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Page Header */}
          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm mb-4">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Didukung oleh AI</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              AI Course Generator
            </h1>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
              Buat struktur kursus Moodle lengkap dalam hitungan detik dengan kekuatan AI. 
              Cukup masukkan topik dan preferensi Anda, AI akan menghasilkan kursus yang terstruktur.
            </p>
          </div>

          {/* Coming Soon Section */}
          <div className="mt-8">
            <Card className="p-12 text-center h-[400px] flex flex-col items-center justify-center border-dashed">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <Sparkles className="h-10 w-10 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold mb-3">Fitur Sedang Dikembangkan!</h2>
              <p className="text-muted-foreground max-w-lg mx-auto mb-6">
                Fitur AI Course Generator kami sedang dalam tahap pengerjaan untuk memastikan pengalaman yang mulus. Nantinya Anda akan bisa membuat modul pembelajaran lengkap secara otomatis. Pantau terus ya!
              </p>
              <Badge variant="secondary" className="px-4 py-1.5 text-sm uppercase tracking-widest">
                Coming Soon
              </Badge>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
