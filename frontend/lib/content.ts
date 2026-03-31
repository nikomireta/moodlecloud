import "server-only"

import fs from "node:fs"
import path from "node:path"
import { cache } from "react"
import matter from "gray-matter"
import { z } from "zod"
import {
  BLOG_CATEGORY_ORDER,
  CHANGELOG_TYPES,
  DOC_CATEGORY_CONFIG,
  type BlogCategory,
  type BlogPost,
  type BlogPostMeta,
  type ChangelogEntry,
  type DocCategorySlug,
  type DocCategoryTitle,
  type DocLandingCategory,
  type DocPage,
  type DocPageMeta,
  type StaticPage,
} from "@/lib/content-model"

const CONTENT_ROOT = path.join(process.cwd(), "content")
const BLOG_ROOT = path.join(CONTENT_ROOT, "blog")
const DOCS_ROOT = path.join(CONTENT_ROOT, "docs")
const CHANGELOG_ROOT = path.join(CONTENT_ROOT, "changelog")
const PAGES_ROOT = path.join(CONTENT_ROOT, "pages")

const DOC_CATEGORY_SLUGS = Object.keys(DOC_CATEGORY_CONFIG) as DocCategorySlug[]
const DOC_CATEGORY_TITLES = DOC_CATEGORY_SLUGS.map((slug) => DOC_CATEGORY_CONFIG[slug].title) as [string, ...string[]]

const STATIC_INTERNAL_ROUTES = new Set([
  "/",
  "/ai-course-generator",
  "/blog",
  "/buat-situs",
  "/changelog",
  "/daftar",
  "/dashboard",
  "/dokumentasi",
  "/dukungan",
  "/faq",
  "/harga",
  "/kebijakan-privasi",
  "/kontak",
  "/lupa-sandi",
  "/masuk",
  "/notifikasi",
  "/profil",
  "/reset-password",
  "/rss.xml",
  "/tentang",
  "/privasi",
  "/syarat",
  "/syarat-ketentuan",
  "/syarat-layanan",
  "/tagihan",
  "/verifikasi-email",
])

type ContentRecord = {
  sourcePath: string
  url: string
  draft: boolean
  body: string
  title: string
}

const isoDateSchema = z.preprocess((value) => {
  if (value instanceof Date) {
    return value.toISOString()
  }
  return value
}, z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(parseContentDate(value).getTime()), "Tanggal tidak valid"))

const blogFrontmatterSchema = z.object({
  title: z.string().min(1),
  excerpt: z.string().min(1),
  publishedAt: isoDateSchema,
  category: z.enum(BLOG_CATEGORY_ORDER),
  tags: z.array(z.string().min(1)).min(1),
  authorName: z.string().min(1),
  authorRole: z.string().min(1),
  featured: z.boolean().optional().default(false),
  draft: z.boolean().optional().default(false),
  coverImage: z.string().min(1).optional(),
  likes: z.number().int().nonnegative().optional().default(0),
  comments: z.number().int().nonnegative().optional().default(0),
})

const docFrontmatterSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.enum(DOC_CATEGORY_TITLES),
  order: z.number().int().nonnegative(),
  featured: z.boolean().optional().default(false),
  quickLink: z.boolean().optional().default(false),
  popular: z.boolean().optional().default(false),
  faq: z.boolean().optional().default(false),
  updatedAt: isoDateSchema,
  draft: z.boolean().optional().default(false),
  viewsLabel: z.string().min(1).optional(),
})

const changelogFrontmatterSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  publishedAt: isoDateSchema,
  type: z.enum(CHANGELOG_TYPES),
  productArea: z.string().min(1),
  draft: z.boolean().optional().default(false),
})

const staticPageFrontmatterSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  updatedAt: isoDateSchema,
  draft: z.boolean().optional().default(false),
})

function parseContentDate(value: string): Date {
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T00:00:00Z`)
  }
  return new Date(trimmed)
}

function formatContentDate(value: string): string {
  return parseContentDate(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

function ensureDirectoryExists(directoryPath: string) {
  if (!fs.existsSync(directoryPath)) {
    throw new Error(`Direktori konten tidak ditemukan: ${directoryPath}`)
  }
}

function listMarkdownFiles(directoryPath: string): string[] {
  ensureDirectoryExists(directoryPath)

  const entries = fs.readdirSync(directoryPath, { withFileTypes: true })
  return entries
    .flatMap((entry) => {
      const fullPath = path.join(directoryPath, entry.name)
      if (entry.isDirectory()) {
        return listMarkdownFiles(fullPath)
      }
      if (entry.isFile() && entry.name.endsWith(".md")) {
        return [fullPath]
      }
      return []
    })
    .sort()
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function stripMarkdown(markdown: string): string {
  return normalizeWhitespace(
    markdown
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/!\[[^\]]*]\(([^)]+)\)/g, " ")
      .replace(/\[([^\]]+)]\(([^)]+)\)/g, "$1")
      .replace(/^>\s?/gm, "")
      .replace(/[*_#>-]/g, " ")
  )
}

function calculateReadTime(markdown: string): { minutes: number; label: string } {
  const words = stripMarkdown(markdown).split(/\s+/).filter(Boolean).length
  const minutes = Math.max(1, Math.ceil(words / 200))
  return {
    minutes,
    label: `${minutes} menit`,
  }
}

function extractInternalLinks(markdown: string): string[] {
  const matches = markdown.matchAll(/\[[^\]]+]\(([^)]+)\)/g)
  return Array.from(matches, (match) => match[1]).filter((href) => {
    return href.startsWith("/") && !href.startsWith("//")
  })
}

function normalizeInternalRoute(href: string): string {
  return href.replace(/[?#].*$/, "")
}

function toRelativeSourcePath(sourcePath: string): string {
  return path.relative(process.cwd(), sourcePath)
}

function assertUniqueRoutes(records: ContentRecord[]) {
  const routeOwners = new Map<string, string>()

  for (const record of records) {
    const owner = routeOwners.get(record.url)
    if (owner) {
      throw new Error(`Slug bentrok pada route ${record.url} antara ${owner} dan ${record.sourcePath}`)
    }
    routeOwners.set(record.url, record.sourcePath)
  }
}

function validateInternalLinks(records: ContentRecord[]) {
  const routeMap = new Map(records.map((record) => [record.url, record]))

  for (const record of records) {
    for (const rawHref of extractInternalLinks(record.body)) {
      const normalizedHref = normalizeInternalRoute(rawHref)
      if (STATIC_INTERNAL_ROUTES.has(normalizedHref)) {
        continue
      }

      const target = routeMap.get(normalizedHref)
      if (!target) {
        throw new Error(
          `Link internal tidak valid di ${record.sourcePath}: ${rawHref} tidak ditemukan sebagai route publik`,
        )
      }

      if (!record.draft && target.draft) {
        throw new Error(
          `Link internal dari konten publish ke draft tidak diizinkan di ${record.sourcePath}: ${rawHref}`,
        )
      }
    }
  }
}

function assertSingleFeaturedPost(posts: BlogPost[]) {
  const featuredPosts = posts.filter((post) => post.featured)
  if (featuredPosts.length > 1) {
    const owners = featuredPosts.map((post) => post.slug).join(", ")
    throw new Error(`Hanya satu blog post boleh featured. Ditemukan lebih dari satu: ${owners}`)
  }
}

function assertDocCategoryMatch(page: DocPage) {
  const expectedTitle = DOC_CATEGORY_CONFIG[page.categorySlug].title
  if (page.category !== expectedTitle) {
    throw new Error(
      `Kategori frontmatter tidak cocok untuk ${page.url}. Gunakan "${expectedTitle}" agar sesuai dengan struktur folder.`,
    )
  }
}

function buildBlogPost(filePath: string): BlogPost {
  const slug = path.basename(filePath, ".md")
  const sourcePath = toRelativeSourcePath(filePath)
  const raw = fs.readFileSync(filePath, "utf8")
  const parsed = matter(raw)
  const frontmatter = blogFrontmatterSchema.parse(parsed.data, {
    path: [sourcePath],
  })
  const readTime = calculateReadTime(parsed.content)

  return {
    slug,
    title: frontmatter.title,
    excerpt: frontmatter.excerpt,
    publishedAt: frontmatter.publishedAt,
    publishedLabel: formatContentDate(frontmatter.publishedAt),
    category: frontmatter.category,
    tags: frontmatter.tags,
    authorName: frontmatter.authorName,
    authorRole: frontmatter.authorRole,
    featured: frontmatter.featured,
    draft: frontmatter.draft,
    coverImage: frontmatter.coverImage,
    likes: frontmatter.likes,
    comments: frontmatter.comments,
    readTimeMinutes: readTime.minutes,
    readTimeLabel: readTime.label,
    url: `/blog/${slug}`,
    searchText: normalizeWhitespace(
      [frontmatter.title, frontmatter.excerpt, frontmatter.category, frontmatter.tags.join(" ")].join(" "),
    ),
    body: parsed.content.trim(),
  }
}

function buildDocPage(filePath: string): DocPage {
  const sourcePath = toRelativeSourcePath(filePath)
  const relativePath = path.relative(DOCS_ROOT, filePath)
  const slugSegments = relativePath.replace(/\.md$/, "").split(path.sep)
  const categorySlug = slugSegments[0] as DocCategorySlug

  if (!DOC_CATEGORY_SLUGS.includes(categorySlug)) {
    throw new Error(`Kategori docs tidak dikenali untuk ${sourcePath}. Gunakan salah satu dari: ${DOC_CATEGORY_SLUGS.join(", ")}`)
  }

  if (slugSegments.length < 2) {
    throw new Error(`File docs harus berada minimal satu level di bawah kategori: ${sourcePath}`)
  }

  const raw = fs.readFileSync(filePath, "utf8")
  const parsed = matter(raw)
  const frontmatter = docFrontmatterSchema.parse(parsed.data, {
    path: [sourcePath],
  })
  const readTime = calculateReadTime(parsed.content)

  const page: DocPage = {
    slug: slugSegments[slugSegments.length - 1],
    slugSegments,
    title: frontmatter.title,
    description: frontmatter.description,
    category: frontmatter.category as DocCategoryTitle,
    categorySlug,
    order: frontmatter.order,
    featured: frontmatter.featured,
    quickLink: frontmatter.quickLink,
    popular: frontmatter.popular,
    faq: frontmatter.faq,
    updatedAt: frontmatter.updatedAt,
    updatedLabel: formatContentDate(frontmatter.updatedAt),
    draft: frontmatter.draft,
    viewsLabel: frontmatter.viewsLabel,
    readTimeMinutes: readTime.minutes,
    readTimeLabel: readTime.label,
    url: `/dokumentasi/${slugSegments.join("/")}`,
    searchText: normalizeWhitespace([frontmatter.title, frontmatter.description, parsed.content, frontmatter.category].join(" ")),
    body: parsed.content.trim(),
  }

  assertDocCategoryMatch(page)
  return page
}

function buildChangelogEntry(filePath: string): ChangelogEntry {
  const slug = path.basename(filePath, ".md")
  const sourcePath = toRelativeSourcePath(filePath)
  const raw = fs.readFileSync(filePath, "utf8")
  const parsed = matter(raw)
  const frontmatter = changelogFrontmatterSchema.parse(parsed.data, {
    path: [sourcePath],
  })
  const readTime = calculateReadTime(parsed.content)

  return {
    slug,
    title: frontmatter.title,
    summary: frontmatter.summary,
    publishedAt: frontmatter.publishedAt,
    publishedLabel: formatContentDate(frontmatter.publishedAt),
    type: frontmatter.type,
    productArea: frontmatter.productArea,
    draft: frontmatter.draft,
    body: parsed.content.trim(),
    readTimeMinutes: readTime.minutes,
    readTimeLabel: readTime.label,
    url: `/changelog#${slug}`,
  }
}

function buildStaticPage(filePath: string): StaticPage {
  const slug = path.basename(filePath, ".md")
  const sourcePath = toRelativeSourcePath(filePath)
  const raw = fs.readFileSync(filePath, "utf8")
  const parsed = matter(raw)
  const frontmatter = staticPageFrontmatterSchema.parse(parsed.data, {
    path: [sourcePath],
  })
  const readTime = calculateReadTime(parsed.content)

  return {
    slug,
    title: frontmatter.title,
    description: frontmatter.description,
    updatedAt: frontmatter.updatedAt,
    updatedLabel: formatContentDate(frontmatter.updatedAt),
    draft: frontmatter.draft,
    body: parsed.content.trim(),
    url: `/${slug}`,
    readTimeMinutes: readTime.minutes,
    readTimeLabel: readTime.label,
  }
}

const getContentIndex = cache(() => {
  const blogPosts = listMarkdownFiles(BLOG_ROOT)
    .map(buildBlogPost)
    .sort((left, right) => parseContentDate(right.publishedAt).getTime() - parseContentDate(left.publishedAt).getTime())

  const docs = listMarkdownFiles(DOCS_ROOT)
    .map(buildDocPage)
    .sort((left, right) => {
      if (left.categorySlug !== right.categorySlug) {
        return DOC_CATEGORY_SLUGS.indexOf(left.categorySlug) - DOC_CATEGORY_SLUGS.indexOf(right.categorySlug)
      }
      return left.order - right.order
    })

  const changelog = listMarkdownFiles(CHANGELOG_ROOT)
    .map(buildChangelogEntry)
    .sort((left, right) => parseContentDate(right.publishedAt).getTime() - parseContentDate(left.publishedAt).getTime())

  const staticPages = listMarkdownFiles(PAGES_ROOT)
    .map(buildStaticPage)
    .sort((left, right) => left.slug.localeCompare(right.slug))

  assertSingleFeaturedPost(blogPosts)

  const records: ContentRecord[] = [
    ...blogPosts.map((post) => ({
      sourcePath: path.join("content", "blog", `${post.slug}.md`),
      url: post.url,
      draft: post.draft,
      body: post.body,
      title: post.title,
    })),
    ...docs.map((doc) => ({
      sourcePath: path.join("content", "docs", ...doc.slugSegments) + ".md",
      url: doc.url,
      draft: doc.draft,
      body: doc.body,
      title: doc.title,
    })),
    ...changelog.map((entry) => ({
      sourcePath: path.join("content", "changelog", `${entry.slug}.md`),
      url: `/changelog/${entry.slug}`,
      draft: entry.draft,
      body: entry.body,
      title: entry.title,
    })),
    ...staticPages.map((page) => ({
      sourcePath: path.join("content", "pages", `${page.slug}.md`),
      url: page.url,
      draft: page.draft,
      body: page.body,
      title: page.title,
    })),
  ]

  assertUniqueRoutes(records)
  validateInternalLinks(records)

  return {
    blogPosts,
    docs,
    changelog,
    staticPages,
  }
})

function publishedOnly<T extends { draft: boolean }>(items: T[]): T[] {
  return items.filter((item) => !item.draft)
}

export function getBlogCategories(): string[] {
  const usedCategories = new Set(publishedOnly(getContentIndex().blogPosts).map((post) => post.category))
  return ["Semua", ...BLOG_CATEGORY_ORDER.filter((category) => usedCategories.has(category))]
}

export function getAllBlogPosts(): BlogPost[] {
  return publishedOnly(getContentIndex().blogPosts)
}

export function getFeaturedBlogPost(): BlogPost | null {
  const posts = getAllBlogPosts()
  return posts.find((post) => post.featured) ?? posts[0] ?? null
}

export function getBlogPostBySlug(slug: string): BlogPost | null {
  return getAllBlogPosts().find((post) => post.slug === slug) ?? null
}

export function getRelatedBlogPosts(slug: string, limit = 3): BlogPostMeta[] {
  const posts = getAllBlogPosts()
  const currentPost = posts.find((post) => post.slug === slug)
  if (!currentPost) {
    return []
  }

  return posts
    .filter((post) => post.slug !== slug)
    .map((post) => {
      const sharedTags = post.tags.filter((tag) => currentPost.tags.includes(tag)).length
      const sameCategory = post.category === currentPost.category ? 1 : 0
      return { post, score: sharedTags * 10 + sameCategory * 3 }
    })
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score
      }
      return parseContentDate(right.post.publishedAt).getTime() - parseContentDate(left.post.publishedAt).getTime()
    })
    .slice(0, limit)
    .map(({ post }) => post)
}

export function getAllDocPages(): DocPage[] {
  return publishedOnly(getContentIndex().docs)
}

export function getDocPageBySlugSegments(segments: string[]): DocPage | null {
  return getAllDocPages().find((doc) => doc.slugSegments.join("/") === segments.join("/")) ?? null
}

export function getDocSiblingPages(page: DocPage, limit = 3): DocPageMeta[] {
  return getAllDocPages()
    .filter((doc) => doc.categorySlug === page.categorySlug && doc.slug !== page.slug && !doc.faq)
    .sort((left, right) => left.order - right.order)
    .slice(0, limit)
}

export function getDocLandingData(selectedCategory?: string | null) {
  const docs = getAllDocPages()
  const categoryFilter = DOC_CATEGORY_SLUGS.includes(selectedCategory as DocCategorySlug)
    ? (selectedCategory as DocCategorySlug)
    : null

  const categories: DocLandingCategory[] = DOC_CATEGORY_SLUGS
    .filter((slug) => !categoryFilter || slug === categoryFilter)
    .map((slug) => ({
      slug,
      title: DOC_CATEGORY_CONFIG[slug].title,
      description: DOC_CATEGORY_CONFIG[slug].description,
      icon: DOC_CATEGORY_CONFIG[slug].icon,
      color: DOC_CATEGORY_CONFIG[slug].color,
      bgColor: DOC_CATEGORY_CONFIG[slug].bgColor,
      articles: docs
        .filter((doc) => doc.categorySlug === slug && !doc.faq)
        .sort((left, right) => left.order - right.order),
    }))

  return {
    categories,
    quickLinks: docs
      .filter((doc) => doc.quickLink && !doc.faq)
      .sort((left, right) => left.order - right.order),
    faqs: docs
      .filter((doc) => doc.faq)
      .sort((left, right) => {
        if (left.categorySlug !== right.categorySlug) {
          return DOC_CATEGORY_SLUGS.indexOf(left.categorySlug) - DOC_CATEGORY_SLUGS.indexOf(right.categorySlug)
        }
        return left.order - right.order
      }),
    popularArticles: docs
      .filter((doc) => doc.popular && !doc.faq)
      .sort((left, right) => left.order - right.order),
  }
}

export function getChangelogEntries(): ChangelogEntry[] {
  return publishedOnly(getContentIndex().changelog)
}

export function getStaticPageBySlug(slug: string): StaticPage | null {
  return publishedOnly(getContentIndex().staticPages).find((page) => page.slug === slug) ?? null
}

export function getAllStaticPages(): StaticPage[] {
  return publishedOnly(getContentIndex().staticPages)
}
