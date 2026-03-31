import type { MetadataRoute } from "next"

import { buildAbsoluteURL } from "@/lib/seo"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dashboard",
        "/notifikasi",
        "/profil",
        "/proses-pembuatan/",
        "/reset-password",
        "/situs/",
        "/situs-berhasil/",
        "/tagihan",
        "/verifikasi-email",
      ],
    },
    sitemap: buildAbsoluteURL("/sitemap.xml"),
  }
}
