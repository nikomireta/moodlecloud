# Plan Plugin `local_moodlepilot_report`

## Tujuan Dokumen

Dokumen ini adalah referensi utama untuk desain plugin laporan Moodlepilot, dengan nama target `local_moodlepilot_report`.

Dokumen ini merangkum hasil studi terhadap `intelliboard-refrensi`, menjelaskan apa saja yang ditampilkan, bagaimana plugin referensi bekerja, lalu menerjemahkannya menjadi keputusan arsitektur untuk Moodlepilot.

Dokumen ini adalah `living reference`. Setiap keputusan baru terkait fitur laporan harus konsisten dengan baseline di sini, atau memperbarui dokumen ini secara eksplisit.

## Keputusan Yang Sudah Dikunci

- `intelliboard-refrensi` dipakai sebagai referensi suite analytics penuh, bukan template yang disalin mentah.
- Data flow utama `moodlepilot-report` adalah plugin `push` aggregate ke backend Moodlepilot.
- Otorisasi plugin untuk site yang dibuat lewat Moodlepilot harus otomatis, bukan authorize manual seperti IntelliBoard.
- Consumer awal data plugin adalah tab `Laporan` pada halaman detail situs.
- Tab `Laporan` boleh dirombak total dan harus mengikuti dataset plugin, bukan mockup lama.
- Bentuk `Laporan` v1 adalah `plugin-first summary`.
- Laporan yang lebih berat, lebih kompleks, dan lebih eksploratif akan dipindah ke halaman laporan khusus.

## Bedah Referensi IntelliBoard

### Identitas Plugin

Plugin referensi adalah plugin Moodle bertipe `local` dengan component `local_intelliboard`.

Referensi utamanya terlihat di:

- `intelliboard-refrensi/version.php`
- `intelliboard-refrensi/lib.php`
- `intelliboard-refrensi/locallib.php`
- `intelliboard-refrensi/db/install.xml`
- `intelliboard-refrensi/db/services.php`
- `intelliboard-refrensi/db/events.php`
- `intelliboard-refrensi/db/tasks.php`

### Area Utama Yang Dimiliki

Plugin referensi bukan hanya halaman laporan sederhana. Ia adalah analytics suite yang besar, dengan area-area berikut:

- admin dashboard
- reports
- monitors
- student dashboard
- instructor dashboard
- competency reports
- SQL reports
- attendance
- notifications
- beberapa integrasi tambahan seperti BigBlueButton, LTI, transcript, dan lain-lain

### Dua Pola Besar Yang Dipakai

#### 1. Laporan Lokal

Sebagian laporan dijalankan langsung di dalam Moodle.

Pola ini terlihat pada:

- `initial_report.php`
- `classes/output/initial_report.php`
- `classes/output/tables/initial_reports/report1.php`
- `classes/output/tables/initial_reports/report3.php`
- `classes/output/tables/initial_reports/report45.php`

Laporan jenis ini query langsung ke:

- tabel inti Moodle
- tabel tracking milik plugin sendiri seperti `local_intelliboard_tracking`, `local_intelliboard_logs`, `local_intelliboard_details`, dan `local_intelliboard_totals`

#### 2. Laporan Eksternal

Sebagian besar halaman reports pada plugin referensi sebenarnya meng-embed report dari layanan IntelliBoard SaaS melalui `iframe`.

Pola ini terlihat pada:

- `reports.php`
- `student/reports.php`
- `instructor/reports.php`
- `competencies/reports.php`
- `locallib.php` pada fungsi `intelliboard_url()` dan `intelliboard()`

Alurnya:

- plugin meminta token atau metadata ke layanan IntelliBoard
- plugin membangun URL report eksternal
- UI Moodle hanya menjadi container `iframe`

Ini penting karena berarti referensi ini bukan plugin laporan lokal murni.

## Apa Yang Ditampilkan Plugin Referensi

### Output Yang Relevan Untuk Moodlepilot

Dari sudut pandang Moodlepilot, hal paling relevan yang ditampilkan plugin referensi adalah:

- user status
- activity stats summary
- quiz activity detail
- progress completion
- visits
- time spent
- grade atau score
- aktivitas per user
- aktivitas per module
- aktivitas per course

### Contoh Laporan Lokal Yang Nyata

#### `User Status`

Terlihat di `classes/output/tables/initial_reports/report1.php`.

Data utama:

- nama depan
- nama belakang
- username
- email
- course name
- course short name
- enrolment method
- score
- status completion
- tanggal enrolled

Makna produk:

- status belajar user lintas kursus
- progress completion per enrolment
- kombinasi data enrollment, grade, dan completion

#### `Activity Stats Summary`

Terlihat di `classes/output/tables/initial_reports/report3.php`.

Data utama:

- course
- activity
- module type
- jumlah user yang menyelesaikan activity
- jumlah visits
- total time spent
- average score
- created date
- first access

Makna produk:

- performa aktivitas per modul
- intensitas kunjungan
- waktu belajar
- indikasi keberhasilan atau engagement activity

#### `Quiz Activity Detail`

Terlihat di `classes/output/tables/initial_reports/report45.php`.

Data utama:

- quiz name
- course
- nama user
- email
- jumlah attempts
- total time spent
- highest grade
- lowest grade
- status completion atau completion timestamp

Makna produk:

- kedalaman aktivitas kuis
- performa dan variasi attempt
- durasi pengerjaan

### Role-Based Reports

Selain report admin/system, referensi juga punya report surface terpisah untuk:

- admin
- instructor
- student
- competency

Artinya referensi ini memang dibangun untuk tumbuh menjadi suite analytics multi-role, bukan sekadar satu halaman laporan.

## Cara Kerja Plugin Referensi

### Tracking Aktivitas

Plugin referensi mengumpulkan data aktivitas melalui kombinasi:

- JS di sisi browser
- AJAX periodik
- cookie untuk menyimpan context page/module
- fungsi PHP `local_intelliboard_insert_tracking()`

Pola ini terlihat terutama di:

- `lib.php`
- `ajax.php`
- `module.js`
- `amd/src/tracking.js`

Data yang direkam meliputi:

- user
- course
- page type
- module param
- visits
- time spent
- first access
- last access
- user agent
- OS
- language
- IP

### Observer Event

Plugin referensi juga menangkap event Moodle untuk melengkapi data analytics dan automation.

Pola ini terlihat di:

- `db/events.php`
- `classes/observer.php`

Event yang dipantau antara lain:

- login
- role assigned
- role unassigned
- enrolment created
- course completed
- grading
- quiz submission
- assignment submission
- forum post created
- resource viewed

Maknanya:

- analytics tidak hanya bergantung pada page tracking
- event penting dari lifecycle belajar juga ikut masuk

### Scheduled Task

Referensi memiliki scheduled task untuk memproses tracking yang dikompresi atau ditunda.

Pola ini terlihat di:

- `db/tasks.php`
- `classes/task/import_tracking_process.php`
- `classes/tools/compress_tracking.php`
- `classes/repositories/tracking_cache_storage.php`
- `classes/repositories/tracking_file_storage.php`

Maknanya:

- plugin referensi mendukung alur ingest lalu kompresi atau flush
- sebagian data tidak selalu ditulis secara final pada request user yang sama

### Tabel Lokal Plugin

Tabel penting di `db/install.xml` meliputi:

- `local_intelliboard_tracking`
- `local_intelliboard_logs`
- `local_intelliboard_details`
- `local_intelliboard_totals`
- `local_intelliboard_ntf`
- `local_intelliboard_ntf_pms`
- `local_intelliboard_ntf_hst`
- `local_intelliboard_reports`

Makna praktisnya:

- tracking mentah dan aggregate harian atau per jam disimpan lokal
- plugin punya storage sendiri untuk analytics
- plugin juga punya layer SQL report tersendiri

### Web Service Dan External Functions

Referensi menyediakan banyak external functions untuk menjalankan report dan operasi data.

Pola ini terlihat di:

- `db/services.php`
- `classes/reportlib.php`
- `classes/external_functions.php`

Yang penting untuk dicatat:

- report bisa dieksekusi lewat web service
- ada pola report runner dan query abstraction
- surface API internal plugin cukup besar

### Yang Tidak Akan Kita Tiru

Hal paling penting dari studi ini adalah membedakan apa yang patut diadopsi dan apa yang justru harus dihindari.

Bagian yang tidak akan kita tiru untuk Moodlepilot:

- embed report dengan `iframe` ke SaaS IntelliBoard
- ketergantungan token ke vendor eksternal
- UI yang hanya menjadi shell dari layanan luar

Moodlepilot harus memiliki laporan yang benar-benar dimiliki sendiri, dengan data flow ke backend kita.

## Keputusan Untuk Moodlepilot

### Nama Dan Posisi Plugin

Nama plugin target adalah:

- `local_moodlepilot_report`

Plugin ini diposisikan sebagai fondasi suite analytics Moodlepilot yang bisa berkembang bertahap.

### Arsitektur Data

Arsitektur utama yang dikunci:

- plugin mengumpulkan data dari Moodle
- plugin membangun aggregate yang relevan untuk reporting
- plugin `push` data itu ke backend Moodlepilot
- backend Moodlepilot menyimpan dan menyajikan data ke frontend
- frontend site detail membaca dari API backend Moodlepilot, bukan langsung ke Moodle plugin

Alasan keputusan ini:

- lebih mudah dikendalikan dari platform pusat
- lebih mudah di-cache
- lebih mudah dipakai lintas UI
- tidak membuat frontend bergantung langsung pada endpoint Moodle tenant

### Otorisasi Dan Koneksi Plugin

Berbeda dengan IntelliBoard referensi, `moodlepilot-report` tidak boleh bergantung pada flow koneksi manual sebagai default.

Keputusan utama:

- site yang dibuat lewat jalur `Buat Situs Baru` harus `auto-authorized`
- plugin tidak meminta admin tenant melakukan setup token manual setelah provisioning normal
- flow authorize manual hanya disiapkan untuk skenario site existing, imported, atau site yang tidak dibuat oleh provisioning Moodlepilot

Alasan keputusan ini:

- tenant Moodle di repo ini diprovision langsung oleh Moodlepilot
- backend sudah mengontrol proses install Moodle dan konfigurasi runtime tenant
- karena tenant dibuat oleh sistem kita sendiri, trust bootstrap bisa dibangun sejak awal provisioning

Pola otorisasi yang diinginkan:

- saat provisioning, plugin `local_moodlepilot_report` sudah ikut terpasang
- plugin menerima bootstrap config dari jalur provisioning
- bootstrap config minimal harus mencakup:
  - `site_id`
  - endpoint backend Moodlepilot
  - bootstrap secret atau signed registration token
- pada first run, plugin melakukan handshake ke backend Moodlepilot
- setelah handshake sukses, plugin dianggap trusted dan dapat mulai `push` aggregate report

Yang perlu dicatat:

- ini bukan model IntelliBoard yang meminta admin Moodle menghubungkan tenant ke layanan eksternal lewat langkah setup manual
- untuk Moodlepilot, flow default harus `zero-touch` selama tenant berasal dari provisioning platform
- jika nanti ada fitur `Connect Existing Site`, barulah flow authorize manual atau semi-manual dibuka sebagai jalur terpisah

#### Detail Handshake Yang Sudah Dikunci

Untuk implementasi Moodlepilot, kontrak handshake bootstrap yang dipakai adalah:

- provisioning docker_local menyuntik env berikut ke tenant:
  - `MOODLEPILOT_SITE_ID`
  - `MOODLEPILOT_REPORT_AUTO_AUTHORIZE`
  - `MOODLEPILOT_API_BASE_URL`
  - `MOODLEPILOT_REPORT_BOOTSTRAP_TOKEN`
- tenant container harus bisa menjangkau backend host lewat `host.docker.internal`
- plugin menjalankan scheduled task bootstrap berkala
- scheduled task akan berhenti mencoba setelah ingest token tersimpan
- endpoint bootstrap backend menerima:
  - `site_id`
  - `bootstrap_token`
  - `site_url`
  - `plugin_version`
  - `moodle_version`
  - `capabilities`
- backend memvalidasi bootstrap token secara deterministic dari `SITE_RUNTIME_SECRET + site_id`
- jika valid, backend membuat atau memperbarui `site_report_connections`
- backend mengembalikan ingest token baru untuk dipakai push data laporan berikutnya

Konsekuensinya:

- auto-authorize tidak membutuhkan campur tangan admin tenant
- trust awal tidak bergantung pada UI frontend
- rotasi ingest token bisa dilakukan lewat bootstrap ulang bila memang diperlukan
- data koneksi plugin tersimpan di backend pusat, bukan hanya di sisi tenant

### Bentuk V1

V1 plugin tidak mengejar seluruh fitur IntelliBoard.

V1 hanya menyuplai data untuk tab `Laporan` pada halaman detail situs.

Namun tab `Laporan` tidak perlu mempertahankan mockup lama. Tab tersebut boleh dirombak total agar bentuk visual dan strukturnya mengikuti dataset plugin.

Bentuk produk V1 yang dikunci:

- `plugin-first summary`

Bukan:

- full analytics console
- iframe report explorer
- report builder

### Bentuk Jangka Menengah

Saat kebutuhan laporan makin berat, kita tidak akan memaksa seluruh kompleksitas masuk ke tab situs detail.

Sebaliknya:

- tab `Laporan` tetap menjadi summary surface
- halaman laporan khusus akan menjadi tempat untuk drilldown, report besar, export penuh, dan report eksploratif

## Mapping V1 Ke Tab `Laporan`

### Dataset Minimal Yang Harus Disiapkan Plugin

Untuk V1, plugin harus bisa menyuplai lima kelompok data utama:

- summary metrics periode
- recent activity log
- course completion summary
- grade recap per course
- user activity summary

### Makna Tiap Dataset

#### 1. Summary Metrics Periode

Contoh isi:

- total login
- active users
- submissions
- average online time

Tujuan:

- memberi gambaran cepat tentang health dan activity situs pada periode terpilih

#### 2. Recent Activity Log

Contoh isi:

- siapa melakukan apa
- kapan
- pada course atau module apa
- metadata ringkas yang relevan

Tujuan:

- memperlihatkan aktivitas terbaru secara operasional

#### 3. Course Completion Summary

Contoh isi:

- course
- enrolled
- completed
- in progress
- not started

Tujuan:

- menampilkan progres belajar per course secara cepat

#### 4. Grade Recap Per Course

Contoh isi:

- course
- average grade
- highest
- lowest
- passed
- failed

Tujuan:

- memberi ringkasan performa akademik per course

#### 5. User Activity Summary

Contoh isi:

- user
- role
- sessions
- total online time
- submissions
- last action

Tujuan:

- melihat user mana yang aktif dan bagaimana pola aktivitasnya

### Konsekuensi Untuk UI Tab `Laporan`

Tab `Laporan` harus mengikuti lima dataset di atas.

Artinya:

- struktur mock lama tidak wajib dipertahankan
- jika mock lama tidak cocok dengan dataset plugin, maka mock harus diganti
- filter periode tetap dipertahankan sebagai konsep inti
- bentuk akhir UI mengikuti kontrak data plugin, bukan sebaliknya

## Adopt / Avoid

### Adopt

- event-driven tracking
- local aggregation di sisi plugin
- role-aware extensibility
- exportable report datasets
- kombinasi tracking page/module dengan event penting Moodle
- fondasi untuk bertumbuh menjadi analytics suite yang lebih besar

### Avoid

- `iframe` SaaS eksternal
- ketergantungan token ke vendor eksternal
- membawa seluruh fitur IntelliBoard sekaligus ke V1
- SQL report builder publik pada fase awal
- fitur yang tidak relevan dulu seperti ecommerce, BBB tracking, notification engine penuh, dan integrasi vendor lain

## Roadmap

### Phase 1

Plugin-first summary untuk tab `Laporan`.

Fokus:

- data aggregate yang stabil
- ringkasan operasional
- integrasi ke backend Moodlepilot
- auto-authorize untuk tenant hasil provisioning

### Phase 2

Dedicated reports page.

Fokus:

- drilldown
- tabel detail
- export yang lebih besar
- navigasi laporan yang lebih kaya

### Phase 3

Instructor dan student report surfaces.

Fokus:

- role-based analytics
- surface yang relevan per persona

### Phase 4

Advanced analytics dan monitors jika memang dibutuhkan.

Fokus:

- monitors
- scheduled exports
- advanced trends
- report yang lebih eksploratif

## Kontrak Referensi Yang Harus Dipegang

- Plugin target: `local_moodlepilot_report`
- Data flow utama: plugin push ke backend Moodlepilot
- Otorisasi default: auto-authorize untuk tenant hasil provisioning Moodlepilot
- Otorisasi manual: hanya untuk site di luar jalur provisioning normal
- Consumer awal: tab `Laporan` di site detail
- Consumer lanjutan: halaman laporan khusus
- Tab `Laporan` boleh berubah total agar selaras dengan data plugin
- Referensi IntelliBoard dipakai untuk pola dan cakupan ide, bukan untuk disalin satu banding satu
