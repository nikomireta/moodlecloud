---
title: Menghubungkan Custom Domain ke Situs Moodlepilot
excerpt: Langkah praktis untuk mengalihkan site dari subdomain bawaan ke domain institusi dengan lebih rapi dan minim kebingungan pengguna.
publishedAt: 2026-03-21
category: Tutorial
tags:
  - Custom Domain
  - DNS
  - Branding
  - Moodlepilot
authorName: Bayu Ramadhan
authorRole: Technical Writer
coverImage: /content-covers/custom-domain.svg
draft: false
likes: 109
comments: 10
---

Subdomain bawaan sangat membantu saat fase awal, tetapi pada titik tertentu institusi biasanya ingin memakai domain sendiri agar lebih konsisten secara branding.

## Kapan waktu yang tepat untuk beralih

Biasanya custom domain mulai relevan ketika:

- LMS sudah dipakai lebih dari satu cohort atau semester
- akses pengguna berasal dari publik luas
- institusi ingin URL yang lebih mudah diingat

Kalau site Anda masih dalam tahap uji coba internal, subdomain bawaan biasanya masih cukup.

## Apa saja yang perlu disiapkan

Sebelum mengubah domain, siapkan:

1. nama host yang akan dipakai, misalnya `lms.namadomain.ac.id`
2. akses ke panel DNS
3. tim yang bisa menguji akses setelah perubahan aktif

Di sisi Moodlepilot, pengelolaan custom domain dilakukan dari area settings site. Artinya, perubahan domain tidak perlu dikelola terpisah dari workflow operasional lain.

## Urutan kerja yang aman

- pastikan site sudah aktif dan sehat
- lakukan konfigurasi DNS sesuai kebutuhan domain Anda
- simpan konfigurasi custom domain pada site
- tunggu propagasi lalu uji dari sisi pengguna

Panduan teknis yang lebih sistematis ada di [dokumentasi custom domain](/dokumentasi/pembuatan-situs-dan-domain/menghubungkan-custom-domain).

## Setelah domain aktif

Begitu domain aktif, ada baiknya Anda memperbarui:

- materi onboarding internal
- shortcut yang dipakai trainer atau dosen
- notifikasi atau template komunikasi ke peserta

Jika Anda juga sedang merapikan kontrol operasional site, lanjutkan ke [panduan runtime dan admin access](/dokumentasi/operasional-dan-runtime/memahami-status-runtime-dan-admin-access).
