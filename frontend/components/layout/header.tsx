"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Menu, User, LogOut, Settings, LayoutDashboard, HelpCircle, Bell, Sparkles,
  Check, AlertTriangle, XCircle, Info, Database, Server, Shield, AlertCircle, Clock
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { useAuth } from "@/components/providers/auth-provider"
import { api, type NotificationItem } from "@/lib/api"

function isUnread(notification: NotificationItem) {
  return !notification.read_at
}

function getNotificationIcon(type: string) {
  switch (type) {
    case "success": return <Check className="h-4 w-4 text-green-500" />
    case "warning": return <AlertTriangle className="h-4 w-4 text-yellow-500" />
    case "error": return <XCircle className="h-4 w-4 text-red-500" />
    default: return <Info className="h-4 w-4 text-blue-500" />
  }
}

function formatTimestamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Baru saja"

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return "Baru saja"
  if (diffMins < 60) return `${diffMins} m`
  if (diffHours < 24) return `${diffHours} j`
  if (diffDays < 7) return `${diffDays} h`
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" })
}

export function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const { status, user, logout } = useAuth()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const isLoggedIn = status === "authenticated"
  const unreadNotificationCount = useMemo(() => notifications.filter(isUnread).length, [notifications])

  const handleLogout = async () => {
    await logout()
    router.push("/masuk")
  }

  useEffect(() => {
    if (!isLoggedIn) {
      setNotifications([])
      return
    }

    let active = true

    const refreshNotificationCount = async () => {
      try {
        const response = await api.listNotifications()
        if (!active) return
        setNotifications(response.notifications)
      } catch (error) {
        if (!active) return
        console.error("failed to load notification count", error)
      }
    }

    const handleNotificationsChanged = () => {
      void refreshNotificationCount()
    }

    void refreshNotificationCount()
    window.addEventListener("notifications:changed", handleNotificationsChanged)

    return () => {
      active = false
      window.removeEventListener("notifications:changed", handleNotificationsChanged)
    }
  }, [isLoggedIn, pathname])

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground">
              <span className="text-sm font-bold text-background">M</span>
            </div>
            <span className="text-sm font-semibold tracking-tight">MoodleCloud</span>
          </Link>
          
          <nav className="hidden items-center gap-1 md:flex">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                Dashboard
              </Button>
            </Link>
            <Link href="/ai-course-generator">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                <Sparkles className="mr-1 h-3 w-3" />
                AI Generator
                <Badge variant="secondary" className="ml-1.5 px-1 py-0 text-[10px] uppercase tracking-wider">Segera</Badge>
              </Button>
            </Link>
            <Link href="/harga">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                Harga
              </Button>
            </Link>
            <Link href="/dokumentasi">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                Bantuan
              </Button>
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <>
              <Link href="/buat-situs" className="hidden sm:block">
                <Button size="sm" className="h-8">
                  Buat Situs Baru
                </Button>
              </Link>
              
              {/* Theme Toggle */}
              <ThemeToggle />
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 relative">
                    <Bell className="h-4 w-4" />
                    {unreadNotificationCount > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 flex items-center justify-center text-[10px]">
                        {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <div className="flex items-center justify-between px-4 py-2">
                    <p className="text-sm font-medium">Notifikasi</p>
                    {unreadNotificationCount > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {unreadNotificationCount} baru
                      </Badge>
                    )}
                  </div>
                  <DropdownMenuSeparator />
                  <div className="max-h-[300px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        Tidak ada notifikasi
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        {notifications.slice(0, 5).map((notification) => (
                          <DropdownMenuItem
                            key={notification.id}
                            className={`flex flex-col items-start gap-1 p-3 cursor-pointer ${
                              isUnread(notification) ? "bg-muted/50" : ""
                            }`}
                            onSelect={() => {
                              router.push("/notifikasi")
                            }}
                          >
                            <div className="flex w-full items-start gap-3">
                              <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                                notification.type === "success" ? "bg-green-500/10" :
                                notification.type === "warning" ? "bg-yellow-500/10" :
                                notification.type === "error" ? "bg-red-500/10" :
                                "bg-blue-500/10"
                              }`}>
                                {getNotificationIcon(notification.type)}
                              </div>
                              <div className="flex-1 space-y-1 overflow-hidden">
                                <div className="flex items-center justify-between gap-1">
                                  <p className={`text-sm font-medium truncate ${isUnread(notification) ? "text-foreground" : "text-muted-foreground"}`}>
                                    {notification.title}
                                  </p>
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    {formatTimestamp(notification.created_at)}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {notification.message}
                                </p>
                              </div>
                            </div>
                          </DropdownMenuItem>
                        ))}
                      </div>
                    )}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="p-0 text-center">
                    <Link href="/notifikasi" className="w-full block py-2 text-sm text-primary hover:underline">
                      Lihat Semua Notifikasi
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user?.name ?? "Pengguna"}</p>
                    <p className="text-xs text-muted-foreground">{user?.email ?? "pengguna@example.com"}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <Link href="/profil">
                    <DropdownMenuItem>
                      <User className="mr-2 h-4 w-4" />
                      Profil
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/tagihan">
                    <DropdownMenuItem>
                      <Settings className="mr-2 h-4 w-4" />
                      Tagihan
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/dokumentasi">
                    <DropdownMenuItem>
                      <HelpCircle className="mr-2 h-4 w-4" />
                      Bantuan
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onSelect={(event) => {
                      event.preventDefault()
                      void handleLogout()
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Keluar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <ThemeToggle />
              <Link href="/masuk">
                <Button variant="ghost" size="sm">
                  Masuk
                </Button>
              </Link>
              <Link href="/daftar">
                <Button size="sm">Daftar</Button>
              </Link>
            </>
          )}

          <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden">
            <Menu className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}
