'use client'

import { useState } from "react"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { CheckCircle2, CreditCard, Building2, Wallet, Shield, ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

const selectedPlan = {
  name: "Professional",
  price: 499000,
  period: "bulan",
  features: [
    "Hingga 5 situs Moodle",
    "1.000 pengguna per situs",
    "100 GB storage",
    "Backup harian",
    "Support prioritas"
  ]
}

const paymentMethods = [
  {
    id: "card",
    name: "Kartu Kredit/Debit",
    description: "Visa, Mastercard, JCB",
    icon: CreditCard
  },
  {
    id: "bank",
    name: "Transfer Bank",
    description: "BCA, Mandiri, BNI, BRI",
    icon: Building2
  },
  {
    id: "ewallet",
    name: "E-Wallet",
    description: "GoPay, OVO, DANA, ShopeePay",
    icon: Wallet
  }
]

function formatPrice(price: number) {
  return new Intl.NumberFormat('id-ID').format(price)
}

export default function CheckoutPage() {
  const router = useRouter()
  const [paymentMethod, setPaymentMethod] = useState("card")
  const [isProcessing, setIsProcessing] = useState(false)
  const [step, setStep] = useState<'info' | 'payment' | 'processing' | 'success'>('info')

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    organization: "",
    cardNumber: "",
    cardExpiry: "",
    cardCvv: "",
    cardName: ""
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const handleSubmit = async () => {
    setIsProcessing(true)
    setStep('processing')
    
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    setIsProcessing(false)
    setStep('success')
  }

  if (step === 'success') {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full text-center">
            <CardContent className="pt-8 pb-8">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Pembayaran Berhasil!</h1>
              <p className="text-muted-foreground mb-6">
                Terima kasih telah berlangganan paket {selectedPlan.name}. Akun Anda telah diaktifkan.
              </p>
              <div className="bg-muted/50 rounded-lg p-4 mb-6 text-left">
                <p className="text-sm text-muted-foreground mb-1">Nomor Invoice</p>
                <p className="font-mono font-medium">INV-2026031012345</p>
              </div>
              <div className="space-y-3">
                <Link href="/dashboard" className="block">
                  <Button className="w-full">Ke Dashboard</Button>
                </Link>
                <Link href="/buat-situs" className="block">
                  <Button variant="outline" className="w-full">Buat Situs Pertama</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    )
  }

  if (step === 'processing') {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full text-center">
            <CardContent className="pt-8 pb-8">
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-6 text-primary" />
              <h1 className="text-xl font-bold mb-2">Memproses Pembayaran...</h1>
              <p className="text-muted-foreground">
                Mohon tunggu, jangan tutup halaman ini
              </p>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      
      <main className="flex-1 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <Link href="/harga">
            <Button variant="ghost" size="sm" className="mb-6">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Kembali ke Harga
            </Button>
          </Link>

          <div className="grid lg:grid-cols-[1fr_400px] gap-8">
            {/* Checkout Form */}
            <div className="space-y-8">
              {/* Step 1: Personal Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">1</span>
                    Informasi Pelanggan
                  </CardTitle>
                  <CardDescription>Isi data diri Anda untuk melanjutkan</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Nama Lengkap</Label>
                      <Input
                        id="fullName"
                        name="fullName"
                        placeholder="John Doe"
                        value={formData.fullName}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="john@example.com"
                        value={formData.email}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Nomor Telepon</Label>
                      <Input
                        id="phone"
                        name="phone"
                        placeholder="08123456789"
                        value={formData.phone}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="organization">Nama Institusi (Opsional)</Label>
                      <Input
                        id="organization"
                        name="organization"
                        placeholder="Nama sekolah atau organisasi"
                        value={formData.organization}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Step 2: Payment Method */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">2</span>
                    Metode Pembayaran
                  </CardTitle>
                  <CardDescription>Pilih metode pembayaran yang Anda inginkan</CardDescription>
                </CardHeader>
                <CardContent>
                  <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-3">
                    {paymentMethods.map((method) => {
                      const Icon = method.icon
                      return (
                        <div key={method.id}>
                          <RadioGroupItem
                            value={method.id}
                            id={method.id}
                            className="peer sr-only"
                          />
                          <Label
                            htmlFor={method.id}
                            className="flex items-center gap-4 rounded-lg border-2 border-border p-4 cursor-pointer hover:bg-muted/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 transition-colors"
                          >
                            <Icon className="h-5 w-5 text-muted-foreground" />
                            <div className="flex-1">
                              <p className="font-medium">{method.name}</p>
                              <p className="text-sm text-muted-foreground">{method.description}</p>
                            </div>
                          </Label>
                        </div>
                      )
                    })}
                  </RadioGroup>

                  {/* Card Details */}
                  {paymentMethod === 'card' && (
                    <div className="mt-6 space-y-4 pt-6 border-t border-border">
                      <div className="space-y-2">
                        <Label htmlFor="cardNumber">Nomor Kartu</Label>
                        <Input
                          id="cardNumber"
                          name="cardNumber"
                          placeholder="1234 5678 9012 3456"
                          value={formData.cardNumber}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="cardExpiry">Tanggal Kadaluarsa</Label>
                          <Input
                            id="cardExpiry"
                            name="cardExpiry"
                            placeholder="MM/YY"
                            value={formData.cardExpiry}
                            onChange={handleInputChange}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cardCvv">CVV</Label>
                          <Input
                            id="cardCvv"
                            name="cardCvv"
                            placeholder="123"
                            value={formData.cardCvv}
                            onChange={handleInputChange}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cardName">Nama di Kartu</Label>
                        <Input
                          id="cardName"
                          name="cardName"
                          placeholder="JOHN DOE"
                          value={formData.cardName}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'bank' && (
                    <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        Setelah checkout, Anda akan menerima instruksi transfer bank melalui email.
                      </p>
                    </div>
                  )}

                  {paymentMethod === 'ewallet' && (
                    <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        Anda akan diarahkan ke halaman pembayaran e-wallet setelah checkout.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Security Note */}
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Shield className="h-5 w-5" />
                <p>Pembayaran Anda dilindungi dengan enkripsi SSL 256-bit</p>
              </div>
            </div>

            {/* Order Summary */}
            <div>
              <Card className="sticky top-8">
                <CardHeader>
                  <CardTitle>Ringkasan Pesanan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{selectedPlan.name}</h3>
                      <Badge>Bulanan</Badge>
                    </div>
                    <ul className="space-y-2">
                      {selectedPlan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>Rp {formatPrice(selectedPlan.price)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">PPN (11%)</span>
                      <span>Rp {formatPrice(Math.round(selectedPlan.price * 0.11))}</span>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex justify-between font-semibold text-lg">
                    <span>Total</span>
                    <span>Rp {formatPrice(Math.round(selectedPlan.price * 1.11))}</span>
                  </div>

                  <Button className="w-full" size="lg" onClick={handleSubmit} disabled={isProcessing}>
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Memproses...
                      </>
                    ) : (
                      "Bayar Sekarang"
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    Dengan melanjutkan, Anda menyetujui{" "}
                    <Link href="/syarat-ketentuan" className="underline">Syarat & Ketentuan</Link>
                    {" "}dan{" "}
                    <Link href="/kebijakan-privasi" className="underline">Kebijakan Privasi</Link>
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
