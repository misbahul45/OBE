# Laporan verifikasi akhir

Tanggal: 2026-10-23. Lingkungan: Linux, Bun 1.4.0, Node 24.16.0, Docker 29.9.1, PostgreSQL 17.6 (kontainer), Playwright 1.64.1 (Chromium). Semua angka di bawah berasal dari perintah yang dijalankan pada sesi ini; status memakai `PASS`, `FAIL`, atau `NOT RUN`/`BLOCKED`.

## Gerbang akhir

| Perintah | Status | Hasil |
|---|---|---|
| `bun run check` | PASS | 6.814 berkas, 0 galat, 0 peringatan |
| `bun run guard` | PASS | 565 berkas dipindai: tanpa komentar, struktur feature-based, batas server/klien, tata letak tes |
| `bun run build` | PASS | build produksi `adapter-node` berhasil (klien dan server); build Vercel juga berhasil pada tiga deploy |
| `bun run test` (unit) | PASS | 340 lulus, 0 gagal |
| `bun run test` (integrasi) | PASS | 278 lulus, 0 gagal; PostgreSQL nyata, database terisolasi per suite |
| `bun run test:local` | NOT RUN pada pembaruan 2026-10-24 | terakhir PASS: 14 lulus, 3 berkas; tidak ada perubahan pada mesin impor yang memengaruhinya |
| `bun run test:e2e` | PASS | 87 lulus, 0 gagal (proyek `flows` 73, `a11y` 10, `mobile` 4), sekitar 4 menit |
| `bun run docs:check` | PASS | ledger konsisten (71 tugas, 65 kriteria), STATUS mutakhir, guard lulus |
| lint | NOT APPLICABLE | proyek tidak memiliki skrip lint; `svelte-check` dan `guard` menjadi pengganti statis |

Setiap tugas di ledger berstatus selesai hanya setelah `bun run track verify <id>` lulus; bukti terakhir tercatat per tugas di `tracking/STATUS.md`.

## Penambahan: UploadThing, Neon, dan Vercel

Diverifikasi setelah gerbang di atas, memakai berkas sintetis dari fixture. Gerbang lokal diulang sesudah perubahan: `check` 0 galat, `guard` lulus, `build` lulus, unit 236, integrasi 256, E2E 68 (mode langsung tetap utuh).

| Pemeriksaan | Status | Bukti |
|---|---|---|
| Layanan penyimpanan terhadap UploadThing nyata: unggah, unduh identik, batas ukuran, hapus | PASS | skrip sekali pakai; setelah hapus, pengambilan menghasilkan `NOT_FOUND` |
| Handler `/api/uploadthing`: tamu 403, wajib ganti password 403, ekstensi selain xlsx/csv 400 | PASS | `tests/unit/imports/storage.test.ts` |
| Aksi `uploadStored`: kepemilikan referensi, batas ukuran, berkas rusak, kegagalan penyimpanan, berkas luar selalu dihapus | PASS | `tests/integration/imports/upload-stored.test.ts` |
| Unggah dari browser nyata (XHR klien UploadThing, CSP) pada server dev | PASS | Playwright MCP: presign, HEAD dan PUT ke ingest, `uploadStored`, wizard; 0 galat konsol |
| Opsi koneksi pooler (`prepare: false`) dan koneksi Neon | PASS | `tests/integration/shared/connection-options.test.ts`; kueri melalui pooler |
| Neon: proyek `obe-tb` (Singapura, PostgreSQL 18), 37 tabel termigrasi, Super Admin tersedia | PASS | `drizzle-kit migrate` dan pemeriksaan tabel/akun |
| Bundel fungsi Vercel memuat pdfkit yang dapat merender font standar | PASS | PDF dirender memakai salinan pdfkit dari dalam bundel |
| Deploy produksi `https://obe-tb.vercel.app` (`sin1`) | PASS | halaman publik 200, CSP dan HSTS, satu H1 dan satu H2, `/app` mengalihkan ke login |
| Produksi: login Super Admin dan 11 halaman admin | PASS | semua 200 |
| Produksi: presign, PUT ke UploadThing, `uploadStored` ke Neon, wizard dua sheet, batal | PASS | berkas sintetis; UploadThing 0 berkas dan tabel staging 0 baris sesudahnya |
| Produksi: `/api/uploadthing` tanpa sesi 403, ekstensi pdf dengan sesi 400 | PASS | skrip uji asap |
| PDF dan unduhan CSV pada produksi | NOT RUN | basis data produksi sengaja kosong; tidak ada data sintetis dimasukkan hanya untuk pengujian |
| E2E Playwright pada mode penyimpanan | NOT RUN | E2E memaksa mode langsung agar tidak mengirim berkas ke layanan luar; jalur ini dicakup tes integrasi, uji langsung, dan uji browser manual di atas |

Jejak yang tertinggal di produksi akibat uji asap: dua batch berstatus `cancelled` beserta catatan audit (append-only). Tidak ada berkas tersisa di UploadThing maupun tabel staging.

## Penambahan 2026-10-24: tema Blue-White, data program studi, dan antarmuka

Angka gerbang di atas sudah diperbarui ke keadaan terakhir. Pemeriksaan tambahan pada sesi ini:

| Pemeriksaan | Status | Bukti |
|---|---|---|
| Palet Blue-White: token kanonik, hover primer, navigasi aktif, sidebar putih, mode gelap | PASS | `tests/unit/shared/contrast.test.ts` (13 tes: palet kanonik, pasangan teks, fokus, grafik, status), `tests/e2e/shared/theme.spec.ts` (gaya terhitung pada landing, login, shell, status, tombol destruktif, mode gelap, scrollbar) |
| Axe WCAG 2.2 AA terang dan gelap setelah migrasi | PASS | temuan nyata: label sidebar 4,34:1 dan keterangan langkah 4,37:1; keduanya diperbaiki; hasil akhir 0 pelanggaran |
| Batas input kanonik `#CBD5E1` bernilai 1,48:1 (di bawah 3:1) | DEVIASI TERDOKUMENTASI | `design-system-audit.md` bagian 6, keputusan D-30 |
| Landing bergaya dots, satu H1 dan satu H2, GSAP dengan reduced motion | PASS | `tests/unit/landing`, `tests/e2e/landing`; diperiksa visual pada 1440 dan 390 px |
| Blueprint kurikulum (8 CPL, 4 profil, 7 bidang kerja) dan katalog 88 mata kuliah: idempoten, tidak menimpa sunting manual | PASS | `tests/integration/profiles/seed.test.ts`, `tests/integration/academic/course-catalog-seed.test.ts`; total SKS wajib per semester sama dengan dokumen resmi (`tests/unit/academic`) |
| Akun dosen dengan kata sandi bersama: kebijakan kata sandi tetap berlaku, wajib ganti saat masuk pertama | PASS | `tests/integration/lecturers/lecturers.test.ts` |
| Halaman Profil lulusan, Panduan istilah, daftar Mulai dari sini, menu alur kerja, stepper impor | PASS | `tests/e2e/profiles/profiles.spec.ts`, `tests/unit/dashboard`, `tests/unit/shared/glossary.test.ts`; diperiksa visual pada 1440, 768, dan 390 px |
| Produksi: migrasi Neon, seed kurikulum dan dosen (dua kali), deploy Vercel | PASS | 8 CPL, 4 profil, 7 bidang kerja, 88 mata kuliah, 13 dosen; halaman dibuka sebagai Super Admin |
| Produksi: login satu dosen dengan kata sandi bersama | PASS | diarahkan ke Ganti password, lalu keluar |
| Produksi: unggah lewat UploadThing dengan berkas sintetis | PASS | PUT ke `sea1.ingest.uploadthing.com`, wizard terbuka, UploadThing 0 berkas, batch uji dibatalkan, staging kembali ke keadaan semula |
| Unggah produksi dengan berkas asli milik pengguna | NOT RUN | sengaja tidak dilakukan; satu batch berstatus `validated` milik akun pengguna dibiarkan utuh |

Keterbatasan data yang perlu diketahui ada di `curriculum-data.md` (kode sementara `TBX001` sampai `TBX006`, paket MBKM tidak dimuat, selisih daftar CPL antara dokumen sesi OBE dan situs dasbor prodi, bobot profil-bidang berupa asumsi).

## Penambahan 2026-10-24: pemetaan otomatis dan impor Semester 1-7 ke produksi

| Pemeriksaan | Status | Bukti |
|---|---|---|
| Pencocok nama sheet ke mata kuliah dan kelas pada seluruh nama sheet Semester 1-7 (termasuk nama terpotong 31 karakter, praktikum, angkatan) | PASS | `tests/unit/imports/sheet-target.test.ts` (71 tes) |
| Pemetaan otomatis: Super Admin membuka kelas, idempoten, dosen terbatas pada kelas yang ditugaskan, nama tak dikenal dilaporkan, tanpa semester aktif ditolak | PASS | `tests/integration/imports/automap.test.ts`, `tests/e2e/imports/automap.spec.ts` |
| Saran kelas saat unggah tidak lagi salah petakan; daftar kelas wizard memuat lebih dari 100 | PASS | `tests/integration/imports/upload.test.ts`, `tests/integration/imports/offering-options.test.ts` (125 kelas) |
| Latihan penuh dengan berkas nyata pada basis data lokal sekali pakai | PASS | hasil sama dengan produksi; salinan lokal direset oleh seed E2E |
| Produksi: 102 sheet dibaca, 92 tersimpan, 10 dikecualikan | PASS | 95 kelas, 471 mahasiswa, 3.139 pendaftaran, 12.843 nilai; NIM ganda 0; NIM berawalan 0 sebanyak 0; staging 0 |
| Produksi: halaman dasbor, kelas, mahasiswa, impor, laporan, kurikulum setelah impor | PASS | 200 dalam 0,7-1,5 detik, tanpa luapan horizontal |
| Hasil CPMK dan CPL terhitung pada produksi | NOT RUN | belum bisa: CPMK, pemetaan komponen, dan kebijakan OBE belum dikonfigurasi |
| Tiga sheet berbobot 125%, 90%, 130% | DIKECUALIKAN | bobot perlu diperbaiki pemilik data; lihat `curriculum-data.md` |
| Tampilan direktori mahasiswa produksi | TIDAK DIPERIKSA VISUAL | memuat nama nyata; hanya status HTTP dan waktu muat yang diukur |

## Hasil terhadap Excel uji asli (lokal, agregat saja)

Sembilan berkas di `~/Downloads` dibaca hanya di mesin ini; tidak ada isi, NIM, maupun nama yang disalin ke repositori.

| Ukuran | Nilai |
|---|---|
| Berkas, sheet terbaca, baris mahasiswa dianalisis | 9, 105, 3.717 |
| Sheet berbobot tepat 100% | 102 |
| Sheet dengan total bobot lain (ditahan karena bobot tidak 100%) | 3 (125, 90, 130) |
| Sheet yang diajukan impor, siap, ditahan | 103, 100, 3 |
| Setelah impor ke database terisolasi: mahasiswa unik, pendaftaran, nilai | 476, 3.410, 13.743 |
| Impor ulang berkas yang sama | 0 baris berubah |

Tiga sheet berbobot tidak 100% sengaja ditahan oleh gerbang `SHEET_ERRORS`; sistem tidak menebak bobot.

## Cakupan fungsional yang terbukti

| Area | Bukti |
|---|---|
| RBAC dan keamanan sesi | `tests/e2e/auth`, `tests/integration/auth`, `academic/lecturer-rbac`, `assessment/component-access`; pendaftaran mandiri tertutup, 403 lintas peran, 404 identik untuk objek di luar cakupan |
| Data induk dan akun dosen | `tests/e2e/academic` (password sementara satu kali, wajib ganti, penugasan, nonaktifkan mencabut sesi) |
| Impor Excel | `tests/unit/imports`, `tests/integration/imports`, `tests/e2e/imports`, `tests/local/imports`: deteksi, validasi, dry-run, commit atomik, idempotensi, konfirmasi nilai berubah, duplikat, berkas rusak, batal |
| Perhitungan OBE | `tests/unit/outcomes`, `tests/integration/outcomes` dengan angka yang dihitung manual (mis. nilai akhir 74,67; rasio 66,67%; CPL 33,33%) |
| Analitik, dasbor, profil | `tests/integration/outcomes/analytics`, `dashboard/kpi`, `students/profile`, `tests/e2e/lecturers`, `tests/e2e/students` |
| PDF dan CSV | `tests/integration/reports/pdf` (konten, halaman, audit tanpa PII), `tests/unit/reports/csv` (netralisasi rumus), E2E unduhan |
| CQI | `tests/unit/cqi`, `tests/integration/cqi`, `tests/e2e/cqi` |
| Aksesibilitas | axe WCAG 2.0/2.1/2.2 A dan AA pada halaman publik, admin, dosen, profil, CQI, laporan, dan tiap tahap wizard, mode terang dan gelap: 0 pelanggaran |
| Responsif | tidak ada luapan horizontal pada viewport ponsel (Pixel 7) untuk halaman utama dan wizard |
| Privasi | `tests/unit/shared/privacy.test.ts` dan `tests/local/shared/privacy-downloads.test.ts` (hash Excel asli tidak ada di repositori) |

## Audit visual dengan Playwright MCP

Diperiksa langsung di browser (tangkapan layar dibaca, bukan hanya aserasi): dasbor admin terang dan gelap, halaman kelas pada 1280 px dan 375 px, profil mahasiswa, direktori mahasiswa pada 375 px, wizard impor (tahap atur sheet, validasi, laporan), kurikulum dan kebijakan, detail CQI, transkrip PDF (dirender ke gambar). Bukan seluruh halaman diperiksa secara visual satu per satu; sisanya dicakup oleh axe dan pemeriksaan luapan otomatis.

## Cacat yang ditemukan selama pengujian dan sudah diperbaiki

| Temuan | Cara ditemukan | Perbaikan |
|---|---|---|
| Dosen dapat melihat nama berkas dan ID batch milik pengguna lain bila isi berkas identik | tinjauan saat membangun UI | duplikat dibatasi per pengunggah + tes |
| CPMK dari mata kuliah lain dapat dipetakan ke komponen kelas | tinjauan layanan | invarian di layanan kurikulum + tes |
| Layanan komponen tidak memeriksa akses per kelas | tinjauan layanan | layanan `assessment` dengan pemeriksaan akses + tes RBAC |
| Subkueri daftar temuan CQI membandingkan dengan kolom yang salah (jumlah tindakan selalu 0) | tes integrasi | kolom dikualifikasi eksplisit |
| `<form>` bersarang pada editor komponen (tombol hapus ikut mengirim formulir pemetaan) | galat SSR Svelte di konsol | tombol dipisah dari formulir |
| Judul PDF terpecah di tengah kata dan ada halaman kosong | tes PDF + render ke gambar | posisi X direset, footer di dalam area halaman |
| Grafik melebarkan halaman pada ponsel | audit MCP | `min-w-0` pada figure |
| `<select>` tanpa nama aksesibel, wilayah gulir tidak dapat difokus keyboard, kontras tab dan tombol destruktif pada mode gelap kurang dari 4,5:1, pesan galat tampil dua kali sebagai `alert` | axe pada E2E | label, fokus bila dapat digulir, token diperbarui, duplikasi dihapus |
| Berkas sementara impor kedaluwarsa tidak pernah dibersihkan | penulisan dokumen operasi | dibersihkan pada setiap unggahan + tes |
| Tema gelap ada di CSS tetapi tidak pernah aktif | audit axe mode gelap | mengikuti preferensi sistem tanpa skrip inline |

## Keterbatasan dan hal yang tidak diuji

| Hal | Status |
|---|---|
| Browser selain Chromium (Firefox, WebKit) | NOT RUN |
| Menjalankan hasil build dengan `node build` di belakang reverse proxy (`PROTOCOL_HEADER`, `BODY_SIZE_LIMIT`) | NOT RUN pada gerbang akhir; E2E memakai `vite preview`. Perilaku `adapter-node` dan pengaturannya didokumentasikan di `setup.md` dan pernah diuji manual lewat HTTP pada sesi sebelumnya |
| Prosedur cadangan dan pemulihan di `setup.md` | NOT RUN |
| Beban dan kinerja (ribuan baris, banyak pengguna serentak) | NOT RUN; batas dan kuota hanya diuji fungsional |
| Log Better Auth memperingatkan IP klien tidak diketahui pada `vite preview` | diketahui; pembatas laju login aplikasi memakai alamat klien SvelteKit sendiri; konfigurasi proxy dijelaskan di `setup.md` |
| Format `.xls` lama | tidak didukung (ditolak dengan pesan jelas) |
| Agregasi CPL tingkat program | sengaja tidak ditampilkan sebelum kebijakan memilih metode agregasi |
| Galat sementara pada server dev saat `program reload` HMR (konteks sidebar, `+error.svelte`) | hanya terlihat di mode dev saat berkas disunting; tidak muncul pada build produksi maupun E2E |

## Kesimpulan

Seluruh gerbang otomatis lulus tanpa pengecualian yang menyembunyikan kegagalan. Hal yang belum dibuktikan tercantum di atas dengan status `NOT RUN`, bukan dianggap lulus.
