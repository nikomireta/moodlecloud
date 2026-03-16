"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Check,
  ExternalLink,
  Copy,
  Mail,
  Key,
  Globe,
  Shield,
  ArrowRight,
  BookOpen,
  Users,
  Settings,
} from "lucide-react"
import Link from "next/link"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { api } from "@/lib/api"
import { buildAdminURL, buildSiteURL } from "@/lib/site-url"

export default function SitusBerhasilPage({
  params,
}: {
  params: Promise<{ subdomain: string }>
}) {
  const { subdomain } = use(params)
  const router = useRouter()
  const [copied, setCopied] = useState<string | null>(null)
  const [siteUrl, setSiteUrl] = useState(buildSiteURL(subdomain))
  const [adminUrl, setAdminUrl] = useState(buildAdminURL(subdomain))
  const [adminUsername, setAdminUsername] = useState("admin")

  useEffect(() => {
    let cancelled = false

    async function loadSite() {
      try {
        const response = await api.getSiteBySubdomain(subdomain)
        if (cancelled) {
          return
        }

        if (response.site.status !== "active") {
          router.replace(`/proses-pembuatan/${subdomain}`)
          return
        }

        setSiteUrl(response.site.site_url)
        setAdminUrl(response.site.admin_url)
        setAdminUsername(response.site.moodle_username || "admin")
      } catch (error) {
        console.error("failed to load site success data", error)
      }
    }

    void loadSite()

    return () => {
      cancelled = true
    }
  }, [router, subdomain])

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen flex-col bg-background">
        <Header />

        <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Success Header */}
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
              <Check className="h-8 w-8 text-success" />
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
              Situs Moodle Berhasil Dibuat!
            </h1>
            <p className="mt-2 text-muted-foreground">
              Situs Anda sudah aktif dan siap digunakan
            </p>
          </div>

          {/* Site URL Card */}
          <Card className="mt-8 border-border">
            <CardContent className="p-6">
              <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">URL Situs Anda</p>
                    <p className="font-medium">{siteUrl}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(siteUrl, "url")}
                  >
                    {copied === "url" ? (
                      <Check className="mr-2 h-4 w-4" />
                    ) : (
                      <Copy className="mr-2 h-4 w-4" />
                    )}
                    {copied === "url" ? "Tersalin" : "Salin"}
                  </Button>
                  <Link href={siteUrl} target="_blank">
                    <Button size="sm">
                      Buka Situs
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Credentials Card */}
          <Card className="mt-4 border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Key className="h-5 w-5" />
                Kredensial Administrator
              </CardTitle>
              <CardDescription>
                Detail akses aman telah dikirim ke email administrator Anda.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">URL Admin Panel</p>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="text-sm font-medium break-all">{adminUrl}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => copyToClipboard(adminUrl, "admin-url")}
                      >
                        {copied === "admin-url" ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Username</p>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="text-sm font-medium">{adminUsername}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(adminUsername, "username")}
                      >
                        {copied === "username" ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-warning/50 bg-warning/10 p-3">
                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Penting:</strong> Password awal tidak
                  ditampilkan di halaman ini. Gunakan detail yang dikirim ke email administrator
                  untuk login pertama kali dan segera ubah password setelah masuk.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Email Notification */}
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-card p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Mail className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Email Konfirmasi Terkirim</p>
              <p className="text-xs text-muted-foreground">
                Kami telah mengirimkan detail lengkap ke email administrator Anda
              </p>
            </div>
          </div>

          {/* Next Steps */}
          <Card className="mt-8 border-border">
            <CardHeader>
              <CardTitle className="text-lg">Langkah Selanjutnya</CardTitle>
              <CardDescription>
                Panduan untuk memulai dengan situs Moodle baru Anda
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Link
                href={adminUrl}
                target="_blank"
                className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Konfigurasi Situs</p>
                    <p className="text-xs text-muted-foreground">
                      Sesuaikan pengaturan dasar dan tampilan
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>

              <Link
                href="/"
                className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Tambah Pengguna</p>
                    <p className="text-xs text-muted-foreground">
                      Undang guru dan siswa ke platform
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>

              <Link
                href="/"
                className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Buat Kursus Pertama</p>
                    <p className="text-xs text-muted-foreground">
                      Mulai membuat konten pembelajaran
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/" className="flex-1">
              <Button variant="outline" className="w-full">
                Kembali ke Dashboard
              </Button>
            </Link>
            <Link href="/buat-situs" className="flex-1">
              <Button className="w-full">
                Buat Situs Lainnya
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {/* Support */}
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              Butuh bantuan? Hubungi{" "}
              <Link href="/" className="text-foreground underline underline-offset-4 hover:no-underline">
                tim dukungan kami
              </Link>
            </p>
          </div>
        </div>
        </main>

        <Footer />
      </div>
    </ProtectedRoute>
  )
}
