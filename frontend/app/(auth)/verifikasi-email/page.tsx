"use client"

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp"
import { Loader2, Cloud, Mail, RefreshCw, CheckCircle2 } from "lucide-react"
import { api, isAPIError } from "@/lib/api"

function VerificationContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get("email") || "email@example.com"
  
  const [otp, setOtp] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [error, setError] = useState("")

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  const handleVerify = async () => {
    if (otp.length !== 6) {
      setError("Masukkan kode 6 digit")
      return
    }
    
    setIsLoading(true)
    setError("")

    try {
      await api.verifyEmail({
        email: email.trim(),
        code: otp,
      })
      setIsVerified(true)
    } catch (error) {
      setError(isAPIError(error) ? error.message : "Verifikasi gagal. Silakan coba lagi.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    setError("")

    try {
      await api.resendVerification(email.trim())
      setResendCooldown(60)
    } catch (error) {
      setError(isAPIError(error) ? error.message : "Gagal mengirim ulang kode.")
    }
  }

  if (isVerified) {
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
                <h2 className="text-xl font-semibold">Email Terverifikasi!</h2>
                <p className="text-muted-foreground text-sm">
                  Akun Anda telah berhasil diverifikasi. Anda sekarang dapat masuk dan mulai membuat situs Moodle.
                </p>
              </div>
              
              <Link href="/masuk" className="block pt-2">
                <Button className="w-full">
                  Lanjut ke Halaman Masuk
                </Button>
              </Link>
            </CardContent>
          </Card>
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
          <CardContent className="pt-6 pb-6 space-y-6">
            <div className="text-center space-y-2">
              <div className="flex justify-center mb-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <Mail className="h-7 w-7 text-muted-foreground" />
                </div>
              </div>
              <h2 className="text-xl font-semibold">Verifikasi Email</h2>
              <p className="text-muted-foreground text-sm">
                Kami telah mengirim kode verifikasi ke{" "}
                <span className="font-medium text-foreground">{email}</span>
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={setOtp}
                  disabled={isLoading}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              
              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}

              <Button 
                className="w-full" 
                onClick={handleVerify}
                disabled={isLoading || otp.length !== 6}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Memverifikasi...
                  </>
                ) : (
                  "Verifikasi"
                )}
              </Button>
            </div>

            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Tidak menerima kode?
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResend}
                disabled={resendCooldown > 0}
                className="text-sm"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${resendCooldown > 0 ? '' : ''}`} />
                {resendCooldown > 0 
                  ? `Kirim ulang dalam ${resendCooldown}d`
                  : "Kirim ulang kode"
                }
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Salah email?{" "}
          <Link href="/daftar" className="underline underline-offset-4 hover:text-foreground">
            Kembali ke pendaftaran
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <VerificationContent />
    </Suspense>
  )
}
