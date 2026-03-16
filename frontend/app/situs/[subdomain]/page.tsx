'use client'

import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  ExternalLink, 
  Settings, 
  Users, 
  BookOpen, 
  HardDrive, 
  Activity,
  Globe,
  TrendingUp,
  Download,
  RefreshCw,
  ArrowLeft,
  Copy,
  Database,
  Shield,
  Zap,
  BarChart3,
  FileText,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Upload,
  Trash2,
  GraduationCap,
  LineChart,
  MoreHorizontal,
  Bell,
  Mail,
  MessageSquare,
  Send,
  Filter,
  Search,
  AlertTriangle,
  Info,
  ClipboardList,
  Target,
  Eye,
  EyeOff,
} from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import Link from "next/link"
import { use, useState } from "react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { buildAdminURL, buildSiteURL, siteHostFromURL, SITE_BASE_DOMAIN } from "@/lib/site-url"

// Mockup data
const getSiteData = (subdomain: string) => ({
  id: "1",
  name: subdomain === "smkn1jakarta" ? "SMK Negeri 1 Jakarta" : 
        subdomain === "ut-learning" ? "Universitas Terbuka" :
        subdomain === "sma-hb" ? "SMA Harapan Bangsa" : "Situs Moodle",
  subdomain: subdomain,
  status: "aktif" as const,
  plan: "Professional",
  createdAt: "15 Januari 2024",
  moodleVersion: "4.3.2",
  phpVersion: "8.2",
  stats: {
    users: subdomain === "ut-learning" ? 1250 : subdomain === "smkn1jakarta" ? 450 : 320,
    courses: subdomain === "ut-learning" ? 48 : subdomain === "smkn1jakarta" ? 24 : 12,
    storage: subdomain === "ut-learning" ? "45.2 GB" : subdomain === "smkn1jakarta" ? "12.8 GB" : "5.4 GB",
    bandwidth: subdomain === "ut-learning" ? "128 GB" : subdomain === "smkn1jakarta" ? "45 GB" : "18 GB",
  },
  activity: {
    today: subdomain === "ut-learning" ? 342 : subdomain === "smkn1jakarta" ? 128 : 45,
    weekly: subdomain === "ut-learning" ? 2845 : subdomain === "smkn1jakarta" ? 892 : 312,
  },
})

const mockBackups = [
  { id: "1", date: "12 Mar 2024, 02:00", size: "2.4 GB", type: "Otomatis", status: "success" },
  { id: "2", date: "11 Mar 2024, 02:00", size: "2.3 GB", type: "Otomatis", status: "success" },
  { id: "3", date: "10 Mar 2024, 14:30", size: "2.3 GB", type: "Manual", status: "success" },
  { id: "4", date: "10 Mar 2024, 02:00", size: "2.2 GB", type: "Otomatis", status: "failed" },
]

const mockReports = [
  { id: "1", name: "Laporan Aktivitas Bulanan - Maret 2024", date: "1 Mar 2024", type: "Aktivitas", size: "245 KB" },
  { id: "2", name: "Rekap Nilai Semester Genap", date: "28 Feb 2024", type: "Nilai", size: "1.2 MB" },
  { id: "3", name: "Laporan Penyelesaian Kursus", date: "15 Feb 2024", type: "Completion", size: "380 KB" },
  { id: "4", name: "Statistik Login Pengguna", date: "10 Feb 2024", type: "Logs", size: "92 KB" },
  { id: "5", name: "Laporan Partisipasi - Matematika XI", date: "5 Feb 2024", type: "Partisipasi", size: "156 KB" },
]

const mockLogData = [
  { user: "Budi Santoso", action: "Mengakses kursus Matematika XI", time: "2 menit lalu", ip: "180.244.x.x" },
  { user: "Siti Rahayu", action: "Mengumpulkan tugas Fisika", time: "8 menit lalu", ip: "114.122.x.x" },
  { user: "Ahmad Fauzi", action: "Login ke sistem", time: "12 menit lalu", ip: "103.56.x.x" },
  { user: "Dewi Kusuma", action: "Mengakses kuis Kimia", time: "15 menit lalu", ip: "36.75.x.x" },
  { user: "Rudi Hermawan", action: "Menyelesaikan modul Biologi", time: "22 menit lalu", ip: "180.244.x.x" },
]

const mockCourseCompletion = [
  { course: "Matematika XI", enrolled: 38, completed: 30, inProgress: 6, notStarted: 2, rate: 79 },
  { course: "Fisika Dasar", enrolled: 32, completed: 25, inProgress: 5, notStarted: 2, rate: 78 },
  { course: "Kimia Organik", enrolled: 28, completed: 18, inProgress: 8, notStarted: 2, rate: 64 },
  { course: "Biologi Sel", enrolled: 35, completed: 31, inProgress: 3, notStarted: 1, rate: 89 },
  { course: "Bahasa Inggris", enrolled: 40, completed: 38, inProgress: 2, notStarted: 0, rate: 95 },
]

const mockGradeStats = [
  { course: "Matematika XI", avg: 78.4, highest: 98, lowest: 42, passed: 32, failed: 6 },
  { course: "Fisika Dasar", avg: 81.2, highest: 100, lowest: 55, passed: 29, failed: 3 },
  { course: "Kimia Organik", avg: 72.6, highest: 95, lowest: 38, passed: 20, failed: 8 },
  { course: "Biologi Sel", avg: 85.0, highest: 100, lowest: 60, passed: 34, failed: 1 },
  { course: "Bahasa Inggris", avg: 88.5, highest: 100, lowest: 70, passed: 40, failed: 0 },
]

const mockUserActivity = [
  { name: "Budi Santoso", role: "Siswa", lastLogin: "Hari ini, 09:14", sessions: 48, courses: 5, completed: 3 },
  { name: "Siti Rahayu", role: "Siswa", lastLogin: "Hari ini, 08:52", sessions: 62, courses: 5, completed: 4 },
  { name: "Ahmad Fauzi", role: "Siswa", lastLogin: "Kemarin, 21:30", sessions: 35, courses: 4, completed: 2 },
  { name: "Dewi Kusuma", role: "Guru", lastLogin: "Hari ini, 07:45", sessions: 120, courses: 3, completed: 0 },
  { name: "Rudi Hermawan", role: "Siswa", lastLogin: "2 hari lalu", sessions: 18, courses: 3, completed: 1 },
]

// Notification triggers and templates for Moodle activities
const notificationTriggers = [
  { id: "assignment_due", name: "Tugas Mendekati Deadline", desc: "Kirim pengingat H-3, H-1, dan hari H deadline tugas", category: "assignment", enabled: true },
  { id: "assignment_late", name: "Tugas Belum Dikumpulkan", desc: "Notifikasi untuk siswa yang melewati deadline", category: "assignment", enabled: true },
  { id: "assignment_graded", name: "Tugas Sudah Dinilai", desc: "Beritahu siswa saat tugas mereka sudah dinilai", category: "assignment", enabled: true },
  { id: "quiz_available", name: "Kuis Tersedia", desc: "Notifikasi saat kuis baru tersedia untuk dikerjakan", category: "quiz", enabled: true },
  { id: "quiz_reminder", name: "Pengingat Kuis", desc: "Ingatkan siswa untuk menyelesaikan kuis sebelum ditutup", category: "quiz", enabled: false },
  { id: "course_enrollment", name: "Enrollment Kursus Baru", desc: "Welcome message untuk siswa baru di kursus", category: "enrollment", enabled: true },
  { id: "course_completion", name: "Kursus Selesai", desc: "Ucapan selamat saat siswa menyelesaikan kursus", category: "completion", enabled: true },
  { id: "forum_reply", name: "Balasan Forum", desc: "Notifikasi saat ada balasan di topik yang diikuti", category: "forum", enabled: false },
  { id: "grade_released", name: "Nilai Dirilis", desc: "Beritahu siswa saat nilai ujian/quiz dirilis", category: "grade", enabled: true },
  { id: "course_update", name: "Update Materi Kursus", desc: "Notifikasi saat ada materi baru di kursus", category: "content", enabled: true },
  { id: "badge_earned", name: "Badge Diperoleh", desc: "Notifikasi saat siswa mendapatkan badge/achievement", category: "achievement", enabled: true },
  { id: "inactivity", name: "Siswa Tidak Aktif", desc: "Kirim reminder ke siswa yang tidak login > 7 hari", category: "engagement", enabled: false },
]

const notificationHistory = [
  { id: "1", type: "assignment_due", title: "Pengingat: Tugas Matematika XI", recipients: 38, sentAt: "Hari ini, 08:00", status: "sent", deliveryRate: 97 },
  { id: "2", type: "quiz_available", title: "Kuis Baru: Fisika Bab 5", recipients: 32, sentAt: "Kemarin, 10:30", status: "sent", deliveryRate: 100 },
  { id: "3", type: "course_enrollment", title: "Selamat Datang di Kimia Organik", recipients: 5, sentAt: "Kemarin, 09:15", status: "sent", deliveryRate: 100 },
  { id: "4", type: "grade_released", title: "Nilai Ujian Tengah Semester", recipients: 120, sentAt: "2 hari lalu", status: "sent", deliveryRate: 95 },
  { id: "5", type: "inactivity", title: "Kami Merindukanmu!", recipients: 12, sentAt: "3 hari lalu", status: "sent", deliveryRate: 83 },
]

const notificationPreferences = {
  channels: { email: true, moodleMessage: true, push: false },
  quietHours: { enabled: true, start: "22:00", end: "07:00" },
  batchDelivery: false,
  allowUnsubscribe: true,
}

export default function SiteDetailPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  const siteUrl = buildSiteURL(subdomain)
  const adminUrl = buildAdminURL(subdomain)
  const siteHost = siteHostFromURL(siteUrl, subdomain)
  const site = getSiteData(subdomain)
  const [activeTab, setActiveTab] = useState("ringkasan")

  // Laporan period state — max 7 days
  const today = new Date()
  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(today.getDate() - 6)
  const fmt = (d: Date) => d.toISOString().split("T")[0]
  const [periodeStart, setPeriodeStart] = useState(fmt(sevenDaysAgo))
  const [periodeEnd, setPeriodeEnd] = useState(fmt(today))
  const [periodeError, setPeriodeError] = useState("")
  const [reportGenerated, setReportGenerated] = useState(true)

  const handlePeriodeChange = (start: string, end: string) => {
    const s = new Date(start), e = new Date(end)
    const diff = (e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)
    if (diff < 0) { setPeriodeError("Tanggal akhir harus setelah tanggal mulai."); return }
    if (diff > 6) { setPeriodeError("Periode maksimal 7 hari."); return }
    setPeriodeError("")
    setPeriodeStart(start)
    setPeriodeEnd(end)
    setReportGenerated(false)
  }

  // Dummy data varies slightly based on period start day
  const seed = new Date(periodeStart).getDate()
  const periodLogData = [
    { user: "Budi Santoso",   action: "Mengakses kursus Matematika XI",     time: `${8 + (seed % 3)}:14`, date: periodeStart, ip: "180.244.x.x" },
    { user: "Siti Rahayu",    action: "Mengumpulkan tugas Fisika",           time: `09:${20 + (seed % 10)}`, date: periodeStart, ip: "114.122.x.x" },
    { user: "Ahmad Fauzi",    action: "Login ke sistem",                      time: "10:05", date: periodeStart, ip: "103.56.x.x" },
    { user: "Dewi Kusuma",    action: "Membuat kuis baru - Kimia Bab 3",     time: "11:32", date: periodeStart, ip: "36.75.x.x" },
    { user: "Rudi Hermawan",  action: "Menyelesaikan modul Biologi",         time: "13:45", date: periodeStart, ip: "180.244.x.x" },
    { user: "Nina Putri",     action: "Mendaftar kursus Bahasa Inggris",     time: "14:10", date: periodeStart, ip: "202.43.x.x" },
    { user: "Hendra Wijaya",  action: "Melihat nilai ujian",                 time: "15:22", date: periodeStart, ip: "125.162.x.x" },
    { user: "Lestari S.",     action: "Membuka forum diskusi Fisika",        time: "16:08", date: periodeStart, ip: "103.56.x.x" },
  ]

  const periodStats = {
    loginCount:  220 + seed * 3,
    activeUsers: 80  + seed * 2,
    submissions: 45  + seed,
    avgOnline:   `${18 + (seed % 10)}m`,
  }

  const periodCompletion = [
    { course: "Matematika XI",  enrolled: 38, completed: 22 + (seed % 5), inProgress: 10, notStarted: 6 },
    { course: "Fisika Dasar",   enrolled: 32, completed: 18 + (seed % 4), inProgress:  8, notStarted: 6 },
    { course: "Kimia Organik",  enrolled: 28, completed: 12 + (seed % 3), inProgress:  9, notStarted: 7 },
    { course: "Biologi Sel",    enrolled: 35, completed: 28 + (seed % 4), inProgress:  5, notStarted: 2 },
    { course: "Bahasa Inggris", enrolled: 40, completed: 35 + (seed % 3), inProgress:  4, notStarted: 1 },
  ].map(r => ({ ...r, rate: Math.round(r.completed / r.enrolled * 100) }))

  const periodGrades = [
    { course: "Matematika XI",  avg: 76 + (seed % 6), highest: 98, lowest: 40, passed: 30 + (seed % 4), failed: 8 - (seed % 3) },
    { course: "Fisika Dasar",   avg: 80 + (seed % 5), highest: 100, lowest: 52, passed: 28 + (seed % 3), failed: 4 },
    { course: "Kimia Organik",  avg: 70 + (seed % 7), highest: 95, lowest: 36, passed: 19 + (seed % 3), failed: 9 - (seed % 2) },
    { course: "Biologi Sel",    avg: 84 + (seed % 4), highest: 100, lowest: 58, passed: 33 + (seed % 2), failed: 2 },
    { course: "Bahasa Inggris", avg: 87 + (seed % 5), highest: 100, lowest: 68, passed: 39 + (seed % 1), failed: 1 },
  ]

  const periodUserActivity = [
    { name: "Budi Santoso",  role: "Siswa", sessions: 12 + seed % 5, timeOnline: `${2 + seed % 3}j 14m`, submissions: 3, lastAction: "Matematika XI" },
    { name: "Siti Rahayu",   role: "Siswa", sessions: 18 + seed % 4, timeOnline: `${3 + seed % 2}j 40m`, submissions: 5, lastAction: "Fisika Dasar" },
    { name: "Ahmad Fauzi",   role: "Siswa", sessions:  9 + seed % 3, timeOnline: `${1 + seed % 2}j 55m`, submissions: 2, lastAction: "Kimia Organik" },
    { name: "Dewi Kusuma",   role: "Guru",  sessions: 22 + seed % 6, timeOnline: `${4 + seed % 3}j 10m`, submissions: 0, lastAction: "Kelola Kuis" },
    { name: "Nina Putri",    role: "Siswa", sessions:  7 + seed % 2, timeOnline: `${1 + seed % 2}j 20m`, submissions: 1, lastAction: "Bahasa Inggris" },
  ]

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(siteUrl)
  }

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
      
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <Link 
            href="/dashboard" 
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Dashboard
          </Link>

          {/* Site Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                <Globe className="h-7 w-7 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-semibold">{site.name}</h1>
                  <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                    Aktif
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-muted-foreground">{siteHost}</span>
                  <button onClick={handleCopyUrl} className="text-muted-foreground hover:text-foreground">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
            
            <Link href={siteUrl} target="_blank">
              <Button>
                <ExternalLink className="mr-2 h-4 w-4" />
                Buka Situs
              </Button>
            </Link>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full justify-start border-b border-border rounded-none h-auto p-0 bg-transparent">
              <TabsTrigger 
                value="ringkasan" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-muted-foreground data-[state=active]:text-foreground"
              >
                Ringkasan
              </TabsTrigger>
              <TabsTrigger 
                value="laporan" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-muted-foreground data-[state=active]:text-foreground"
              >
                Laporan
              </TabsTrigger>
              <TabsTrigger 
                value="backup" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-muted-foreground data-[state=active]:text-foreground"
              >
                Backup
              </TabsTrigger>
              <TabsTrigger 
                value="notifikasi" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-muted-foreground data-[state=active]:text-foreground"
              >
                Notifikasi
              </TabsTrigger>
              <TabsTrigger 
                value="pengaturan" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-muted-foreground data-[state=active]:text-foreground"
              >
                Pengaturan
              </TabsTrigger>
            </TabsList>

            {/* Tab: Ringkasan */}
            <TabsContent value="ringkasan" className="mt-6 space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Card className="p-4 border-border">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                      <Users className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-semibold">{site.stats.users.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Pengguna</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4 border-border">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                      <BookOpen className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-semibold">{site.stats.courses}</p>
                      <p className="text-xs text-muted-foreground">Kursus</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4 border-border">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                      <HardDrive className="h-5 w-5 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-semibold">{site.stats.storage}</p>
                      <p className="text-xs text-muted-foreground">Storage</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4 border-border">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
                      <Activity className="h-5 w-5 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-semibold">{site.activity.today}</p>
                      <p className="text-xs text-muted-foreground">Aktif Hari Ini</p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Metrics Section */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Storage Usage */}
                <Card className="p-6 border-border">
                  <h3 className="font-semibold mb-4">Penggunaan Storage</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Terpakai</span>
                        <span className="font-medium">{site.stats.storage} / 100 GB</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: '45%' }} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                      <div>
                        <p className="text-xs text-muted-foreground">File Kursus</p>
                        <p className="text-lg font-semibold">28.5 GB</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Database</p>
                        <p className="text-lg font-semibold">8.2 GB</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Backup</p>
                        <p className="text-lg font-semibold">6.8 GB</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Cache</p>
                        <p className="text-lg font-semibold">1.7 GB</p>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Activity Stats */}
                <Card className="p-6 border-border">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Aktivitas Pengguna</h3>
                    <Select defaultValue="7d">
                      <SelectTrigger className="w-28 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7d">7 Hari</SelectItem>
                        <SelectItem value="30d">30 Hari</SelectItem>
                        <SelectItem value="90d">90 Hari</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Hari Ini</p>
                      <p className="text-xl font-semibold">{site.activity.today}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Minggu Ini</p>
                      <p className="text-xl font-semibold">{site.activity.weekly.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="h-24 flex items-center justify-center border border-dashed border-border rounded-lg bg-muted/20">
                    <div className="text-center">
                      <TrendingUp className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                      <p className="text-xs text-muted-foreground">Grafik Aktivitas</p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Course Stats & System Info */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Course Statistics */}
                <Card className="p-6 border-border">
                  <h3 className="font-semibold mb-4">Statistik Kursus</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <p className="text-2xl font-bold">{site.stats.courses}</p>
                      <p className="text-xs text-muted-foreground">Total Kursus</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <p className="text-2xl font-bold text-green-600">18</p>
                      <p className="text-xs text-muted-foreground">Kursus Aktif</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <p className="text-2xl font-bold text-blue-600">256</p>
                      <p className="text-xs text-muted-foreground">Enrollment</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <p className="text-2xl font-bold text-orange-600">78%</p>
                      <p className="text-xs text-muted-foreground">Completion</p>
                    </div>
                  </div>
                </Card>

                {/* System Info */}
                <Card className="p-6 border-border">
                  <h3 className="font-semibold mb-4">Informasi Sistem</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-border">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Moodle</span>
                      </div>
                      <span className="text-sm font-medium">{site.moodleVersion}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-border">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">PHP</span>
                      </div>
                      <span className="text-sm font-medium">{site.phpVersion}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-border">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Bandwidth</span>
                      </div>
                      <span className="text-sm font-medium">{site.stats.bandwidth}</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">SSL Certificate</span>
                      </div>
                      <Badge variant="outline" className="text-green-600 border-green-600/50 bg-green-500/10 text-xs">Aktif</Badge>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Quick Actions */}
              <Card className="p-6 border-border">
                <h3 className="font-semibold mb-4">Aksi Cepat</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Button variant="outline" className="justify-start h-auto py-3 border-border">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    <span className="text-sm">Restart Situs</span>
                  </Button>
                  <Button variant="outline" className="justify-start h-auto py-3 border-border">
                    <Download className="mr-2 h-4 w-4" />
                    <span className="text-sm">Backup Sekarang</span>
                  </Button>
                  <Button variant="outline" className="justify-start h-auto py-3 border-border">
                    <Upload className="mr-2 h-4 w-4" />
                    <span className="text-sm">Restore Backup</span>
                  </Button>
                  <Link href={adminUrl} target="_blank" className="w-full">
                    <Button variant="outline" className="justify-start h-auto py-3 w-full border-border">
                      <Settings className="mr-2 h-4 w-4" />
                      <span className="text-sm">Admin Panel</span>
                    </Button>
                  </Link>
                </div>
              </Card>
            </TabsContent>

            {/* Tab: Laporan */}
            <TabsContent value="laporan" className="mt-6 space-y-6">

              {/* Period Picker */}
              <Card className="p-4 border-border">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-sm font-medium mb-1">Periode Laporan</p>
                    <p className="text-xs text-muted-foreground">Pilih rentang tanggal (maksimal 7 hari)</p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex items-center gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Dari</Label>
                        <Input
                          type="date"
                          value={periodeStart}
                          max={periodeEnd}
                          onChange={e => handlePeriodeChange(e.target.value, periodeEnd)}
                          className="mt-1 h-9 text-sm border-border w-40"
                        />
                      </div>
                      <span className="text-muted-foreground mt-5">—</span>
                      <div>
                        <Label className="text-xs text-muted-foreground">Sampai</Label>
                        <Input
                          type="date"
                          value={periodeEnd}
                          min={periodeStart}
                          max={fmt(today)}
                          onChange={e => handlePeriodeChange(periodeStart, e.target.value)}
                          className="mt-1 h-9 text-sm border-border w-40"
                        />
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setReportGenerated(true)}
                      disabled={!!periodeError}
                    >
                      Tampilkan Laporan
                    </Button>
                  </div>
                </div>
                {periodeError && (
                  <p className="text-xs text-destructive mt-3 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {periodeError}
                  </p>
                )}
              </Card>

              {/* Plugin Notice */}
              <Card className="p-4 border-border bg-amber-500/5 border-amber-500/20">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Jika laporan tidak muncul atau data kosong, install plugin{" "}
                    <span className="font-mono bg-muted px-1 py-0.5 rounded text-foreground">logstore_standard</span>,{" "}
                    <span className="font-mono bg-muted px-1 py-0.5 rounded text-foreground">report_completion</span>, atau{" "}
                    <span className="font-mono bg-muted px-1 py-0.5 rounded text-foreground">gradereport_overview</span>{" "}
                    melalui <strong>Admin Panel → Plugins → Install Plugin</strong>.
                  </p>
                </div>
              </Card>

              {reportGenerated && (
                <>
                  {/* Period Label */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {new Date(periodeStart).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                        {" "}&ndash;{" "}
                        {new Date(periodeEnd).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                      </span>
                    </div>
                    <Button variant="outline" size="sm" className="border-border text-xs h-8">
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Export Semua
                    </Button>
                  </div>

                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {[
                      { label: "Total Login",      value: periodStats.loginCount.toLocaleString(), icon: Activity,      color: "text-blue-500",   bg: "bg-blue-500/10" },
                      { label: "Pengguna Aktif",   value: periodStats.activeUsers.toLocaleString(), icon: Users,          color: "text-green-500",  bg: "bg-green-500/10" },
                      { label: "Tugas Dikumpul",   value: periodStats.submissions.toLocaleString(), icon: CheckCircle2,   color: "text-purple-500", bg: "bg-purple-500/10" },
                      { label: "Avg. Online",      value: periodStats.avgOnline,                    icon: Clock,          color: "text-orange-500", bg: "bg-orange-500/10" },
                    ].map((s, i) => (
                      <Card key={i} className="p-4 border-border">
                        <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${s.bg} mb-3`}>
                          <s.icon className={`h-4 w-4 ${s.color}`} />
                        </div>
                        <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-xs font-medium text-foreground mt-0.5">{s.label}</p>
                      </Card>
                    ))}
                  </div>

                  {/* Activity Log */}
                  <Card className="border-border">
                    <div className="flex items-center justify-between p-6 pb-4">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary" />
                        <h3 className="font-semibold">Log Aktivitas</h3>
                      </div>
                      <Button variant="outline" size="sm" className="border-border h-8">
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                        Export Log
                      </Button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-t border-border bg-muted/30">
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Pengguna</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Aktivitas</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Tanggal</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">IP</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground">Waktu</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {periodLogData.map((log, i) => (
                            <tr key={i} className="hover:bg-muted/20 transition-colors">
                              <td className="px-6 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold flex-shrink-0">
                                    {log.user.split(" ").map(n => n[0]).join("").slice(0, 2)}
                                  </div>
                                  <span className="font-medium whitespace-nowrap">{log.user}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">{log.action}</td>
                              <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                                {new Date(log.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground font-mono text-xs hidden md:table-cell">{log.ip}</td>
                              <td className="px-6 py-3 text-right text-muted-foreground whitespace-nowrap">{log.time}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>

                  {/* Course Completion */}
                  <Card className="border-border">
                    <div className="flex items-center justify-between p-6 pb-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <h3 className="font-semibold">Penyelesaian Kursus</h3>
                      </div>
                      <Button variant="outline" size="sm" className="border-border h-8">
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                        Export CSV
                      </Button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-t border-border bg-muted/30">
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Kursus</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Terdaftar</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Selesai</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Proses</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground hidden sm:table-cell">Belum Mulai</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Progress</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {periodCompletion.map((row, i) => (
                            <tr key={i} className="hover:bg-muted/20 transition-colors">
                              <td className="px-6 py-3 font-medium">{row.course}</td>
                              <td className="px-4 py-3 text-right text-muted-foreground">{row.enrolled}</td>
                              <td className="px-4 py-3 text-right text-green-600 font-medium">{row.completed}</td>
                              <td className="px-4 py-3 text-right text-blue-600">{row.inProgress}</td>
                              <td className="px-4 py-3 text-right text-muted-foreground hidden sm:table-cell">{row.notStarted}</td>
                              <td className="px-6 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden min-w-16">
                                    <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${row.rate}%` }} />
                                  </div>
                                  <span className="text-xs font-medium w-8 text-right">{row.rate}%</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>

                  {/* Grade Overview */}
                  <Card className="border-border">
                    <div className="flex items-center justify-between p-6 pb-4">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="h-4 w-4 text-primary" />
                        <h3 className="font-semibold">Rekap Nilai</h3>
                      </div>
                      <Button variant="outline" size="sm" className="border-border h-8">
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                        Export CSV
                      </Button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-t border-border bg-muted/30">
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Kursus</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Rata-rata</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground hidden sm:table-cell">Tertinggi</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground hidden sm:table-cell">Terendah</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Lulus</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Tidak Lulus</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {periodGrades.map((row, i) => (
                            <tr key={i} className="hover:bg-muted/20 transition-colors">
                              <td className="px-6 py-3 font-medium">{row.course}</td>
                              <td className="px-4 py-3 text-right">
                                <span className={`font-semibold ${row.avg >= 80 ? "text-green-600" : row.avg >= 65 ? "text-orange-500" : "text-destructive"}`}>
                                  {row.avg}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right text-muted-foreground hidden sm:table-cell">{row.highest}</td>
                              <td className="px-4 py-3 text-right text-muted-foreground hidden sm:table-cell">{row.lowest}</td>
                              <td className="px-4 py-3 text-right text-green-600 font-medium">{row.passed}</td>
                              <td className="px-4 py-3 text-right text-destructive">{row.failed}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>

                  {/* User Activity */}
                  <Card className="border-border">
                    <div className="flex items-center justify-between p-6 pb-4">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        <h3 className="font-semibold">Aktivitas Per Pengguna</h3>
                      </div>
                      <Button variant="outline" size="sm" className="border-border h-8">
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                        Export CSV
                      </Button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-t border-border bg-muted/30">
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Pengguna</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Sesi</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground hidden sm:table-cell">Total Online</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Tugas</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Terakhir Akses</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {periodUserActivity.map((u, i) => (
                            <tr key={i} className="hover:bg-muted/20 transition-colors">
                              <td className="px-6 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold flex-shrink-0">
                                    {u.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                                  </div>
                                  <div>
                                    <p className="font-medium">{u.name}</p>
                                    <Badge variant={u.role === "Guru" ? "default" : "secondary"} className="text-[10px] h-4 mt-0.5">{u.role}</Badge>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right font-medium">{u.sessions}</td>
                              <td className="px-4 py-3 text-right text-muted-foreground hidden sm:table-cell">{u.timeOnline}</td>
                              <td className="px-4 py-3 text-right font-medium text-purple-600">{u.submissions}</td>
                              <td className="px-6 py-3 text-muted-foreground text-xs hidden md:table-cell">{u.lastAction}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </>
              )}

              {!reportGenerated && !periodeError && (
                <Card className="p-12 border-border text-center border-dashed">
                  <Calendar className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm font-medium">Klik &ldquo;Tampilkan Laporan&rdquo;</p>
                  <p className="text-xs text-muted-foreground mt-1">Laporan akan ditampilkan sesuai periode yang dipilih</p>
                </Card>
              )}

            </TabsContent>

            {/* Tab: Backup */}
            <TabsContent value="backup" className="mt-6 space-y-6">
              <div className="grid gap-6 lg:grid-cols-3">
                <Card className="p-6 border-border lg:col-span-2">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-semibold">Riwayat Backup</h3>
                    <Button size="sm">
                      <Download className="mr-2 h-4 w-4" />
                      Backup Sekarang
                    </Button>
                  </div>
                  <div className="border border-border rounded-lg divide-y divide-border">
                    {mockBackups.map((backup) => (
                      <div key={backup.id} className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${backup.status === "success" ? "bg-green-500/10" : "bg-red-500/10"}`}>
                            {backup.status === "success" ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{backup.date}</p>
                            <p className="text-xs text-muted-foreground">{backup.size} - {backup.type}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" disabled={backup.status === "failed"}>
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" disabled={backup.status === "failed"}>
                            <Upload className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="p-6 border-border">
                  <h3 className="font-semibold mb-4">Pengaturan Backup</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="auto-backup" className="text-sm text-muted-foreground">Backup Otomatis</Label>
                      <Switch id="auto-backup" defaultChecked />
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Frekuensi</Label>
                      <Select defaultValue="daily">
                        <SelectTrigger className="mt-2 border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Harian</SelectItem>
                          <SelectItem value="weekly">Mingguan</SelectItem>
                          <SelectItem value="monthly">Bulanan</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Retensi</Label>
                      <Select defaultValue="30">
                        <SelectTrigger className="mt-2 border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">7 Hari</SelectItem>
                          <SelectItem value="30">30 Hari</SelectItem>
                          <SelectItem value="90">90 Hari</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button className="w-full mt-4">Simpan Pengaturan</Button>
                  </div>
                </Card>
              </div>
            </TabsContent>

            {/* Tab: Pengaturan */}
            <TabsContent value="pengaturan" className="mt-6 space-y-6">
              {/* Site Information */}
              <Card className="p-6 border-border">
                <h3 className="font-semibold mb-4">Informasi Situs</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-muted-foreground">Nama Situs</Label>
                    <Input defaultValue={site.name} className="mt-2 border-border" />
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Subdomain</Label>
                    <Input defaultValue={subdomain} disabled className="mt-2 border-border bg-muted/50" />
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Timezone</Label>
                    <Select defaultValue="asia-jakarta">
                      <SelectTrigger className="mt-2 border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asia-jakarta">Asia/Jakarta (WIB)</SelectItem>
                        <SelectItem value="asia-makassar">Asia/Makassar (WITA)</SelectItem>
                        <SelectItem value="asia-jayapura">Asia/Jayapura (WIT)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Bahasa Default</Label>
                    <Select defaultValue="id">
                      <SelectTrigger className="mt-2 border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="id">Bahasa Indonesia</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button className="mt-6">Simpan Perubahan</Button>
              </Card>

              {/* Custom Domain */}
              <Card className="p-6 border-border">
                <h3 className="font-semibold mb-4">Custom Domain</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Hubungkan domain kustom Anda ke situs Moodle ini. Domain akan otomatis mendapatkan SSL certificate.
                </p>
                <div className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Domain Saat Ini</Label>
                    <div className="flex items-center gap-2 mt-2">
                      <Input defaultValue={siteHost} disabled className="border-border bg-muted/50" />
                      <Badge variant="outline" className="text-green-600 border-green-600/50 bg-green-500/10 whitespace-nowrap">Aktif</Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Custom Domain</Label>
                    <div className="flex items-center gap-2 mt-2">
                      <Input placeholder="contoh: lms.sekolah.sch.id" className="border-border" />
                      <Button variant="outline" className="border-border whitespace-nowrap">Tambah Domain</Button>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30 border border-border">
                    <p className="text-sm font-medium mb-2">Konfigurasi DNS</p>
                    <p className="text-xs text-muted-foreground mb-3">
                      Tambahkan record berikut ke DNS provider Anda:
                    </p>
                    <div className="space-y-2 font-mono text-xs">
                      <div className="flex items-center justify-between p-2 bg-background rounded border border-border">
                        <span className="text-muted-foreground">CNAME</span>
                        <span>cname.{SITE_BASE_DOMAIN}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-background rounded border border-border">
                        <span className="text-muted-foreground">TXT</span>
                        <span>moodlecloud-verify={subdomain}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Server Configuration */}
              <Card className="p-6 border-border">
                <h3 className="font-semibold mb-4">Konfigurasi Server</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div>
                      <p className="text-sm font-medium">Mode Maintenance</p>
                      <p className="text-xs text-muted-foreground">Nonaktifkan akses sementara</p>
                    </div>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div>
                      <p className="text-sm font-medium">Debug Mode</p>
                      <p className="text-xs text-muted-foreground">Tampilkan error detail</p>
                    </div>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div>
                      <p className="text-sm font-medium">Caching</p>
                      <p className="text-xs text-muted-foreground">Aktifkan cache sistem</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div>
                      <p className="text-sm font-medium">SSL Strict</p>
                      <p className="text-xs text-muted-foreground">Force HTTPS</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </Card>

              {/* Danger Zone */}
              <Card className="p-6 border-destructive/50">
                <h3 className="font-semibold text-destructive mb-4">Zona Berbahaya</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div>
                      <p className="text-sm font-medium">Reset Situs</p>
                      <p className="text-xs text-muted-foreground">Hapus semua data dan mulai dari awal</p>
                    </div>
                    <Button variant="outline" size="sm" className="border-border">Reset</Button>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                    <div>
                      <p className="text-sm font-medium">Hapus Situs</p>
                      <p className="text-xs text-muted-foreground">Hapus situs secara permanen</p>
                    </div>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Hapus
                    </Button>
                  </div>
                </div>
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
