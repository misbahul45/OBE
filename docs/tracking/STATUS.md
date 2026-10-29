# STATUS — dihasilkan otomatis oleh `bun run track status`

> Jangan edit manual. Sumber kebenaran: `docs/tracking/ledger.json`. Loop: Plan → Build → Verify → Record → Next (lihat `docs/process/closed-loop.md`).

**Task selesai:** 78/82 (95%) · **Acceptance criteria terpenuhi:** 72/76

## Per fase

| Fase | Selesai | Doing | Blocked | Todo |
|---|---|---|---|---|
| P0 Fondasi, aturan, dan tracking | 7/7 | 0 | 0 | 0 |
| P1 Data dan autentikasi | 7/7 | 0 | 0 | 0 |
| P2 Design system dan shell | 7/10 | 1 | 0 | 2 |
| P3 Data induk dan RBAC | 11/11 | 0 | 0 | 0 |
| P4 Mesin impor Excel | 9/9 | 0 | 0 | 0 |
| P5 Wizard impor | 7/7 | 0 | 0 | 0 |
| P6 OBE, mahasiswa, dan laporan | 15/16 | 0 | 0 | 1 |
| P7 CQI dan dashboard | 5/5 | 0 | 0 | 0 |
| P8 Verifikasi akhir dan dokumentasi | 10/10 | 0 | 0 | 0 |

## Aksi berikutnya (dependensi terpenuhi)

- 🔄 **T-098** Toggle tema (terang, gelap, ikuti sistem) tanpa kedip dan halaman profil akun dengan ubah nama — verifikasi: `bun test tests/unit/shared/theme.test.ts tests/unit/auth/profile-validation.test.ts`

## Blocker

_Tidak ada._

## Task

### P0 — Fondasi, aturan, dan tracking

| | ID | Task | AC | Bukti terakhir |
|---|---|---|---|---|
| ✅ | T-001 | Audit repo dan baseline terdokumentasi | AC-16 | PASS · 2026-10-23 09:14 UTC |
| ✅ | T-002 | Perbaiki konfigurasi proyek (hapus stub svelte.config.js, mode library ke aplikasi, adapter-node, client DB lazy) | AC-16 | PASS · 2026-10-23 09:14 UTC |
| ✅ | T-003 | Aturan proyek: CLAUDE.md, tanpa komentar, feature-based, tanpa commit/push/init | AC-45, AC-51, AC-52 | PASS · 2026-10-23 09:14 UTC |
| ✅ | T-004 | Closed-loop tracking: ledger, STATUS, check | AC-46 | PASS · 2026-10-23 09:14 UTC |
| ✅ | T-005 | Docker PostgreSQL (image dipin, healthcheck, volume), env, dockerignore, skrip db:* | AC-36 | PASS · 2026-10-23 09:14 UTC |
| ✅ | T-006 | Guard database test dan skrip reset khusus DB test | AC-37 | PASS · 2026-10-23 09:15 UTC |
| ✅ | T-007 | Manajemen tes: struktur per jenis dan fitur, database terisolasi per suite, skrip terpisah, aturan guard | AC-53 | PASS · 2026-10-23 09:19 UTC |

### P1 — Data dan autentikasi

| | ID | Task | AC | Bukti terakhir |
|---|---|---|---|---|
| ✅ | T-010 | Schema Drizzle per fitur (auth, academic, curriculum, imports, outcomes, cqi, audit) | AC-21, AC-22, AC-23 | PASS · 2026-10-23 09:27 UTC |
| ✅ | T-011 | Better Auth: email/password, disableSignUp, plugin admin, rate limit, tabel auth | AC-02, AC-47 | PASS · 2026-10-23 09:31 UTC |
| ✅ | T-012 | Migrasi Drizzle clean-install dan verifikasi constraint/index | AC-38 | PASS · 2026-10-23 09:27 UTC |
| ✅ | T-013 | Seed Super Admin idempotent dan seed demo berlabel | AC-38, AC-47 | PASS · 2026-10-23 10:48 UTC |
| ✅ | T-014 | Guard otorisasi, hooks sesi, header keamanan, wajib ganti password | AC-04, AC-49 | PASS · 2026-10-23 09:31 UTC |
| ✅ | T-088 | Migrasi tema Blue-White: token layout.css, komponen bersama, grafik, PDF, tes kontras dan tema | AC-56 | PASS · 2026-10-23 16:24 UTC |
| ✅ | T-091 | Fitur profiles: skema profil lulusan dan bidang kerja, atribut WA/WK pada CPL, blueprint, layanan seed idempoten, migrasi | AC-59 | PASS · 2026-10-23 19:35 UTC |

### P2 — Design system dan shell

| | ID | Task | AC | Bukti terakhir |
|---|---|---|---|---|
| ✅ | T-020 | Audit design system, token Ocean Academic Blue, uji kontras | AC-28, AC-29, AC-30 | PASS · 2026-10-23 09:58 UTC |
| ✅ | T-021 | Komponen shadcn-svelte yang dibutuhkan terpasang dan konsisten | AC-31 | PASS · 2026-10-23 09:59 UTC |
| ✅ | T-022 | Landing: satu H1 dan satu H2, SVG interaktif, GSAP, reduced motion | AC-01, AC-34 | PASS · 2026-10-23 09:59 UTC |
| ✅ | T-023 | Login, logout, halaman 401/403, ganti password | AC-02, AC-47 | PASS · 2026-10-23 10:07 UTC |
| ✅ | T-024 | App shell: sidebar per peran, header, filter periode | AC-32, AC-34 | PASS · 2026-10-23 10:07 UTC |
| ✅ | T-094 | Scrollbar ramping bertoken dan perbaikan kontras label sidebar | AC-62 | PASS · 2026-10-23 19:54 UTC |
| 🔄 | T-098 | Toggle tema (terang, gelap, ikuti sistem) tanpa kedip dan halaman profil akun dengan ubah nama | AC-66 | — |
| ⬜ | T-099 | Redesain landing: titik Three.js dan GSAP ScrollTrigger, logo resmi UNAIR, isi alur, peran, modul, PDCA, dan favicon resmi | AC-67 | — |
| ⬜ | T-101 | Diagram siklus OBE interaktif: hub, busur berarah, umpan balik CQI, simpul tombol, panel penjelasan, dan responsif | AC-69 | — |
| ✅ | T-108 | Perbaikan state tombol tampilkan password: fokus dan kursor dipertahankan, nama aksesibel tetap, tersembunyi kembali setelah kirim | AC-76 | PASS · 2026-10-29 02:42 UTC |

### P3 — Data induk dan RBAC

| | ID | Task | AC | Bukti terakhir |
|---|---|---|---|---|
| ✅ | T-030 | Admin: tahun akademik dan semester | AC-03 | PASS · 2026-10-23 10:12 UTC |
| ✅ | T-031 | Admin: mata kuliah | AC-03 | PASS · 2026-10-23 10:12 UTC |
| ✅ | T-032 | Admin: dosen (akun, password sementara sekali, nonaktif/aktif, cabut sesi) | AC-03, AC-47 | PASS · 2026-10-23 10:12 UTC |
| ✅ | T-033 | Admin: offering dan penugasan dosen | AC-03, AC-04 | PASS · 2026-10-23 10:12 UTC |
| ✅ | T-034 | Admin: kurikulum (CPL, CPMK, mapping, komponen, kebijakan dan target) | AC-10 | PASS · 2026-10-23 10:15 UTC |
| ✅ | T-035 | Layanan audit log dan kueri daftar (paginasi dan filter server-side) | AC-14 | PASS · 2026-10-23 09:51 UTC |
| ✅ | T-036 | Dosen: daftar dan detail kelas dengan RBAC | AC-04 | PASS · 2026-10-23 10:12 UTC |
| ✅ | T-037 | Direktori mahasiswa (pagination dan filter server-side) | AC-11 | PASS · 2026-10-23 10:19 UTC |
| ✅ | T-038 | Halaman admin: tahun akademik, mata kuliah, dosen, penawaran, kurikulum dan kebijakan, laporan, jejak audit | AC-03, AC-32 | PASS · 2026-10-23 15:08 UTC |
| ✅ | T-039 | Halaman dosen (kelas saya, detail kelas, komponen asesmen) dengan RBAC | AC-04 | PASS · 2026-10-23 15:09 UTC |
| ✅ | T-092 | Katalog mata kuliah Kurikulum 2021 dan seed akun dosen dengan kata sandi bersama yang wajib diganti | AC-60 | PASS · 2026-10-23 19:35 UTC |

### P4 — Mesin impor Excel

| | ID | Task | AC | Bukti terakhir |
|---|---|---|---|---|
| ✅ | T-040 | Pembaca workbook aman (ukuran, zip-bomb, batas sheet/baris, MIME, tanpa evaluasi formula) | AC-05 | PASS · 2026-10-23 09:45 UTC |
| ✅ | T-041 | Normalisasi NIM, header, bobot, dan angka | AC-07, AC-09 | PASS · 2026-10-23 09:45 UTC |
| ✅ | T-042 | Analisis sheet: area mahasiswa, peran kolom, kolom ghost, blok metadata, saran mapping, fingerprint | AC-05, AC-06, AC-26 | PASS · 2026-10-23 09:45 UTC |
| ✅ | T-043 | Validasi baris dan taksonomi isu | AC-07, AC-09, AC-20, AC-25 | PASS · 2026-10-23 09:45 UTC |
| ✅ | T-044 | Fixture sintetis (dua format, invalid, variasi) dan generator | AC-15, AC-43 | PASS · 2026-10-23 09:45 UTC |
| ✅ | T-045 | Perencana dry-run (diff terhadap database) | AC-05, AC-08 | PASS · 2026-10-23 09:51 UTC |
| ✅ | T-046 | Commit atomik: upsert student, enrollment, skor, revisi, audit | AC-08, AC-14, AC-18, AC-19, AC-21, AC-22, AC-23, AC-24 | PASS · 2026-10-23 09:52 UTC |
| ✅ | T-047 | Idempotensi, rollback batch invalid, konkurensi | AC-08, AC-25, AC-39 | PASS · 2026-10-23 09:52 UTC |
| ✅ | T-048 | Kompatibilitas seluruh Excel di Downloads (tes lokal) | AC-06, AC-44 | PASS · 2026-10-23 09:45 UTC |

### P5 — Wizard impor

| | ID | Task | AC | Bukti terakhir |
|---|---|---|---|---|
| ✅ | T-050 | Upload privat: checksum, duplikat, staging di PostgreSQL, pemetaan sheet ke offering | AC-05, AC-08 | PASS · 2026-10-23 10:26 UTC |
| ✅ | T-051 | Layanan pemetaan manual, preset, dan penentuan header (sisi server) | AC-05, AC-06 | PASS · 2026-10-23 10:27 UTC |
| ✅ | T-052 | Layanan validasi, dry-run, konfirmasi, dan commit batch dengan recompute (sisi server) | AC-05, AC-09, AC-20 | PASS · 2026-10-23 10:27 UTC |
| ✅ | T-053 | Laporan batch, riwayat impor, dan unduhan laporan galat (layanan) | AC-14, AC-25 | PASS · 2026-10-23 10:27 UTC |
| ✅ | T-054 | Halaman wizard impor (unggah, pemetaan, validasi, dry-run, konfirmasi, commit) dan halaman riwayat/laporan batch | AC-05, AC-06, AC-09, AC-20, AC-25 | PASS · 2026-10-23 15:07 UTC |
| ✅ | T-086 | Unggah berkas lewat UploadThing (handler, penyimpanan, aksi uploadStored, klien, CSP) dengan mode langsung tetap tersedia | AC-54 | PASS · 2026-10-23 15:54 UTC |
| ✅ | T-096 | Pemetaan sheet otomatis: pencocok nama sheet, layanan autoMap, aksi dan tombol wizard, saran kelas ketat, daftar kelas tanpa batas 100, skrip impor massal | AC-64 | PASS · 2026-10-23 21:21 UTC |

### P6 — OBE, mahasiswa, dan laporan

| | ID | Task | AC | Bukti terakhir |
|---|---|---|---|---|
| ✅ | T-060 | Kalkulasi OBE murni: komponen ke CPMK ke CPL, kelengkapan, versi formula | AC-09, AC-10 | PASS · 2026-10-23 10:19 UTC |
| ✅ | T-061 | Recompute service, provenance, imported_reference vs calculated | AC-10, AC-26, AC-27 | PASS · 2026-10-23 10:19 UTC |
| ✅ | T-062 | Profil mahasiswa: tab, riwayat lintas semester, riwayat perubahan | AC-11, AC-27 | PASS · 2026-10-23 11:10 UTC |
| ✅ | T-063 | Komponen grafik SVG aksesibel (bar+target, garis, heatmap, distribusi) dengan fallback tabel | AC-33, AC-50 | PASS · 2026-10-23 10:53 UTC |
| ✅ | T-064 | Analitik per kelas (layanan): statistik komponen, nilai akhir, CPMK, CPL, referensi Excel | AC-33, AC-50 | PASS · 2026-10-23 10:53 UTC |
| ✅ | T-065 | Analitik program studi (layanan): CPL lintas kelas, agregasi kebijakan, kelas perlu perhatian | AC-13, AC-50 | PASS · 2026-10-23 10:53 UTC |
| ✅ | T-066 | PDF transkrip dan laporan kelas server-side, audit unduhan | AC-12 | PASS · 2026-10-23 11:10 UTC |
| ✅ | T-067 | Ekspor CSV tahan formula injection | AC-25, AC-49 | PASS · 2026-10-23 10:27 UTC |
| ✅ | T-068 | Halaman profil mahasiswa lintas semester dan rute PDF terproteksi | AC-11, AC-12, AC-27 | PASS · 2026-10-23 15:11 UTC |
| ⬜ | T-100 | Transkrip PDF mengikuti struktur acuan dengan kop resmi UNAIR dan referensi Excel terpisah | AC-68 | — |
| ✅ | T-102 | Cetak biru OBE dari blok kanan Excel: ekstraktor, CPMK otomatis, penyimpanan bersama jejak batch, toleransi presisi penyimpanan | AC-70 | PASS · 2026-10-28 17:45 UTC |
| ✅ | T-103 | Analitik kelas, program, dan mahasiswa berbasis nilai Excel dengan ambang dari Excel dan jejak komponen ke CPL | AC-71 | PASS · 2026-10-28 17:45 UTC |
| ✅ | T-104 | Pustaka grafik baru dari riset kebutuhan OBE dan integrasinya pada halaman kelas, program, dan mahasiswa | AC-72 | PASS · 2026-10-28 17:47 UTC |
| ✅ | T-105 | Sisi mahasiswa: daftar CPL tercapai, tanpa pelacak per semester, PDF hanya memuat CPL tercapai | AC-73 | PASS · 2026-10-28 17:45 UTC |
| ✅ | T-106 | Optimasi pencarian dan paginasi direktori mahasiswa | AC-74 | PASS · 2026-10-28 17:46 UTC |
| ✅ | T-107 | Tracer alumni dan linearitas: prediksi dari nilai CPL, isian nyata manual, statistik linear dan tidak linear | AC-75 | PASS · 2026-10-28 18:28 UTC |

### P7 — CQI dan dashboard

| | ID | Task | AC | Bukti terakhir |
|---|---|---|---|---|
| ✅ | T-070 | Workflow CQI (layanan): temuan, tindakan, bukti, evaluasi, gerbang status, akses per peran | AC-48 | PASS · 2026-10-23 14:02 UTC |
| ✅ | T-072 | Halaman CQI untuk Super Admin dan dosen penanggung jawab (daftar, detail, alur status, bukti, evaluasi) | AC-48 | PASS · 2026-10-23 15:10 UTC |
| ✅ | T-071 | Dashboard admin dan dosen (KPI berdefinisi, tanpa angka statis) | AC-13, AC-32 | PASS · 2026-10-23 14:05 UTC |
| ✅ | T-089 | Redesain landing bergaya dots dengan palet Blue-White dan visual orbit titik | AC-57 | PASS · 2026-10-23 16:25 UTC |
| ✅ | T-093 | UI anti-bingung: halaman Profil lulusan, panduan istilah, daftar Mulai dari sini, menu alur kerja, keadaan kosong, stepper impor | AC-59, AC-61 | PASS · 2026-10-23 19:54 UTC |

### P8 — Verifikasi akhir dan dokumentasi

| | ID | Task | AC | Bukti terakhir |
|---|---|---|---|---|
| ✅ | T-087 | Neon dan Vercel: adapter bersyarat, opsi koneksi pooler, migrasi, seed Super Admin, variabel lingkungan, deploy produksi | AC-55 | PASS · 2026-10-23 15:55 UTC |
| ✅ | T-080 | Seluruh tes unit dan integrasi lulus | AC-15, AC-39, AC-42 | PASS · 2026-10-23 14:07 UTC |
| ✅ | T-081 | Playwright E2E flow A sampai F | AC-40 | PASS · 2026-10-23 15:14 UTC |
| ✅ | T-082 | Audit visual (Playwright MCP), aksesibilitas, responsif, reduced motion | AC-34, AC-35, AC-41 | PASS · 2026-10-23 15:18 UTC |
| ✅ | T-083 | Dokumentasi: README, setup, architecture, excel-import-contract, data-lineage-obe, testing-e2e, design-system-audit | AC-17, AC-28 | PASS · 2026-10-23 15:19 UTC |
| ✅ | T-084 | Laporan verifikasi akhir (PASS/FAIL/BLOCKED) | AC-16, AC-42, AC-43 | PASS · 2026-10-23 15:27 UTC |
| ✅ | T-085 | Pemindaian privasi: tidak ada data nyata di repo dan artefak tes | AC-43 | PASS · 2026-10-23 15:18 UTC |
| ✅ | T-090 | Uji ulang unggah berkas pada build baru: E2E mode langsung dan produksi UploadThing dengan berkas sintetis | AC-58 | PASS · 2026-10-23 19:53 UTC |
| ✅ | T-095 | Produksi: migrasi Neon, seed kurikulum dan dosen, deploy ulang Vercel, verifikasi | AC-63 | PASS · 2026-10-23 19:53 UTC |
| ✅ | T-097 | Impor Semester 1 sampai 7 ke produksi dan verifikasinya | AC-65 | PASS · 2026-10-23 21:21 UTC |

## Acceptance criteria (status dihitung dari task)

| AC | Sumber | Kriteria | Status | Task |
|---|---|---|---|---|
| AC-01 | §15 | Landing hanya satu H1 dan satu H2, visual SVG interaktif, CTA login; tanpa badge/eyebrow/label/registrasi | ✅ terpenuhi | T-022 |
| AC-02 | §15 | Pendaftaran publik diblokir di server | ✅ terpenuhi | T-011, T-023 |
| AC-03 | §15 | Super Admin dapat mengelola dosen, mata kuliah, semester, offering, dan penugasan | ✅ terpenuhi | T-030, T-031, T-032, T-033, T-038 |
| AC-04 | §15 | Dosen hanya melihat dan mengelola offering yang ditugaskan | ✅ terpenuhi | T-014, T-033, T-036, T-039 |
| AC-05 | §15 | Impor multi-sheet berformat berbeda: deteksi, mapping manual, preview, validasi, dry-run | ✅ terpenuhi | T-040, T-042, T-045, T-050, T-051, T-052, T-054 |
| AC-06 | §15 | Blok metadata/rubrik/threshold di kanan tidak dibaca sebagai mahasiswa | ✅ terpenuhi | T-042, T-048, T-051, T-054 |
| AC-07 | §15 | NIM string; konflik dan nol di depan ditangani eksplisit | ✅ terpenuhi | T-041, T-043 |
| AC-08 | §15 | Impor pertama dan ulang aman, idempotent, tercatat, tanpa duplikasi enrollment/skor | ✅ terpenuhi | T-045, T-046, T-047, T-050 |
| AC-09 | §15 | Kosong ≠ 0; kesalahan bobot dan nilai ditemukan sebelum commit | ✅ terpenuhi | T-041, T-043, T-052, T-054, T-060 |
| AC-10 | §15 | Nilai komponen, CPMK, CPL dibedakan dengan formula/mapping yang dapat dijelaskan dan ditelusuri | ✅ terpenuhi | T-034, T-060, T-061 |
| AC-11 | §15 | Profil mahasiswa menampilkan riwayat lintas semester dari database | ✅ terpenuhi | T-037, T-062, T-068 |
| AC-12 | §15 | PDF transkrip rapi, dibangun server-side, dilindungi otorisasi | ✅ terpenuhi | T-066, T-068 |
| AC-13 | §15 | Dashboard berasal dari database; tidak ada metrik statis | ✅ terpenuhi | T-065, T-071 |
| AC-14 | §15 | Impor dan perubahan nilai dapat diaudit | ✅ terpenuhi | T-035, T-046, T-053 |
| AC-15 | §15 | Tes parsing dua format contoh (fixture anonim), RBAC, upsert, dan PDF tersedia | ✅ terpenuhi | T-044, T-080 |
| AC-16 | §15 | check, tes, dan build lulus atau pengecualian baseline terdokumentasi | ✅ terpenuhi | T-001, T-002, T-084 |
| AC-17 | §15 | Docs menjelaskan setup, migrasi, seed, penggunaan, dan batasan | ✅ terpenuhi | T-083 |
| AC-18 | §26 | NIM belum ada: mahasiswa baru dibuat saat commit yang disetujui | ✅ terpenuhi | T-046 |
| AC-19 | §26 | NIM sudah ada: memakai student ID yang sama, tanpa duplikat | ✅ terpenuhi | T-046 |
| AC-20 | §26 | Nama berbeda untuk NIM sama: conflict warning, nama master tidak ditimpa | ✅ terpenuhi | T-043, T-052, T-054 |
| AC-21 | §26 | Enrollment di-upsert tepat per semester, offering, dan kelas terpilih | ✅ terpenuhi | T-010, T-046 |
| AC-22 | §26 | Skor di-upsert berdasarkan enrollment + komponen unik | ✅ terpenuhi | T-010, T-046 |
| AC-23 | §26 | Perubahan nilai mencatat revisi before/after dan batch sumber | ✅ terpenuhi | T-010, T-046 |
| AC-24 | §26 | Tidak ada overwrite lintas semester atau offering yang tidak dipilih | ✅ terpenuhi | T-046 |
| AC-25 | §26 | Baris invalid dilaporkan; partial import hanya sesuai mode yang disetujui; ekspor aman | ✅ terpenuhi | T-043, T-047, T-053, T-054, T-067 |
| AC-26 | §26 | CPMK/CPL dari Excel tidak disalahartikan sebagai nilai komponen mentah | ✅ terpenuhi | T-042, T-061 |
| AC-27 | §26 | Dashboard, transkrip, profil, dan grafik berubah setelah commit berdasarkan query PostgreSQL | ✅ terpenuhi | T-061, T-062, T-068 |
| AC-28 | §26 | components.json dan tema CSS diaudit sebelum perubahan; docs/design-system-audit.md | ✅ terpenuhi | T-020, T-083 |
| AC-29 | §26 | Semua halaman memakai token semantik shadcn-svelte, bukan warna hardcoded | ✅ terpenuhi | T-020 |
| AC-30 | §26 | Palet terdokumentasi dan kontras diuji; status tidak bergantung warna saja | ✅ terpenuhi | T-020 |
| AC-31 | §26 | Komponen button/input/select/dialog/table/sidebar/chart konsisten ukuran, radius, spacing, fokus | ✅ terpenuhi | T-021 |
| AC-32 | §26 | Dashboard punya hierarki informasi jelas dan state UI lengkap | ✅ terpenuhi | T-024, T-038, T-071 |
| AC-33 | §26 | Grafik punya judul, unit, periode, target/legenda, tooltip, empty state, fallback tabel | ✅ terpenuhi | T-063, T-064 |
| AC-34 | §26 | Desktop/tablet/mobile, keyboard, dan reduced motion diuji | ✅ terpenuhi | T-022, T-024, T-082 |
| AC-35 | §26 | Screenshot Playwright diperiksa, bukan hanya dibuat | ✅ terpenuhi | T-082 |
| AC-36 | §26 | Docker PostgreSQL dengan image dipin, healthcheck, named volume, .env.example aman | ✅ terpenuhi | T-005 |
| AC-37 | §26 | Database test terpisah; skrip reset menolak DB yang tidak diizinkan | ✅ terpenuhi | T-006 |
| AC-38 | §26 | Migrasi clean-install dan seed idempotent berhasil | ✅ terpenuhi | T-012, T-013 |
| AC-39 | §26 | Tes integrasi memakai PostgreSQL nyata | ✅ terpenuhi | T-047, T-080 |
| AC-40 | §26 | Playwright E2E: login → admin setup → impor → upsert → dashboard/grafik → PDF → impor ulang → penolakan RBAC | ✅ terpenuhi | T-081 |
| AC-41 | §26 | Playwright MCP dipakai bila tersedia dan statusnya dilaporkan jujur | ✅ terpenuhi | T-082 |
| AC-42 | §26 | check, lint (bila ada), test, E2E, dan build tercatat hasil akhirnya | ✅ terpenuhi | T-080, T-084 |
| AC-43 | §26 | Tidak ada secret atau data nyata di fixture, screenshot, log, trace, dan hasil diff | ✅ terpenuhi | T-044, T-084, T-085 |
| AC-44 | pengguna | Seluruh Excel uji di ~/Downloads dibaca lokal tanpa kesalahan klasifikasi kolom/baris (tes kompatibilitas) | ✅ terpenuhi | T-048 |
| AC-45 | pengguna | Aturan dilarang commit/push/init terdokumentasi di CLAUDE.md dan dipatuhi | ✅ terpenuhi | T-003 |
| AC-46 | pengguna | Docs closed-loop untuk tracking pengembangan berjalan dan dapat diperiksa mesin | ✅ terpenuhi | T-004 |
| AC-47 | §3 | Super Admin seed idempotent; password sementara tampil sekali; wajib ganti password | ✅ terpenuhi | T-011, T-013, T-023, T-032 |
| AC-48 | §10 | Workflow CQI: temuan, penyebab, aksi, PIC, tenggat, bukti, evaluasi ulang, audit trail | ✅ terpenuhi | T-070, T-072 |
| AC-49 | §11 | Header keamanan, rate limit login, CSRF, otorisasi tiap endpoint, ekspor tahan formula injection | ✅ terpenuhi | T-014, T-067 |
| AC-50 | §19 | Grafik tingkat prodi, mata kuliah, dan mahasiswa membaca agregat database | ✅ terpenuhi | T-063, T-064, T-065 |
| AC-51 | pengguna | Kode tanpa komentar, ditegakkan oleh guard | ✅ terpenuhi | T-003 |
| AC-52 | pengguna | Struktur feature-based domain dengan batas fitur dan server/klien, ditegakkan oleh guard | ✅ terpenuhi | T-003 |
| AC-53 | pengguna | Manajemen tes terpisah per jenis dan per fitur dengan database terisolasi per suite, ditegakkan guard | ✅ terpenuhi | T-007 |
| AC-54 | Permintaan pengguna | Unggah Excel lewat UploadThing: otorisasi, referensi milik akun, batas ukuran, dan berkas luar dihapus setelah staging | ✅ terpenuhi | T-086 |
| AC-55 | Permintaan pengguna | Deploy produksi di Vercel dengan Neon PostgreSQL (migrasi, seed, variabel lingkungan) terverifikasi dengan data sintetis | ✅ terpenuhi | T-087 |
| AC-56 | Permintaan pengguna | Seluruh aplikasi memakai palet Professional Blue-White (token kanonik, hover primer, navigasi aktif biru lembut, sidebar putih, status semantik dengan teks lulus AA, mode gelap tetap valid) lewat token dan komponen bersama; penyimpangan kontras terdokumentasi | ✅ terpenuhi | T-088 |
| AC-57 | Permintaan pengguna | Landing page bergaya halaman fitur dots ChatGPT (hero tengah besar, tombol pil, panel visual membulat) tetap dengan satu H1, satu H2, tanpa lencana atau kartu, CTA ke /login, GSAP dengan reduced motion | ✅ terpenuhi | T-089 |
| AC-58 | Permintaan pengguna | Alur unggah berkas Excel lewat UploadThing diuji ulang pada build baru: mode langsung (E2E) dan produksi dengan berkas sintetis, tanpa sisa berkas atau baris staging | ✅ terpenuhi | T-090 |
| AC-59 | Permintaan pengguna | Blueprint kurikulum (8 CPL beratribut WA/WK, 4 profil lulusan, 7 bidang kerja, matriks CPL-profil dan profil-bidang) dapat dimuat idempoten lewat seed:curriculum dan ditampilkan pada halaman Profil lulusan; CPL yang belum terpetakan ditandai | ✅ terpenuhi | T-091, T-093 |
| AC-60 | Permintaan pengguna | Katalog mata kuliah Kurikulum 2021 (total SKS wajib per semester sama dengan dokumen resmi prodi) dan akun dosen tetap prodi dapat dimuat idempoten; daftar dosen bernama tidak disimpan di repositori; akun wajib mengganti kata sandi saat masuk pertama | ✅ terpenuhi | T-092 |
| AC-61 | Permintaan pengguna | Antarmuka tidak membingungkan: menu menurut alur kerja dengan keterangan, panduan istilah, daftar Mulai dari sini dari data nyata, keadaan kosong dengan langkah berikutnya, dan stepper tahap impor | ✅ terpenuhi | T-093 |
| AC-62 | Permintaan pengguna | Scrollbar ramping konsisten dengan token tema terang dan gelap; label sidebar lulus kontras 4,5:1 | ✅ terpenuhi | T-094 |
| AC-63 | Permintaan pengguna | Seed kurikulum dan dosen dijalankan di produksi (Neon) setelah migrasi, situs dideploy ulang, dan hasilnya diverifikasi di produksi | ✅ terpenuhi | T-095 |
| AC-64 | Permintaan pengguna | Wizard impor memetakan sheet ke kelas secara otomatis (Super Admin membuka kelas yang belum ada; dosen hanya kelas yang ditugaskan), saran kelas saat unggah memakai kecocokan ketat tanpa salah petakan, dan daftar kelas wizard tidak terpotong pada 100 | ✅ terpenuhi | T-096 |
| AC-65 | Permintaan pengguna | Berkas nilai Semester 1 sampai 7 diimpor ke produksi lewat layanan aplikasi: kelas terpetakan otomatis, konfirmasi NIM angka berbasis bukti, tanpa NIM ganda, sheet bermasalah dikecualikan dan dilaporkan secara agregat | ✅ terpenuhi | T-097 |
| AC-66 | Permintaan pengguna | Toggle tema terang/gelap tersedia di landing, login, dan shell aplikasi; pilihan Terang, Gelap, atau Ikuti sistem tersimpan per peramban tanpa kedip tema dan lolos CSP; halaman profil akun menampilkan identitas, peran, data dosen, tampilan, dan keamanan, serta mengizinkan pengguna mengubah nama tampilannya sendiri dengan audit | ⬜ terbuka | T-098 |
| AC-67 | Permintaan pengguna | Landing page menjelaskan alur OBE, peran, modul, dan siklus PDCA dengan animasi titik Three.js dan GSAP ScrollTrigger yang menghormati prefers-reduced-motion, membersihkan sumber daya WebGL, memakai logo resmi UNAIR tanpa mengubah proporsi, dan favicon dari logo resmi | ⬜ terbuka | T-099 |
| AC-68 | Permintaan pengguna | Transkrip Capaian Pembelajaran PDF mengikuti struktur acuan (kop resmi UNAIR, identitas, ringkasan semester, CPL lintas mata kuliah, identitas dan nilai akhir per mata kuliah, tabel komponen, tabel capaian, nilai referensi Excel terpisah, nomor halaman) dengan tabel konvensional yang tidak terpotong | ⬜ terbuka | T-100 |
| AC-69 | Permintaan pengguna | Diagram siklus OBE di landing memiliki hub OBE yang bermakna, arah siklus yang terlihat tanpa gerak (panah dan busur umpan balik CQI), tracer lembut yang berhenti pada prefers-reduced-motion, empat simpul berupa tombol asli yang dapat dipilih dengan penunjuk dan papan ketik, panel penjelasan yang diumumkan secara sopan, dan tata letak yang tidak tumpang tindih dari 320 px sampai desktop besar | ⬜ terbuka | T-101 |
| AC-70 | Permintaan pengguna | Blok kanan sheet Excel (matriks CPMK terhadap komponen, matriks CPL terhadap CPMK, ambang nilai dan rasio kelas, ringkasan ketercapaian) dibaca dan disimpan bersama batch dan sheet asalnya tanpa nilai mahasiswa; CPMK yang muncul di Excel dibuat otomatis dan nilainya tersimpan; impor ulang idempoten termasuk pada nilai di batas pembulatan | ✅ terpenuhi | T-102 |
| AC-71 | Permintaan pengguna | Analitik kelas, program, dan mahasiswa memakai nilai kolom Excel bila sistem belum menghitung, dengan ambang dari kebijakan OBE atau, bila tidak ada, dari Excel yang ditandai sumbernya; tanpa keduanya ketercapaian tidak diklaim; jejak komponen ke CPMK ke CPL tersedia per kelas | ✅ terpenuhi | T-103 |
| AC-72 | Permintaan pengguna | Grafik capaian bervariasi dan informatif berdasarkan riset kebutuhan OBE (sebaran tercapai, radar CPL, alir jejak, matriks bobot, dumbbell), masing-masing dengan legenda, keterangan sorot dan fokus papan ketik, dan tabel pendamping; dasar riset terdokumentasi | ✅ terpenuhi | T-104 |
| AC-73 | Permintaan pengguna | Sisi mahasiswa tanpa pelacak per semester; profil menampilkan CPL yang telah dicapai; PDF unduhan hanya memuat identitas dan daftar CPL tercapai dengan sumber ambang | ✅ terpenuhi | T-105 |
| AC-74 | Permintaan pengguna | Direktori mahasiswa mudah dicari dan dijelajahi: pencarian langsung (frasa utuh didahulukan, lalu semua kata berurutan bebas, hasil disorot), urutan relevansi dan urutan kolom yang dapat dibalik, penyaring aktif yang dapat dihapus satu per satu, paginasi bernomor dengan ringkasan rentang dan pilihan jumlah baris, halaman di luar jangkauan dipangkas, dan satu kueri dengan total jendela | ✅ terpenuhi | T-106 |
| AC-75 | Permintaan pengguna | Admin melihat statistik berapa mahasiswa yang linear dan tidak linear (prediksi dari nilai CPL, dengan jumlah, persen, dan yang belum dapat dinilai), dapat memasukkan manual data nyata linear atau tidak beserta bidang kerja dan keeratan lima tingkat, dan melihat perbandingan prediksi dengan nyata beserta cara menghitungnya; data kurang tidak dihitung sebagai nol dan tanpa ambang prediksi tidak dikarang | ✅ terpenuhi | T-107 |
| AC-76 | Permintaan pengguna | Tombol tampilkan password pada formulir tidak menghilangkan nilai, fokus, atau posisi kursor; memiliki satu nama aksesibel tetap dengan status lewat aria-pressed; dan kata sandi kembali tersembunyi setelah formulir dikirim | ✅ terpenuhi | T-108 |
