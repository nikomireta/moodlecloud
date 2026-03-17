"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Cloud, Mail, ArrowLeft, CheckCircle2 } from "lucide-react"
import { api, isAPIError } from "@/lib/api"

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")

  const validateEmail = () => {
    if (!email) {
      setError("Email wajib diisi")
      return false
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Format email tidak valid")
      return false
    }
    setError("")
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateEmail()) return
    
    setIsLoading(true)
    setError("")

    try {
      await api.forgotPassword({ email: email.trim() })
      setIsSubmitted(true)
    } catch (error) {
      setError(isAPIError(error) ? error.message : "Gagal mengirim instruksi reset.")
    } finally {
      setIsLoading(false)
    }
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          {/* Logo */}
          <div className="text-center space-y-2">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-foreground">
                <Cloud className="h-6 w-6 text-background" />
              </div>
              <span className="text-xl font-semibold">Moodlepilot</span>
            </Link>
          </div>

          <Card className="border-border/50">
            <CardContent className="pt-6 pb-6 text-center space-y-4">
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                </div>
              </div>
              
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">Periksa email Anda</h2>
                <p className="text-muted-foreground text-sm">
                  Kami telah mengirim instruksi untuk mengatur ulang kata sandi ke{" "}
                  <span className="font-medium text-foreground">{email}</span>
                </p>
              </div>
              
              <div className="space-y-3 pt-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.open("https://mail.google.com", "_blank")}
                >
                  Buka Gmail
                </Button>
                
                <p className="text-xs text-muted-foreground">
                  Tidak menerima email?{" "}
                  <button
                    onClick={() => setIsSubmitted(false)}
                    className="text-foreground underline-offset-4 hover:underline"
                  >
                    Coba lagi
                  </button>
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="text-center">
            <Link
              href="/masuk"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke halaman masuk
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-foreground">
              <Cloud className="h-6 w-6 text-background" />
            </div>
            <span className="text-xl font-semibold">Moodlepilot</span>
          </Link>
        </div>

        <Card className="border-border/50">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl text-center">Lupa Kata Sandi?</CardTitle>
            <CardDescription className="text-center">
              Masukkan email Anda dan kami akan mengirimkan instruksi untuk mengatur ulang kata sandi
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="nama@perusahaan.com"
                    className={`pl-10 ${error ? 'border-destructive' : ''}`}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Mengirim...
                  </>
                ) : (
                  "Kirim Instruksi"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center">
          <Link
            href="/masuk"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke halaman masuk
          </Link>
        </div>
      </div>
    </div>
  )
}
