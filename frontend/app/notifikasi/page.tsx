"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"

import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Bell,
  Check,
  CheckCheck,
  AlertTriangle,
  Info,
  AlertCircle,
  Server,
  Shield,
  Database,
  Clock,
  Trash2,
  Filter,
  Archive,
  XCircle,
  RefreshCw,
  ChevronRight,
} from "lucide-react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { api, isAPIError, type NotificationItem } from "@/lib/api"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const systemCategories = new Set([
  "deployment",
  "backup",
  "billing",
  "update",
  "system",
  "performance",
])

function isUnread(notification: NotificationItem) {
  return !notification.read_at
}

function getNotificationIcon(type: string) {
  switch (type) {
    case "success":
      return <Check className="h-4 w-4 text-green-500" />
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />
    case "error":
      return <XCircle className="h-4 w-4 text-red-500" />
    default:
      return <Info className="h-4 w-4 text-blue-500" />
  }
}

function getCategoryIcon(category: string) {
  switch (category) {
    case "deployment":
      return <Server className="h-4 w-4" />
    case "security":
      return <Shield className="h-4 w-4" />
    case "backup":
      return <Database className="h-4 w-4" />
    case "system":
    case "performance":
      return <AlertCircle className="h-4 w-4" />
    default:
      return <Bell className="h-4 w-4" />
  }
}

function getCategoryLabel(category: string) {
  switch (category) {
    case "deployment":
      return "deployment"
    case "security":
      return "security"
    case "backup":
      return "backup"
    case "billing":
      return "billing"
    case "update":
      return "update"
    case "performance":
      return "performance"
    default:
      return category
  }
}

function getActionLabel(notification: NotificationItem) {
  switch (notification.category) {
    case "deployment":
      return "Lihat Situs"
    case "backup":
      return "Lihat Backup"
    case "billing":
      return "Lihat Tagihan"
    case "security":
      return "Lihat Detail"
    case "update":
      return "Lihat Update"
    default:
      return "Lihat Detail"
  }
}

function formatTimestamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "Baru saja"
  }

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return "Baru saja"
  if (diffMins < 60) return `${diffMins} menit lalu`
  if (diffHours < 24) return `${diffHours} jam lalu`
  if (diffDays < 7) return `${diffDays} hari lalu`
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
}

export default function NotificationCenterPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [activeTab, setActiveTab] = useState("all")
  const [isRefreshing, setIsRefreshing] = useState(false)

  const notifyHeaderCountChanged = () => {
    window.dispatchEvent(new Event("notifications:changed"))
  }

  const refreshNotifications = async () => {
    setIsRefreshing(true)

    try {
      const response = await api.listNotifications()
      setNotifications(response.notifications)
      notifyHeaderCountChanged()
    } catch (error) {
      toast.error(isAPIError(error) ? error.message : "Gagal memuat notifikasi.")
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    void refreshNotifications()
  }, [])

  const unreadCount = notifications.filter(isUnread).length

  const filteredNotifications = notifications.filter((notification) => {
    if (activeTab === "all") return true
    if (activeTab === "unread") return isUnread(notification)
    if (activeTab === "security") return notification.category === "security"
    if (activeTab === "system") return systemCategories.has(notification.category)
    return notification.category === activeTab
  })

  const markAsRead = async (id: string) => {
    const previous = notifications
    const target = previous.find((notification) => notification.id === id)
    if (!target || !isUnread(target)) {
      return
    }

    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id
          ? { ...notification, read_at: new Date().toISOString() }
          : notification
      )
    )

    try {
      await api.markNotificationRead(id)
      notifyHeaderCountChanged()
    } catch (error) {
      setNotifications(previous)
      toast.error(isAPIError(error) ? error.message : "Gagal menandai notifikasi.")
    }
  }

  const markAllAsRead = async () => {
    if (unreadCount === 0) {
      return
    }

    const previous = notifications
    const now = new Date().toISOString()
    setNotifications((current) =>
      current.map((notification) =>
        isUnread(notification) ? { ...notification, read_at: now } : notification
      )
    )

    try {
      await api.markAllNotificationsRead()
      notifyHeaderCountChanged()
    } catch (error) {
      setNotifications(previous)
      toast.error(isAPIError(error) ? error.message : "Gagal menandai semua notifikasi.")
    }
  }

  const deleteNotification = async (id: string) => {
    const previous = notifications
    setNotifications((current) => current.filter((notification) => notification.id !== id))

    try {
      await api.deleteNotification(id)
      notifyHeaderCountChanged()
    } catch (error) {
      setNotifications(previous)
      toast.error(isAPIError(error) ? error.message : "Gagal menghapus notifikasi.")
    }
  }

  const archiveRead = async () => {
    const readNotifications = notifications.filter((notification) => !isUnread(notification))
    if (readNotifications.length === 0) {
      return
    }

    const previous = notifications
    setNotifications((current) => current.filter((notification) => isUnread(notification)))

    try {
      await Promise.all(readNotifications.map((notification) => api.deleteNotification(notification.id)))
      notifyHeaderCountChanged()
    } catch (error) {
      setNotifications(previous)
      toast.error(isAPIError(error) ? error.message : "Gagal mengarsipkan notifikasi.")
    }
  }

  const clearAll = async () => {
    if (notifications.length === 0) {
      return
    }

    const previous = notifications
    setNotifications([])

    try {
      await Promise.all(previous.map((notification) => api.deleteNotification(notification.id)))
      notifyHeaderCountChanged()
    } catch (error) {
      setNotifications(previous)
      toast.error(isAPIError(error) ? error.message : "Gagal menghapus semua notifikasi.")
    }
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background flex flex-col">
        <Header />

        <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight">Pusat Notifikasi</h1>
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="rounded-full">
                    {unreadCount} baru
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground">
                Kelola semua notifikasi penting Anda
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => void markAllAsRead()} disabled={unreadCount === 0}>
                <CheckCheck className="mr-2 h-4 w-4" />
                Tandai Semua Dibaca
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Filter className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Tindakan</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => void refreshNotifications()} disabled={isRefreshing}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void archiveRead()}>
                    <Archive className="mr-2 h-4 w-4" />
                    Arsipkan Dibaca
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => void clearAll()} className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Hapus Semua
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="all" className="text-xs sm:text-sm">
                        Semua
                        <Badge variant="secondary" className="ml-1.5 hidden sm:inline-flex">
                          {notifications.length}
                        </Badge>
                      </TabsTrigger>
                      <TabsTrigger value="unread" className="text-xs sm:text-sm">
                        Belum Dibaca
                        {unreadCount > 0 && (
                          <Badge variant="destructive" className="ml-1.5 hidden sm:inline-flex">
                            {unreadCount}
                          </Badge>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="security" className="text-xs sm:text-sm">
                        Keamanan
                      </TabsTrigger>
                      <TabsTrigger value="system" className="text-xs sm:text-sm">
                        Sistem
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[600px]">
                    {filteredNotifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                          <Bell className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="font-medium">Tidak ada notifikasi</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Anda akan melihat notifikasi baru di sini
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border">
                        {filteredNotifications.map((notification) => (
                          <div
                            key={notification.id}
                            className={`group relative p-4 hover:bg-muted/50 transition-colors ${
                              isUnread(notification) ? "bg-muted/30" : ""
                            }`}
                          >
                            <div className="flex gap-4">
                              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                                notification.type === "success" ? "bg-green-500/10" :
                                notification.type === "warning" ? "bg-yellow-500/10" :
                                notification.type === "error" ? "bg-red-500/10" :
                                "bg-blue-500/10"
                              }`}>
                                {getNotificationIcon(notification.type)}
                              </div>

                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <h4 className={`text-sm font-medium ${isUnread(notification) ? "text-foreground" : "text-muted-foreground"}`}>
                                      {notification.title}
                                    </h4>
                                    {isUnread(notification) && (
                                      <span className="flex h-2 w-2 rounded-full bg-blue-500" />
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {isUnread(notification) && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => void markAsRead(notification.id)}
                                      >
                                        <Check className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive hover:text-destructive"
                                      onClick={() => void deleteNotification(notification.id)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {notification.message}
                                </p>
                                <div className="flex items-center justify-between pt-1">
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    {getCategoryIcon(notification.category)}
                                    <span className="capitalize">{getCategoryLabel(notification.category)}</span>
                                    <span>·</span>
                                    <Clock className="h-3 w-3" />
                                    <span>{formatTimestamp(notification.created_at)}</span>
                                  </div>
                                  {notification.action_url && (
                                    <Link href={notification.action_url}>
                                      <Button variant="link" size="sm" className="h-auto p-0 text-xs">
                                        {getActionLabel(notification)}
                                        <ChevronRight className="ml-1 h-3 w-3" />
                                      </Button>
                                    </Link>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-base">Ringkasan</CardTitle>
                  <CardDescription>
                    Gambaran cepat kondisi notifikasi akun Anda
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total notifikasi</span>
                    <span className="font-medium">{notifications.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Belum dibaca</span>
                    <span className="font-medium">{unreadCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Peringatan aktif</span>
                    <span className="font-medium text-yellow-500">
                      {notifications.filter((notification) => notification.type === "warning" && isUnread(notification)).length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Error</span>
                    <span className="font-medium text-red-500">
                      {notifications.filter((notification) => notification.type === "error" && isUnread(notification)).length}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </ProtectedRoute>
  )
}
