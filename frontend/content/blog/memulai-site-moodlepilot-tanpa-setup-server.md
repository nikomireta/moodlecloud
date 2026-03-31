---
title: Memulai Site Moodlepilot Tanpa Setup Server dari Nol
excerpt: Panduan ringkas untuk membuat site Moodle pertama di Moodlepilot, mulai dari pilih paket sampai site aktif dan siap diakses admin.
publishedAt: 2026-03-30
category: Tutorial
tags:
  - Moodlepilot
  - Provisioning
  - Pemula
  - LMS
authorName: Tim Moodlepilot
authorRole: Product Team
featured: true
coverImage: /content-covers/memulai-site-moodlepilot.svg
draft: false
likes: 184
comments: 23
---

Moodlepilot dirancang untuk memangkas pekerjaan teknis yang biasanya muncul sebelum LMS bisa dipakai. Anda tidak perlu menyiapkan server, memasang image Moodle secara manual, atau menyusun langkah provisioning sendiri dari awal.

## Alur singkat yang perlu dipahami

Saat membuka halaman [Buat Situs](/buat-situs), ada tiga keputusan utama yang perlu Anda siapkan:

1. Nama site yang mudah dikenali tim Anda.
2. Subdomain yang akan dipakai saat fase awal.
3. Paket yang paling dekat dengan kebutuhan pengguna aktif dan storage.

Setelah form dikirim, sistem akan membuat job provisioning dan Anda akan diarahkan ke halaman progres. Di fase ini, status belum selalu langsung `active`, jadi biasakan memeriksa tahapan pembuatan sampai site benar-benar siap.

## Sebelum klik tombol buat

Ada beberapa hal yang sebaiknya disiapkan lebih dulu:

- Nama admin utama dan email aktif untuk menerima akses awal.
- Estimasi pengguna aktif, bukan total akun sepanjang masa.
- Rencana domain: cukup subdomain bawaan dulu atau langsung siapkan domain institusi.

Kalau Anda masih bimbang di soal paket, baca dulu panduan [memilih paket dan memahami quota](/dokumentasi/pembuatan-situs-dan-domain/memilih-paket-dan-memahami-quota).

## Apa yang terjadi setelah provisioning selesai

Begitu site aktif, ada beberapa langkah operasional yang biasanya langsung dikerjakan:

- masuk ke halaman detail site untuk melihat status runtime
- membuka tautan admin access agar admin Moodle bisa masuk lebih cepat
- mengecek backup default dan kebijakan retensi
- mulai menghubungkan custom domain jika diperlukan

Di Moodlepilot, langkah-langkah itu tidak tersebar ke banyak tool. Sebagian besar bisa diakses dari halaman site yang sama.

## Kapan perlu pindah dari subdomain ke domain sendiri

Untuk tahap pilot project, subdomain bawaan biasanya cukup. Begitu LMS mulai dipakai lintas kelas, lembaga, atau semester, domain sendiri membantu branding dan mengurangi kebingungan pengguna.

Panduan lengkapnya sudah kami siapkan di [dokumentasi custom domain](/dokumentasi/pembuatan-situs-dan-domain/menghubungkan-custom-domain).

## Kesalahan awal yang paling sering terjadi

Kesalahan paling umum bukan di sisi teknis, melainkan di asumsi kapasitas. Banyak tim memilih paket dari jumlah akun total, padahal yang lebih penting adalah pengguna aktif dan kebutuhan storage. Ini berpengaruh ke quota monitoring, keputusan upgrade, dan ritme backup.

Jika Anda ingin memahami sisi operasional setelah site aktif, lanjutkan ke [panduan runtime dan admin access](/dokumentasi/operasional-dan-runtime/memahami-status-runtime-dan-admin-access).
