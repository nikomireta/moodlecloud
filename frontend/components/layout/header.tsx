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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const isLoggedIn = status === "authenticated"
  const unreadNotificationCount = useMemo(() => notifications.filter(isUnread).length, [notifications])

  const handleLogout = async () => {
    try {
      await logout()
      router.push("/masuk")
    } catch (error) {
      console.error("Logout error:", error)
    }
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
      } catch {
        if (!active) return
        setNotifications([])
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
            <span className="text-sm font-semibold tracking-tight">Moodlepilot</span>
          </Link>
          
          <nav className="hidden items-center gap-1 md:flex">
            <Button 
              variant="ghost" 
              size="sm" 
              className={pathname === "/dashboard" ? "text-foreground font-semibold bg-accent/50" : "text-muted-foreground hover:text-foreground"} 
              asChild
            >
              <Link href="/dashboard">
                Dashboard
              </Link>
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className={pathname === "/ai-course-generator" ? "text-foreground font-semibold bg-accent/50" : "text-muted-foreground hover:text-foreground"} 
              asChild
            >
              <Link href="/ai-course-generator">
                <Sparkles className="mr-1 h-3 w-3" />
                AI Generator
                <Badge variant="secondary" className="ml-1.5 px-1 py-0 text-[10px] uppercase tracking-wider">Segera</Badge>
              </Link>
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className={pathname === "/harga" ? "text-foreground font-semibold bg-accent/50" : "text-muted-foreground hover:text-foreground"} 
              asChild
            >
              <Link href="/harga">
                Harga
              </Link>
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className={pathname === "/dokumentasi" ? "text-foreground font-semibold bg-accent/50" : "text-muted-foreground hover:text-foreground"} 
              asChild
            >
              <Link href="/dokumentasi">
                Bantuan
              </Link>
            </Button>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <>
              <Button size="sm" className="h-8 hidden sm:flex" asChild>
                <Link href="/buat-situs">
                  Buat Situs Baru
                </Link>
              </Button>
              
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
                <DropdownMenuContent align="end" className="w-[320px] sm:w-[360px] p-0 overflow-hidden border-border/50 shadow-lg">
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border/50">
                    <p className="text-sm font-semibold tracking-tight">Notifikasi</p>
                    {unreadNotificationCount > 0 && (
                      <Badge variant="secondary" className="text-[10px] uppercase font-semibold px-2">
                        {unreadNotificationCount} Baru
                      </Badge>
                    )}
                  </div>
                  <div className="max-h-[350px] overflow-y-auto w-full">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                        <div className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                          <Bell className="h-5 w-5 text-muted-foreground/50" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">Tidak ada notifikasi</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">Anda sudah melihat semuanya.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        {notifications.slice(0, 5).map((notification) => (
                          <DropdownMenuItem
                            key={notification.id}
                            className={`flex flex-col items-start p-3 m-1 cursor-pointer rounded-md transition-all ${
                              isUnread(notification) 
                                ? "bg-primary/5 hover:bg-primary/10 border-l-2 border-primary" 
                                : "hover:bg-muted border-l-2 border-transparent"
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
                  <div className="p-2 border-t border-border/50 bg-muted/10">
                    <Button variant="ghost" size="sm" className="w-full text-xs font-semibold hover:bg-muted text-primary hover:text-primary transition-colors h-8" asChild>
                      <Link href="/notifikasi">Lihat Semua Notifikasi</Link>
                    </Button>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              <ThemeToggle />
              
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
              <Button variant="ghost" size="sm" asChild>
                <Link href="/masuk">
                  Masuk
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/daftar">
                  Daftar
                </Link>
              </Button>
            </>
          )}

          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden">
                <Menu className="h-4 w-4" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] flex flex-col sm:w-[350px] p-0">
              <div className="flex flex-col h-full bg-background">
                <SheetHeader className="p-6 border-b border-border/50 text-left">
                  <SheetTitle>
                    <Link href="/" className="flex items-center gap-2 w-fit transition-opacity hover:opacity-80" onClick={() => setIsMobileMenuOpen(false)}>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground shadow-sm">
                        <span className="text-sm font-bold text-background">M</span>
                      </div>
                      <span className="text-base font-semibold tracking-tight">Moodlepilot</span>
                    </Link>
                  </SheetTitle>
                </SheetHeader>
                
                <div className="flex-1 overflow-y-auto py-6 px-4">
                  <nav className="flex flex-col gap-1.5">
                    <p className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Menu Utama
                    </p>
                    <Link
                      href="/dashboard"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-all ${
                        pathname === "/dashboard" 
                          ? "bg-primary/10 text-primary" 
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <LayoutDashboard className="mr-3 h-4 w-4" />
                      Dashboard
                    </Link>
                    <Link
                      href="/ai-course-generator"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-all ${
                        pathname === "/ai-course-generator"
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <Sparkles className="mr-3 h-4 w-4" />
                      AI Generator
                      <Badge variant="secondary" className="ml-auto px-1.5 py-0 text-[10px] uppercase tracking-wider font-semibold">
                        Segera
                      </Badge>
                    </Link>
                    
                    <div className="my-2 border-t border-border/50"></div>
                    
                    <p className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 mt-2">
                      Lainnya
                    </p>
                    <Link
                      href="/harga"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-all ${
                        pathname === "/harga"
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      Harga
                    </Link>
                    <Link
                      href="/dokumentasi"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-all ${
                        pathname === "/dokumentasi"
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <HelpCircle className="mr-3 h-4 w-4" />
                      Bantuan
                    </Link>
                  </nav>
                </div>

                <div className="p-4 border-t border-border/50 bg-muted/20">
                  {!isLoggedIn ? (
                    <div className="flex flex-col gap-3">
                      <Button variant="outline" className="w-full justify-center shadow-sm" asChild onClick={() => setIsMobileMenuOpen(false)}>
                        <Link href="/masuk">Masuk</Link>
                      </Button>
                      <Button className="w-full justify-center shadow-sm" asChild onClick={() => setIsMobileMenuOpen(false)}>
                        <Link href="/daftar">Daftar</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-3 px-2 mb-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted border border-border">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-medium truncate">{user?.name ?? "Pengguna"}</span>
                          <span className="text-xs text-muted-foreground truncate">{user?.email ?? "pengguna@example.com"}</span>
                        </div>
                      </div>
                      <Button className="w-full justify-center shadow-sm" asChild onClick={() => setIsMobileMenuOpen(false)}>
                        <Link href="/buat-situs">Buat Situs Baru</Link>
                      </Button>
                      <Button variant="ghost" className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => {
                        e.preventDefault()
                        setIsMobileMenuOpen(false)
                        void handleLogout()
                      }}>
                        <LogOut className="mr-3 h-4 w-4" />
                        Keluar
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
