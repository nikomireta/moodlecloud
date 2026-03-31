---
title: Start, Stop, dan Restart Situs
description: Kapan kontrol runtime perlu dipakai, apa bedanya start, stop, restart, dan langkah aman sebelum menjalankannya.
category: Operasional & Runtime
order: 2
featured: false
quickLink: false
popular: false
faq: false
updatedAt: 2026-03-27
draft: false
---

Kontrol runtime sebaiknya dipakai dengan tujuan yang jelas. Tombol start, stop, dan restart memang sederhana, tetapi setiap aksi punya dampak ke akses pengguna.

## Perbedaan utama

- `start` dipakai saat layanan sedang berhenti dan perlu diaktifkan
- `stop` dipakai saat layanan perlu dihentikan sementara
- `restart` dipakai saat layanan masih hidup tetapi perlu dimulai ulang

## Sebelum menjalankan aksi runtime

Pastikan Anda sudah mengecek:

1. apakah ada kelas atau aktivitas yang sedang berlangsung
2. apakah tindakan ini benar-benar perlu
3. apakah perlu membuat backup manual lebih dulu

## Setelah aksi dijalankan

Pantau perubahan status runtime beberapa saat. Moodlepilot akan memperbarui status operasional agar Anda bisa melihat apakah layanan sudah kembali sehat.

Kalau site sering perlu intervensi runtime, sebaiknya audit juga backup, quota, dan plugin yang aktif.
