export const BLOG_CATEGORY_ORDER = ["Tutorial", "Tips & Trik", "Update", "Studi Kasus", "Berita"] as const

export const DOC_CATEGORY_CONFIG = {
  memulai: {
    title: "Memulai",
    description: "Panduan awal untuk membuat akun, menyiapkan situs, dan memahami alur dasar Moodlepilot.",
    icon: "rocket",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  "pembuatan-situs-dan-domain": {
    title: "Pembuatan Situs & Domain",
    description: "Cara memilih paket, menyiapkan subdomain, dan menghubungkan domain institusi Anda.",
    icon: "settings",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  "operasional-dan-runtime": {
    title: "Operasional & Runtime",
    description: "Panduan operasional harian, akses admin, serta kontrol start, stop, dan restart runtime.",
    icon: "shield",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  "backup-dan-pemulihan": {
    title: "Backup & Pemulihan",
    description: "Kelola backup manual, backup terjadwal, unduhan arsip, dan retensi pemulihan data.",
    icon: "database",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
  "laporan-dan-analytics": {
    title: "Laporan & Analytics",
    description: "Memahami plugin laporan Moodlepilot, ringkasan metrik, detail report, dan export CSV.",
    icon: "users",
    color: "text-pink-500",
    bgColor: "bg-pink-500/10",
  },
  "akun-billing-dan-keamanan": {
    title: "Akun, Billing & Keamanan",
    description: "Kelola profil, sesi login, notifikasi, reset password, tagihan, dan keamanan akun.",
    icon: "credit-card",
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
  },
} as const

export const CHANGELOG_TYPES = ["fitur-baru", "peningkatan", "perbaikan"] as const

export type BlogCategory = (typeof BLOG_CATEGORY_ORDER)[number]
export type DocCategorySlug = keyof typeof DOC_CATEGORY_CONFIG
export type DocCategoryTitle = (typeof DOC_CATEGORY_CONFIG)[DocCategorySlug]["title"]
export type ChangelogType = (typeof CHANGELOG_TYPES)[number]

export type BlogPostMeta = {
  slug: string
  title: string
  excerpt: string
  publishedAt: string
  publishedLabel: string
  category: BlogCategory
  tags: string[]
  authorName: string
  authorRole: string
  featured: boolean
  draft: boolean
  coverImage?: string
  likes: number
  comments: number
  readTimeMinutes: number
  readTimeLabel: string
  url: string
  searchText: string
}

export type BlogPost = BlogPostMeta & {
  body: string
}

export type DocPageMeta = {
  slug: string
  slugSegments: string[]
  title: string
  description: string
  category: DocCategoryTitle
  categorySlug: DocCategorySlug
  order: number
  featured: boolean
  quickLink: boolean
  popular: boolean
  faq: boolean
  updatedAt: string
  updatedLabel: string
  draft: boolean
  viewsLabel?: string
  readTimeMinutes: number
  readTimeLabel: string
  url: string
  searchText: string
}

export type DocPage = DocPageMeta & {
  body: string
}

export type ChangelogEntry = {
  slug: string
  title: string
  summary: string
  publishedAt: string
  publishedLabel: string
  type: ChangelogType
  productArea: string
  draft: boolean
  body: string
  readTimeMinutes: number
  readTimeLabel: string
  url: string
}

export type StaticPage = {
  slug: string
  title: string
  description: string
  updatedAt: string
  updatedLabel: string
  draft: boolean
  body: string
  url: string
  readTimeMinutes: number
  readTimeLabel: string
}

export type DocLandingCategory = {
  slug: DocCategorySlug
  title: DocCategoryTitle
  description: string
  icon: (typeof DOC_CATEGORY_CONFIG)[DocCategorySlug]["icon"]
  color: string
  bgColor: string
  articles: DocPageMeta[]
}
