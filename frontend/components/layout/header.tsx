"use client"

import { useEffect, useState } from "react"
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
import { Menu, User, LogOut, Settings, LayoutDashboard, HelpCircle, Bell, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { useAuth } from "@/components/providers/auth-provider"
import { api } from "@/lib/api"

export function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const { status, user, logout } = useAuth()
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const isLoggedIn = status === "authenticated"

  const handleLogout = async () => {
    await logout()
    router.push("/masuk")
  }

  useEffect(() => {
    if (!isLoggedIn) {
      setUnreadNotificationCount(0)
      return
    }

    let active = true

    const refreshNotificationCount = async () => {
      try {
        const response = await api.listNotifications()
        if (!active) return
        setUnreadNotificationCount(response.notifications.filter((notification) => !notification.read_at).length)
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
              
              {/* Notification Bell */}
              <Link href="/notifikasi">
                <Button variant="ghost" size="icon" className="h-8 w-8 relative">
                  <Bell className="h-4 w-4" />
                  {unreadNotificationCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 flex items-center justify-center text-[10px]">
                      {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                    </Badge>
                  )}
                </Button>
              </Link>
              
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
                  <Link href="/dashboard">
                    <DropdownMenuItem>
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Dashboard
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/ai-course-generator">
                    <DropdownMenuItem>
                      <Sparkles className="mr-2 h-4 w-4" />
                      AI Course Generator
                    </DropdownMenuItem>
                  </Link>
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
                  <Link href="/pengaturan">
                    <DropdownMenuItem>
                      <Settings className="mr-2 h-4 w-4" />
                      Pengaturan
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
