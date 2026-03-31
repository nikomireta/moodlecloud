---
title: Menghubungkan Plugin Laporan Moodlepilot
description: Cara memahami alur plugin laporan, auto-bootstrap pada tenant baru, dan koneksi manual untuk skenario tertentu.
category: Laporan & Analytics
order: 1
featured: true
quickLink: false
popular: false
faq: false
updatedAt: 2026-03-29
draft: false
---

Plugin laporan Moodlepilot adalah fondasi analytics di dalam tenant Moodle yang dikelola. Ia bertugas mengirim snapshot dan data sinyal penting ke backend Moodlepilot agar report bisa dibaca dari dashboard utama.

## Dua mode koneksi yang perlu dipahami

Untuk tenant yang dibuat oleh Moodlepilot, koneksi plugin umumnya mengikuti pola auto-bootstrap. Pada mode ini, provisioning menyiapkan konteks yang diperlukan agar plugin bisa mendaftar otomatis.

Untuk skenario lain, arah produk juga menyiapkan model koneksi manual.

## Alur data singkat

Secara garis besar, alurnya seperti ini:

1. plugin menerima konteks koneksi
2. data event dan tracking dikumpulkan
3. snapshot disusun
4. snapshot dikirim ke backend Moodlepilot
5. dashboard membaca hasilnya sebagai summary dan detail report

## Kapan admin perlu mengecek koneksi

Periksa koneksi jika:

- report tidak menunjukkan data terbaru
- site baru selesai provisioning tetapi snapshot belum terlihat
- Anda sedang memeriksa status plugin setelah perubahan tertentu

Setelah koneksi aktif, lanjutkan ke [panduan membaca ringkasan laporan dan export CSV](/dokumentasi/laporan-dan-analytics/membaca-ringkasan-laporan-dan-export-csv).
