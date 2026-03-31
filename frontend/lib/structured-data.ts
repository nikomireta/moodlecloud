import { buildAbsoluteURL, SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo"

type BreadcrumbItem = {
  name: string
  path: string
}

type ArticleStructuredDataOptions = {
  title: string
  description: string
  path: string
  datePublished?: string
  dateModified?: string
  authorName: string
  imagePath?: string
  type?: "Article" | "TechArticle"
}

type WebPageStructuredDataOptions = {
  title: string
  description: string
  path: string
  dateModified?: string
}

type FAQEntry = {
  question: string
  answer: string
}

type CollectionItem = {
  name: string
  path: string
  description?: string
  datePublished?: string
  dateModified?: string
}

type CollectionPageStructuredDataOptions = {
  title: string
  description: string
  path: string
  items: CollectionItem[]
  type?: "CollectionPage" | "Blog"
}

function stripMarkdown(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\(([^)]+)\)/g, " ")
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^[*-]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/[*_#>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function createWebsiteStructuredData() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: buildAbsoluteURL("/"),
    potentialAction: {
      "@type": "SearchAction",
      target: `${buildAbsoluteURL("/blog")}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  }
}

export function createOrganizationStructuredData() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: buildAbsoluteURL("/"),
    logo: buildAbsoluteURL("/icon.svg"),
  }
}

export function createBreadcrumbStructuredData(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: buildAbsoluteURL(item.path),
    })),
  }
}

export function createArticleStructuredData({
  title,
  description,
  path,
  datePublished,
  dateModified,
  authorName,
  imagePath,
  type = "Article",
}: ArticleStructuredDataOptions) {
  return {
    "@context": "https://schema.org",
    "@type": type,
    headline: title,
    description,
    url: buildAbsoluteURL(path),
    ...(datePublished ? { datePublished } : {}),
    ...(dateModified ? { dateModified } : {}),
    author: {
      "@type": "Person",
      name: authorName,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: buildAbsoluteURL("/icon.svg"),
      },
    },
    ...(imagePath
      ? {
          image: [buildAbsoluteURL(imagePath)],
        }
      : {}),
  }
}

export function createWebPageStructuredData({
  title,
  description,
  path,
  dateModified,
}: WebPageStructuredDataOptions) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    url: buildAbsoluteURL(path),
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: buildAbsoluteURL("/"),
    },
    ...(dateModified ? { dateModified } : {}),
  }
}

export function createFAQPageStructuredData(path: string, entries: FAQEntry[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url: buildAbsoluteURL(path),
    mainEntity: entries.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: stripMarkdown(entry.answer),
      },
    })),
  }
}

export function createCollectionPageStructuredData({
  title,
  description,
  path,
  items,
  type = "CollectionPage",
}: CollectionPageStructuredDataOptions) {
  return {
    "@context": "https://schema.org",
    "@type": type,
    name: title,
    description,
    url: buildAbsoluteURL(path),
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: buildAbsoluteURL("/"),
    },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: items.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: buildAbsoluteURL(item.path),
        name: item.name,
        ...(item.description ? { description: item.description } : {}),
        ...(item.datePublished ? { datePublished: item.datePublished } : {}),
        ...(item.dateModified ? { dateModified: item.dateModified } : {}),
      })),
    },
  }
}
