# Content Authoring Guide

Semua konten editorial publik Moodlepilot disimpan sebagai file Markdown di folder ini.

## Struktur Folder

Gunakan struktur berikut:

```text
content/
  blog/*.md
  docs/<kategori>/<slug>.md
  changelog/*.md
  pages/*.md
```

Kategori dokumentasi yang valid:

- `memulai`
- `pembuatan-situs-dan-domain`
- `operasional-dan-runtime`
- `backup-dan-pemulihan`
- `laporan-dan-analytics`
- `akun-billing-dan-keamanan`

## Aturan Umum

- Gunakan file `.md`, bukan `.mdx`.
- Nama file menjadi slug URL. Gunakan huruf kecil dan tanda hubung.
- Tulis seluruh isi konten dalam bahasa Indonesia.
- Jangan menambahkan komponen React atau HTML khusus di Markdown.
- Gunakan link internal dengan path absolut, misalnya `/blog/...` atau `/dokumentasi/...`.
- Untuk halaman legal dan support, gunakan file di `content/pages/*.md`.
- Jangan tautkan artikel publish ke konten `draft: true`.

## Frontmatter Blog

Contoh:

```yaml
---
title: Judul artikel
excerpt: Ringkasan pendek artikel
publishedAt: 2026-03-30
category: Tutorial
tags:
  - Moodlepilot
  - Provisioning
authorName: Tim Moodlepilot
authorRole: Product Team
featured: false
draft: false
coverImage: /blog/nama-gambar.jpg
likes: 0
comments: 0
---
```

Field wajib:

- `title`
- `excerpt`
- `publishedAt`
- `category`
- `tags`
- `authorName`
- `authorRole`

Kategori blog yang valid:

- `Tutorial`
- `Tips & Trik`
- `Update`
- `Studi Kasus`
- `Berita`

## Frontmatter Dokumentasi

Contoh:

```yaml
---
title: Judul artikel docs
description: Ringkasan isi docs
category: Memulai
order: 1
featured: false
quickLink: false
popular: false
faq: false
updatedAt: 2026-03-30
viewsLabel: 1.2k views
draft: false
---
```

Field wajib:

- `title`
- `description`
- `category`
- `order`
- `updatedAt`

Catatan penting:

- Nilai `category` harus cocok dengan folder kategori.
- `faq: true` dipakai untuk entri FAQ di landing dokumentasi.
- `quickLink: true` dipakai untuk badge cepat di halaman `/dokumentasi`.
- `popular: true` dipakai untuk blok artikel populer.

## Frontmatter Changelog

Contoh:

```yaml
---
title: Nama rilis
summary: Ringkasan perubahan
publishedAt: 2026-03-30
type: fitur-baru
productArea: Laporan & Analytics
draft: false
---
```

Field wajib:

- `title`
- `summary`
- `publishedAt`
- `type`
- `productArea`

Nilai `type` yang valid:

- `fitur-baru`
- `peningkatan`
- `perbaikan`

## Frontmatter Halaman Statis

Contoh:

```yaml
---
title: Judul halaman
description: Ringkasan singkat halaman
updatedAt: 2026-03-30
draft: false
---
```

Digunakan untuk halaman publik berbasis Markdown seperti:

- `/kontak`
- `/tentang`
- `/dukungan`
- `/faq`
- `/kebijakan-privasi`
- `/syarat-layanan`

## Checklist Sebelum Publish

Sebelum commit konten baru:

1. Pastikan slug file sudah rapi dan final.
2. Pastikan frontmatter lengkap dan tidak typo.
3. Pastikan link internal mengarah ke route yang benar.
4. Pastikan `draft: false` hanya dipakai untuk konten yang siap tampil publik.
5. Jalankan:

```bash
cd frontend
pnpm exec tsc --noEmit
pnpm exec next build --webpack
```

Build akan gagal jika:

- frontmatter wajib tidak ada
- slug bentrok
- link internal tidak valid
- artikel publish menaut ke draft
