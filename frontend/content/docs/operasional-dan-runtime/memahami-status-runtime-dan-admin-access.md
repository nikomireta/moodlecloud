---
title: Memahami Status Runtime dan Admin Access
description: Panduan membaca kesehatan runtime site, kapan perlu intervensi, dan cara membuka admin access dengan aman.
category: Operasional & Runtime
order: 1
featured: true
quickLink: false
popular: false
faq: false
updatedAt: 2026-03-29
draft: false
---

Setelah site aktif, dua area yang paling sering dipakai admin adalah status runtime dan admin access. Keduanya membantu memastikan site bisa diawasi sekaligus dioperasikan tanpa lompat ke banyak tool.

## Cara membaca runtime

Status runtime membantu Anda melihat apakah layanan utama site berada dalam kondisi:

- running
- degraded
- stopped
- failed

Gunakan status ini bersama error terakhir jika tersedia. Jangan hanya melihat badge tanpa membaca konteksnya.

## Kapan admin access dipakai

Admin access berguna ketika tim perlu masuk ke area administrasi Moodle dengan jalur yang lebih cepat. Biasanya dipakai untuk:

- pemeriksaan awal setelah provisioning
- validasi konfigurasi site
- pengecekan plugin laporan atau setting Moodle tertentu

## Praktik yang disarankan

- gunakan admin access hanya untuk orang yang memang bertanggung jawab
- catat perubahan besar yang dilakukan setelah masuk
- siapkan backup sebelum eksperimen yang berisiko

Jika Anda perlu mengubah status layanan, lanjutkan ke [panduan start, stop, dan restart runtime](/dokumentasi/operasional-dan-runtime/start-stop-restart-situs).
