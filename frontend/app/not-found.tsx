"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Home, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"

export default function NotFound() {
  const router = useRouter()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mx-auto max-w-md text-center">
        {/* Logo */}
        <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-foreground">
          <span className="text-3xl font-bold text-background">M</span>
        </div>
        
        {/* Error Code */}
        <h1 className="text-8xl font-bold tracking-tighter text-foreground">404</h1>
        
        {/* Message */}
        <h2 className="mt-4 text-xl font-semibold tracking-tight">
          Halaman Tidak Ditemukan
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Maaf, halaman yang Anda cari tidak ada atau telah dipindahkan.
        </p>
        
        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/">
            <Button className="w-full sm:w-auto">
              <Home className="mr-2 h-4 w-4" />
              Kembali ke Beranda
            </Button>
          </Link>
          <Button 
            variant="outline" 
            onClick={() => router.back()}
            className="w-full sm:w-auto"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Halaman Sebelumnya
          </Button>
        </div>
        
        {/* Help Links */}
        <div className="mt-12 border-t border-border pt-8">
          <p className="text-sm text-muted-foreground">
            Butuh bantuan? Kunjungi{" "}
            <Link href="/dokumentasi" className="text-foreground underline underline-offset-4 hover:text-foreground/80">
              Pusat Bantuan
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
