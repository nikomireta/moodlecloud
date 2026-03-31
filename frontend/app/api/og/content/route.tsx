import type { NextRequest } from "next/server"
import { ImageResponse } from "next/og"

import { getBlogPostBySlug, getDocPageBySlugSegments, getStaticPageBySlug } from "@/lib/content"
import { SITE_NAME } from "@/lib/seo"

const IMAGE_SIZE = {
  width: 1200,
  height: 630,
} as const

type OGPayload = {
  eyebrow: string
  title: string
  description: string
  meta: string
  accent: string
}

function getDefaultPayload(): OGPayload {
  return {
    eyebrow: "Moodlepilot Indonesia",
    title: "Konten, dokumentasi, dan update produk Moodlepilot",
    description:
      "Panduan, artikel, changelog, dan halaman bantuan Moodlepilot dalam bahasa Indonesia untuk operasional LMS yang lebih rapi.",
    meta: "Blog • Dokumentasi • Changelog • Dukungan",
    accent: "#2563eb",
  }
}

function resolvePayload(request: NextRequest): OGPayload {
  const kind = request.nextUrl.searchParams.get("kind")
  const slug = request.nextUrl.searchParams.get("slug")

  if (kind === "blog") {
    if (!slug) {
      return {
        eyebrow: "Blog Moodlepilot",
        title: "Artikel, tutorial, dan studi kasus operasional Moodle",
        description:
          "Kumpulan artikel Moodlepilot dalam bahasa Indonesia untuk membantu tim institusi menyiapkan, menjalankan, dan merapikan operasional LMS.",
        meta: "Tutorial • Tips & Trik • Update • Studi Kasus",
        accent: "#0f766e",
      }
    }

    const post = getBlogPostBySlug(slug)

    if (post) {
      return {
        eyebrow: `Blog • ${post.category}`,
        title: post.title,
        description: post.excerpt,
        meta: `${post.authorName} • ${post.publishedLabel} • ${post.readTimeLabel}`,
        accent: "#0f766e",
      }
    }
  }

  if (kind === "docs") {
    if (!slug) {
      return {
        eyebrow: "Dokumentasi Moodlepilot",
        title: "Pusat bantuan untuk setup, operasional, backup, dan laporan",
        description:
          "Dokumentasi Moodlepilot dalam bahasa Indonesia untuk memulai, mengelola site, membaca laporan, dan menjaga operasional harian tetap rapi.",
        meta: "Memulai • Domain • Runtime • Backup • Analytics • Billing",
        accent: "#2563eb",
      }
    }

    const page = getDocPageBySlugSegments(slug.split("/"))

    if (page) {
      return {
        eyebrow: `Dokumentasi • ${page.category}`,
        title: page.title,
        description: page.description,
        meta: `Diperbarui ${page.updatedLabel} • ${page.readTimeLabel}`,
        accent: "#2563eb",
      }
    }
  }

  if (kind === "changelog") {
    return {
      eyebrow: "Changelog Moodlepilot",
      title: "Catatan rilis fitur, peningkatan, dan perbaikan produk",
      description:
        "Ringkasan perubahan produk Moodlepilot yang relevan untuk operasional LMS, mulai dari fitur baru sampai perbaikan alur kerja.",
      meta: "Fitur Baru • Peningkatan • Perbaikan",
      accent: "#c2410c",
    }
  }

  if (kind === "page" && slug) {
    const page = getStaticPageBySlug(slug)

    if (page) {
      return {
        eyebrow: "Informasi Moodlepilot",
        title: page.title,
        description: page.description,
        meta: `Diperbarui ${page.updatedLabel} • ${page.readTimeLabel}`,
        accent: "#334155",
      }
    }
  }

  return getDefaultPayload()
}

export async function GET(request: NextRequest) {
  const payload = resolvePayload(request)

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          position: "relative",
          background: "linear-gradient(135deg, #f8fafc 0%, #eef2ff 45%, #eff6ff 100%)",
          color: "#0f172a",
          padding: "56px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "28px",
            borderRadius: "28px",
            border: "1px solid rgba(15, 23, 42, 0.12)",
            background: "rgba(255, 255, 255, 0.82)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "28px",
            right: "28px",
            width: "240px",
            height: "240px",
            borderRadius: "9999px",
            background: `radial-gradient(circle, ${payload.accent}22 0%, transparent 70%)`,
          }}
        />
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            height: "100%",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "920px" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                alignSelf: "flex-start",
                borderRadius: "9999px",
                border: `1px solid ${payload.accent}33`,
                background: `${payload.accent}12`,
                color: payload.accent,
                fontSize: "24px",
                fontWeight: 700,
                padding: "12px 20px",
              }}
            >
              {payload.eyebrow}
            </div>
            <div
              style={{
                fontSize: "66px",
                lineHeight: 1.05,
                fontWeight: 800,
                letterSpacing: "-0.04em",
                display: "flex",
                textWrap: "balance",
              }}
            >
              {payload.title}
            </div>
            <div
              style={{
                fontSize: "28px",
                lineHeight: 1.45,
                color: "#334155",
                display: "flex",
                textWrap: "balance",
                maxWidth: "940px",
              }}
            >
              {payload.description}
            </div>
          </div>

          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
              }}
            >
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "16px",
                  background: "#0f172a",
                  color: "#f8fafc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "28px",
                  fontWeight: 800,
                }}
              >
                M
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ fontSize: "26px", fontWeight: 700 }}>{SITE_NAME}</div>
                <div style={{ fontSize: "22px", color: "#475569" }}>{payload.meta}</div>
              </div>
            </div>

            <div
              style={{
                width: "180px",
                height: "10px",
                borderRadius: "9999px",
                background: `linear-gradient(90deg, ${payload.accent} 0%, rgba(255,255,255,0) 100%)`,
              }}
            />
          </div>
        </div>
      </div>
    ),
    IMAGE_SIZE,
  )
}
