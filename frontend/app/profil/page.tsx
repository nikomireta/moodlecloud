"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { useAuth } from "@/components/providers/auth-provider"
import { api, isAPIError, type NotificationPreferences, type SessionInfo } from "@/lib/api"
import {
  User,
  Mail,
  Lock,
  Bell,
  Shield,
  Smartphone,
  Globe,
  CreditCard,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react"

const prototypeProfile = {
  avatar: "",
  planExpiry: "10 Januari 2025",
  twoFactorEnabled: true,
}

const defaultNotificationPreferences: NotificationPreferences = {
  email: {
    deployment: true,
    backup: true,
    security: true,
    billing: true,
    updates: false,
    performance: true,
  },
  push: {
    deployment: true,
    backup: false,
    security: true,
    billing: true,
    updates: false,
    performance: false,
  },
}

const notificationItems = [
  { key: "deployment", title: "Status Situs", desc: "Notifikasi ketika situs online/offline" },
  { key: "backup", title: "Backup Selesai", desc: "Notifikasi ketika backup berhasil dibuat" },
  { key: "updates", title: "Update Tersedia", desc: "Notifikasi ketika ada update Moodle" },
  { key: "security", title: "Peringatan Keamanan", desc: "Notifikasi untuk masalah keamanan" },
  { key: "billing", title: "Tagihan & Pembayaran", desc: "Notifikasi terkait pembayaran" },
] as const

function inferBrowser(userAgent: string) {
  if (userAgent.includes("Edg/")) return "Edge"
  if (userAgent.includes("Chrome/")) return "Chrome"
  if (userAgent.includes("Firefox/")) return "Firefox"
  if (userAgent.includes("Safari/") && !userAgent.includes("Chrome/")) return "Safari"
  return "Browser"
}

function inferDevice(userAgent: string) {
  if (userAgent.includes("Windows")) return "Windows"
  if (userAgent.includes("Mac OS X") && userAgent.includes("Mobile")) return "iPhone"
  if (userAgent.includes("Android")) return "Android"
  if (userAgent.includes("Mac OS X")) return "macOS"
  if (userAgent.includes("Linux")) return "Linux"
  return "Perangkat"
}

function formatSessionDevice(session: SessionInfo) {
  return `${inferBrowser(session.user_agent)} di ${inferDevice(session.user_agent)}`
}

function formatSessionLocation(session: SessionInfo) {
  const ipAddress = session.ip_address.trim()
  if (!ipAddress || ipAddress === "::1" || ipAddress === "127.0.0.1") {
    return "Lokal"
  }
  return `IP ${ipAddress}`
}

function formatRelativeTime(value: string) {
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return "Baru saja"

  const diffMs = Date.now() - time
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMinutes < 1) return "Baru saja"
  if (diffMinutes < 60) return `${diffMinutes} menit lalu`
  if (diffHours < 24) return `${diffHours} jam lalu`
  if (diffDays < 30) return `${diffDays} hari lalu`

  return new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function resolveCurrentSessionID(sessions: SessionInfo[], currentSessionID?: string | null) {
  if (currentSessionID) {
    return currentSessionID
  }
  if (sessions.length === 1) {
    return sessions[0].id
  }
  return null
}

export default function ProfilePage() {
  const { user, refresh } = useAuth()

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [organization, setOrganization] = useState("")
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(prototypeProfile.twoFactorEnabled)
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(defaultNotificationPreferences)
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [currentSessionID, setCurrentSessionID] = useState<string | null>(null)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
  const [isUpdatingNotifications, setIsUpdatingNotifications] = useState(false)
  const [pendingSessionID, setPendingSessionID] = useState<string | null>(null)
  const [isSigningOutAll, setIsSigningOutAll] = useState(false)

  useEffect(() => {
    if (!user) return

    setName(user.name)
    setEmail(user.email)
    setPhone(user.phone)
    setOrganization(user.organization)
  }, [user])

  useEffect(() => {
    if (!user) return

    let active = true

    const loadProfileMeta = async () => {
      try {
        const [sessionsResponse, preferencesResponse] = await Promise.all([
          api.listSessions(),
          api.getNotificationPreferences(),
        ])

        if (!active) return

        setSessions(sessionsResponse.sessions)
        setCurrentSessionID(resolveCurrentSessionID(sessionsResponse.sessions, sessionsResponse.current_session_id))
        setNotificationPreferences(preferencesResponse.preferences)
      } catch (error) {
        if (!active) return
        console.error("failed to load profile metadata", error)
      }
    }

    void loadProfileMeta()

    return () => {
      active = false
    }
  }, [user])

  const handleSave = async () => {
    if (!user) return

    setIsSaving(true)

    try {
      const response = await api.updateMe({
        name: name.trim(),
        company: user.company,
        organization: organization.trim(),
        phone: phone.trim(),
      })
      await refresh()
      setName(response.user.name)
      setEmail(response.user.email)
      setPhone(response.user.phone)
      setOrganization(response.user.organization)
      toast.success(response.message)
    } catch (error) {
      toast.error(isAPIError(error) ? error.message : "Gagal menyimpan profil.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Semua field kata sandi wajib diisi.")
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error("Konfirmasi kata sandi tidak cocok.")
      return
    }

    setIsUpdatingPassword(true)

    try {
      const response = await api.updatePassword({
        currentPassword,
        newPassword,
      })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      toast.success(response.message)
    } catch (error) {
      toast.error(isAPIError(error) ? error.message : "Gagal memperbarui kata sandi.")
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  const updatePreferences = async (nextPreferences: NotificationPreferences) => {
    setNotificationPreferences(nextPreferences)
    setIsUpdatingNotifications(true)

    try {
      const response = await api.updateNotificationPreferences(nextPreferences)
      setNotificationPreferences(response.preferences)
    } catch (error) {
      toast.error(isAPIError(error) ? error.message : "Gagal memperbarui preferensi notifikasi.")
      throw error
    } finally {
      setIsUpdatingNotifications(false)
    }
  }

  const handleToggleNotificationChannel = async (channel: "email" | "push", checked: boolean) => {
    const previousPreferences = notificationPreferences
    const currentChannel = notificationPreferences[channel]
    const nextChannel = Object.keys(currentChannel).reduce<Record<string, boolean>>((accumulator, key) => {
      accumulator[key] = checked
      return accumulator
    }, {})
    const nextPreferences = {
      ...notificationPreferences,
      [channel]: nextChannel,
    }

    try {
      await updatePreferences(nextPreferences)
    } catch {
      setNotificationPreferences(previousPreferences)
    }
  }

  const handleToggleNotificationItem = async (key: string, checked: boolean) => {
    const previousPreferences = notificationPreferences
    const nextPreferences = {
      email: {
        ...notificationPreferences.email,
        [key]: checked,
      },
      push: {
        ...notificationPreferences.push,
        [key]: checked,
      },
    }

    try {
      await updatePreferences(nextPreferences)
    } catch {
      setNotificationPreferences(previousPreferences)
    }
  }

  const handleDeleteSession = async (sessionID: string) => {
    setPendingSessionID(sessionID)

    try {
      await api.deleteSession(sessionID)
      const sessionsResponse = await api.listSessions()
      setSessions(sessionsResponse.sessions)
      setCurrentSessionID(resolveCurrentSessionID(sessionsResponse.sessions, sessionsResponse.current_session_id))
    } catch (error) {
      toast.error(isAPIError(error) ? error.message : "Gagal mengakhiri sesi.")
    } finally {
      setPendingSessionID(null)
    }
  }

  const handleDeleteAllOtherSessions = async () => {
    const otherSessions = sessions.filter((session) => session.id !== currentSessionID)
    if (otherSessions.length === 0) {
      return
    }

    setIsSigningOutAll(true)

    try {
      await Promise.all(otherSessions.map((session) => api.deleteSession(session.id)))
      const sessionsResponse = await api.listSessions()
      setSessions(sessionsResponse.sessions)
      setCurrentSessionID(resolveCurrentSessionID(sessionsResponse.sessions, sessionsResponse.current_session_id))
    } catch (error) {
      toast.error(isAPIError(error) ? error.message : "Gagal mengakhiri sesi perangkat lain.")
    } finally {
      setIsSigningOutAll(false)
    }
  }

  const emailNotifications = Object.values(notificationPreferences.email).some(Boolean)
  const browserNotifications = Object.values(notificationPreferences.push).some(Boolean)
  const displayName = user?.name ?? name ?? "Pengguna"

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen flex-col bg-background">
        <Header />

        <main className="flex-1">
          <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-2xl font-semibold tracking-tight">Profil Saya</h1>
              <p className="text-muted-foreground">
                Kelola informasi akun dan pengaturan keamanan Anda
              </p>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="profile" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
                <TabsTrigger value="profile">Profil</TabsTrigger>
                <TabsTrigger value="security">Keamanan</TabsTrigger>
                <TabsTrigger value="notifications">Notifikasi</TabsTrigger>
              </TabsList>

              {/* Tab: Profile */}
              <TabsContent value="profile" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Informasi Profil</CardTitle>
                    <CardDescription>Perbarui informasi profil publik Anda</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Avatar */}
                    <div className="flex items-center gap-4">
                      <Avatar className="h-20 w-20">
                        <AvatarImage src={prototypeProfile.avatar} alt={displayName} />
                        <AvatarFallback className="text-lg bg-muted">
                          {displayName.split(" ").map((part) => part[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-2">
                        <Button variant="outline" size="sm">
                          Unggah Foto
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          JPG, PNG atau GIF. Maksimal 2MB.
                        </p>
                      </div>
                    </div>

                    {/* Form Fields */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nama Lengkap</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="email"
                            type="email"
                            value={email}
                            readOnly
                            className="pl-9"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Nomor Telepon</Label>
                        <div className="relative">
                          <Smartphone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="phone"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="organization">Organisasi</Label>
                        <div className="relative">
                          <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="organization"
                            value={organization}
                            onChange={(e) => setOrganization(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button onClick={() => void handleSave()} disabled={isSaving}>
                        {isSaving ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Menyimpan...
                          </>
                        ) : (
                          "Simpan Perubahan"
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Paket Langganan
                    </CardTitle>
                    <CardDescription>Informasi paket langganan Anda saat ini</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between rounded-lg border border-border p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-foreground text-background font-bold">
                          PRO
                        </div>
                        <div>
                          <p className="font-medium">Paket Pro</p>
                          <p className="text-sm text-muted-foreground">
                            Berlaku hingga {prototypeProfile.planExpiry}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm">Kelola</Button>
                        <Button size="sm">Upgrade</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab: Security */}
              <TabsContent value="security" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Lock className="h-5 w-5" />
                      Ubah Kata Sandi
                    </CardTitle>
                    <CardDescription>Perbarui kata sandi untuk keamanan akun</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="current-password">Kata Sandi Saat Ini</Label>
                      <div className="relative">
                        <Input
                          id="current-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Masukkan kata sandi saat ini"
                          value={currentPassword}
                          onChange={(event) => setCurrentPassword(event.target.value)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="new-password">Kata Sandi Baru</Label>
                        <Input
                          id="new-password"
                          type="password"
                          placeholder="Masukkan kata sandi baru"
                          value={newPassword}
                          onChange={(event) => setNewPassword(event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirm-password">Konfirmasi Kata Sandi</Label>
                        <Input
                          id="confirm-password"
                          type="password"
                          placeholder="Konfirmasi kata sandi baru"
                          value={confirmPassword}
                          onChange={(event) => setConfirmPassword(event.target.value)}
                        />
                      </div>
                    </div>
                    <Button onClick={() => void handleUpdatePassword()} disabled={isUpdatingPassword}>
                      {isUpdatingPassword ? "Menyimpan..." : "Ubah Kata Sandi"}
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Autentikasi Dua Faktor
                    </CardTitle>
                    <CardDescription>Tambahkan lapisan keamanan ekstra untuk akun Anda</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${twoFactorEnabled ? "bg-success/10" : "bg-muted"}`}>
                          <Shield className={`h-5 w-5 ${twoFactorEnabled ? "text-success" : "text-muted-foreground"}`} />
                        </div>
                        <div>
                          <p className="font-medium">Autentikasi 2FA</p>
                          <p className="text-sm text-muted-foreground">
                            {twoFactorEnabled ? "Aktif - menggunakan aplikasi authenticator" : "Tidak aktif"}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={twoFactorEnabled}
                        onCheckedChange={setTwoFactorEnabled}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Sesi Aktif</CardTitle>
                    <CardDescription>Perangkat yang saat ini masuk ke akun Anda</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {sessions.map((session) => {
                        const isCurrent = session.id === currentSessionID

                        return (
                          <div key={session.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                                <Globe className="h-5 w-5 text-muted-foreground" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium">{formatSessionDevice(session)}</p>
                                  {isCurrent && (
                                    <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
                                      Saat ini
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {formatSessionLocation(session)} · {isCurrent ? "Saat ini" : formatRelativeTime(session.last_seen_at)}
                                </p>
                              </div>
                            </div>
                            {!isCurrent && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                disabled={pendingSessionID === session.id}
                                onClick={() => void handleDeleteSession(session.id)}
                              >
                                {pendingSessionID === session.id ? "Memproses..." : "Keluar"}
                              </Button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <Button
                      variant="outline"
                      className="mt-4 w-full"
                      disabled={isSigningOutAll || sessions.filter((session) => session.id !== currentSessionID).length === 0}
                      onClick={() => void handleDeleteAllOtherSessions()}
                    >
                      {isSigningOutAll ? "Memproses..." : "Keluar dari Semua Perangkat"}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab: Notifications */}
              <TabsContent value="notifications" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Bell className="h-5 w-5" />
                      Preferensi Notifikasi
                    </CardTitle>
                    <CardDescription>Atur bagaimana Anda ingin menerima notifikasi</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Notifikasi Email</p>
                        <p className="text-sm text-muted-foreground">
                          Terima pembaruan penting melalui email
                        </p>
                      </div>
                      <Switch
                        checked={emailNotifications}
                        disabled={isUpdatingNotifications}
                        onCheckedChange={(checked) => void handleToggleNotificationChannel("email", checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Notifikasi Browser</p>
                        <p className="text-sm text-muted-foreground">
                          Tampilkan notifikasi di browser
                        </p>
                      </div>
                      <Switch
                        checked={browserNotifications}
                        disabled={isUpdatingNotifications}
                        onCheckedChange={(checked) => void handleToggleNotificationChannel("push", checked)}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Jenis Notifikasi</CardTitle>
                    <CardDescription>Pilih notifikasi yang ingin Anda terima</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {notificationItems.map((item) => (
                      <div key={item.key} className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                        <Switch
                          checked={
                            (notificationPreferences.email[item.key] ?? false) ||
                            (notificationPreferences.push[item.key] ?? false)
                          }
                          disabled={isUpdatingNotifications}
                          onCheckedChange={(checked) => void handleToggleNotificationItem(item.key, checked)}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

            </Tabs>
          </div>
        </main>

        <Footer />
      </div>
    </ProtectedRoute>
  )
}
