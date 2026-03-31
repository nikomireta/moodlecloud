import type { Metadata } from "next"

import { BlogPageClient } from "@/components/content/blog-page-client"
import { StructuredData } from "@/components/seo/structured-data"
import { getAllBlogPosts, getBlogCategories, getFeaturedBlogPost } from "@/lib/content"
import { RSS_FEED_PATH, buildAbsoluteURL, buildContentOGImagePath, createContentMetadata } from "@/lib/seo"
import { createCollectionPageStructuredData } from "@/lib/structured-data"

const pageMetadata = createContentMetadata({
  title: "Blog & Knowledge Base",
  description: "Kumpulan artikel, tutorial, tips, update produk, dan studi kasus Moodlepilot dalam bahasa Indonesia.",
  pathname: "/blog",
  keywords: ["blog Moodlepilot", "tutorial Moodle", "knowledge base LMS", "e-learning Indonesia"],
  imagePath: buildContentOGImagePath("blog"),
})

export const metadata: Metadata = {
  ...pageMetadata,
  alternates: {
    ...pageMetadata.alternates,
    types: {
      "application/rss+xml": buildAbsoluteURL(RSS_FEED_PATH),
    },
  },
}

export default function BlogPage() {
  const featuredPost = getFeaturedBlogPost()
  const posts = getAllBlogPosts().filter((post) => post.slug !== featuredPost?.slug)
  const structuredPosts = (featuredPost ? [featuredPost, ...posts] : posts).slice(0, 12)

  return (
    <>
      <StructuredData
        data={createCollectionPageStructuredData({
          title: "Blog & Knowledge Base",
          description: "Kumpulan artikel, tutorial, tips, update produk, dan studi kasus Moodlepilot dalam bahasa Indonesia.",
          path: "/blog",
          type: "Blog",
          items: structuredPosts.map((post) => ({
            name: post.title,
            path: post.url,
            description: post.excerpt,
            datePublished: post.publishedAt,
          })),
        })}
      />
      <BlogPageClient
        categories={getBlogCategories()}
        featuredPost={featuredPost}
        posts={posts}
      />
    </>
  )
}
