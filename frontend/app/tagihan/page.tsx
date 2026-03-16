'use client'

import { useState } from "react"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CreditCard, Download, Plus, AlertCircle, CheckCircle2, Clock, ArrowUpRight } from "lucide-react"
import Link from "next/link"

const currentPlan = {
  name: "Professional",
  price: 499000,
  period: "bulan",
  nextBilling: "10 April 2026",
  status: "active"
}

const usage = {
  sites: { used: 3, limit: 5 },
  users: { used: 456, limit: 1000 },
  storage: { used: 42.5, limit: 100, unit: "GB" },
  bandwidth: { used: 67.2, limit: 100, unit: "GB" }
}

const invoices = [
  {
    id: "INV-2026030001",
    date: "10 Mar 2026",
    amount: 553890,
    status: "paid"
  },
  {
    id: "INV-2026020001",
    date: "10 Feb 2026",
    amount: 553890,
    status: "paid"
  },
  {
    id: "INV-2026010001",
    date: "10 Jan 2026",
    amount: 553890,
    status: "paid"
  },
  {
    id: "INV-2025120001",
    date: "10 Des 2025",
    amount: 553890,
    status: "paid"
  }
]

const paymentMethods = [
  {
    id: "1",
    type: "card",
    name: "Visa",
    last4: "4242",
    expiry: "12/27",
    isDefault: true
  }
]

function formatPrice(price: number) {
  return new Intl.NumberFormat('id-ID').format(price)
}

export default function BillingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      
      <main className="flex-1 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold">Tagihan & Langganan</h1>
            <p className="text-muted-foreground mt-1">Kelola langganan dan riwayat pembayaran Anda</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-8">
              {/* Current Plan */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Paket Saat Ini</CardTitle>
                    <CardDescription>Detail langganan aktif Anda</CardDescription>
                  </div>
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                    Aktif
                  </Badge>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-2xl font-bold">{currentPlan.name}</h3>
                      <p className="text-muted-foreground">
                        Rp {formatPrice(currentPlan.price)}/{currentPlan.period}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Tagihan Berikutnya</p>
                      <p className="font-medium">{currentPlan.nextBilling}</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Link href="/harga">
                      <Button variant="outline">Ubah Paket</Button>
                    </Link>
                    <Button variant="outline" className="text-destructive hover:text-destructive">
                      Batalkan
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Usage */}
              <Card>
                <CardHeader>
                  <CardTitle>Penggunaan</CardTitle>
                  <CardDescription>Penggunaan resource bulan ini</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Situs Moodle</span>
                      <span>{usage.sites.used} / {usage.sites.limit}</span>
                    </div>
                    <Progress value={(usage.sites.used / usage.sites.limit) * 100} />
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Total Pengguna</span>
                      <span>{usage.users.used} / {usage.users.limit}</span>
                    </div>
                    <Progress value={(usage.users.used / usage.users.limit) * 100} />
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Storage</span>
                      <span>{usage.storage.used} / {usage.storage.limit} {usage.storage.unit}</span>
                    </div>
                    <Progress value={(usage.storage.used / usage.storage.limit) * 100} />
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Bandwidth</span>
                      <span>{usage.bandwidth.used} / {usage.bandwidth.limit} {usage.bandwidth.unit}</span>
                    </div>
                    <Progress value={(usage.bandwidth.used / usage.bandwidth.limit) * 100} />
                  </div>
                </CardContent>
              </Card>

              {/* Invoice History */}
              <Card>
                <CardHeader>
                  <CardTitle>Riwayat Invoice</CardTitle>
                  <CardDescription>Daftar invoice dan pembayaran</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Jumlah</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-mono text-sm">{invoice.id}</TableCell>
                          <TableCell>{invoice.date}</TableCell>
                          <TableCell>Rp {formatPrice(invoice.amount)}</TableCell>
                          <TableCell>
                            {invoice.status === 'paid' ? (
                              <Badge variant="outline" className="text-green-600 border-green-500/20">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Lunas
                              </Badge>
                            ) : invoice.status === 'pending' ? (
                              <Badge variant="outline" className="text-yellow-600 border-yellow-500/20">
                                <Clock className="h-3 w-3 mr-1" />
                                Pending
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-red-600 border-red-500/20">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Gagal
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm">
                              <Download className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-8">
              {/* Payment Methods */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Metode Pembayaran</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {paymentMethods.map((method) => (
                    <div
                      key={method.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border"
                    >
                      <div className="h-10 w-10 bg-muted rounded flex items-center justify-center">
                        <CreditCard className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {method.name} **** {method.last4}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Kadaluarsa {method.expiry}
                        </p>
                      </div>
                      {method.isDefault && (
                        <Badge variant="secondary" className="text-xs">Default</Badge>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Tambah Metode
                  </Button>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Aksi Cepat</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Link href="/harga">
                    <Button variant="ghost" className="w-full justify-between">
                      Upgrade Paket
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button variant="ghost" className="w-full justify-between">
                    Download Semua Invoice
                    <Download className="h-4 w-4" />
                  </Button>
                  <Link href="/dokumentasi">
                    <Button variant="ghost" className="w-full justify-between">
                      Bantuan Billing
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Support */}
              <Card className="bg-muted/30">
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-2">Butuh Bantuan?</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Tim billing kami siap membantu pertanyaan seputar pembayaran.
                  </p>
                  <Button variant="outline" className="w-full">
                    Hubungi Support
                  </Button>
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
