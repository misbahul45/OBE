# Arsitektur

Aplikasi monolit SvelteKit 3 (Svelte 5 runes) dengan PostgreSQL. Satu proses melayani halaman, form action, dan endpoint unduhan. Target jalan: Node mandiri (`adapter-node`) atau Vercel (`adapter-vercel`) dengan Neon; keduanya memakai kode yang sama (lihat `setup.md`).

## Lapisan

```
src/
  routes/                 rute tipis: sesi, validasi masukan, panggil layanan fitur
  hooks.server.ts         header keamanan, sesi, akses per rute, API autentikasi
  lib/
    features/<fitur>/     seluruh kode domain satu fitur
    shared/               utilitas lintas fitur: db, http, format, ui, charts
    components/ui/        hanya primitif shadcn-svelte
```

Satu fitur memuat sebagian dari: `*.schema.ts` (Drizzle), `*.service.server.ts` (aturan bisnis), `*.queries.server.ts` (baca), `*.validation.ts` (zod), `*.types.ts`, `*.pages.server.ts` (pemuat dan aksi untuk rute), `components/`, serta `index.ts` (publik, aman untuk klien) dan `index.server.ts` (publik, server).

Aturan batas yang ditegakkan `bun run guard`:

1. Lintas fitur hanya lewat `index.ts`, `index.server.ts`, `*.schema.ts`, atau `*.types.ts`.
2. Berkas server memakai akhiran `.server.ts`; `node:*`, `postgres`, `xlsx`, `pdfkit`, dan `$app/env/private` tidak boleh masuk bundel klien.
3. Tidak ada komentar di kode; alasan desain ada di dokumen ini dan `tracking/decisions.md`.
4. Fungsi layanan menerima `db` sebagai argumen, sehingga dapat diuji terhadap database terisolasi tanpa SvelteKit. Singleton database aplikasi hanya diimpor oleh berkas `+page.server.ts` dan `+server.ts`.

## Fitur

| Fitur | Tanggung jawab |
|---|---|
| `auth` | Better Auth, peran, kebijakan password, login dan pembatas laju, seed Super Admin, penjaga akses |
| `lecturers` | akun dosen, password sementara satu kali, nonaktifkan dan aktifkan (cabut sesi) |
| `academic` | tahun akademik, semester (satu aktif), mata kuliah, penawaran kelas, penugasan dosen, akses per kelas |
| `curriculum` | CPL, CPMK, pemetaan, komponen asesmen, kebijakan OBE berversi |
| `assessment` | skema nilai dan revisi; layanan komponen dan pemetaan dengan akses per kelas |
| `students`, `enrollments` | mahasiswa (NIM string), pendaftaran, direktori, profil lintas semester |
| `imports` | analisis workbook, pemetaan, validasi, dry-run, commit atomik, laporan batch, unggahan langsung atau lewat UploadThing |
| `outcomes` | kalkulasi CPMK/CPL, hitung ulang idempoten, analitik kelas dan program |
| `cqi` | temuan, tindakan, bukti, evaluasi dengan alur status bergerbang |
| `profiles` | profil lulusan, bidang kerja, tautan CPL-profil dan profil-bidang, blueprint program studi, seed idempoten, halaman Profil lulusan |
| `reports` | PDF transkrip dan laporan kelas, CSV galat, audit unduhan |
| `audit` | catatan perubahan dengan penyamaran data sensitif |
| `dashboard` | navigasi, shell aplikasi, halaman kelas, dasbor |
| `landing` | halaman publik (satu H1, satu H2, satu ajakan bertindak) |

## Otorisasi

- Default-deny. `hooks.server.ts` menolak rute `/app/admin/*` untuk non-admin dan `/app/lecturer/*` untuk non-dosen (403), serta mengalihkan akun dengan password sementara ke halaman ganti password.
- Setiap `load`, aksi, dan endpoint memanggil `requireRole` atau `requireUser`, lalu layanan memeriksa ulang akses per kelas (`assertOfferingAccess`). Mengganti ID di URL atau body tidak memberi akses.
- Objek di luar cakupan dijawab `NotFoundError` (404) dengan pesan identik dengan objek yang tidak ada, sehingga keberadaannya tidak bocor.
- Dosen melihat mahasiswa, batch impor, temuan CQI, dan hasil hanya dalam cakupan kelas atau tindakannya.

## Konvensi galat dan form

`ValidationError` (400 dengan pesan per bidang), `NotFoundError` (404), `ConflictError` (409) dilempar layanan. `runAction` memetakannya menjadi `fail()` SvelteKit; `orNotFound` memetakan 404 untuk `load` dan endpoint. Formulir memakai `use:enhance`, mengembalikan `fieldErrors` dan `values` agar isian tidak hilang.

## Keamanan

| Kontrol | Implementasi |
|---|---|
| CSP | nonce otomatis SvelteKit; `default-src 'self'`, `frame-ancestors 'none'`, `connect-src` menambah `*.uploadthing.com` dan `*.ufs.sh`; tema gelap diterapkan lewat kelas CSS tanpa skrip inline |
| Header | `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS bila `ORIGIN` HTTPS |
| Sesi | cookie `HttpOnly`, `SameSite=Lax`; sesi dicabut saat ganti password atau penonaktifan |
| CSRF | pemeriksaan origin SvelteKit pada semua form POST |
| Brute force | pembatas laju login per IP dan per email |
| Unggahan | validasi tipe dan magic bytes, inspeksi ZIP (jumlah entri, ukuran, rasio kompresi), batas baris dan kolom; pada mode penyimpanan: otorisasi di `/api/uploadthing`, referensi berawalan ID akun, URL bertanda tangan, berkas luar dihapus setelah staging |
| CSV | netralisasi awalan rumus (`= + - @`) |
| Audit | `recordAudit` menyamarkan NIM dan kunci sensitif; unduhan PDF dicatat tanpa NIM atau nama |

## Aliran data

```
Excel → (langsung ke server | UploadThing → ambil dan hapus) → stageUpload → (pemetaan) → runDryRun → commitBatch (satu transaksi)
      → assessment_scores + assessment_revisions + imported_reference
      → recomputeOffering → cpmk_results / cpl_results (source = calculated)
      → analitik (outcomes.analytics) → dasbor, profil, PDF
```

Rincian kontrak impor ada di `excel-import-contract.md`; asal setiap angka dan rumusnya di `data-lineage-obe.md`.

## UI

Primitif dari shadcn-svelte (Nova, Lucide, Geist). Komponen lintas fitur ada di `shared/ui` (`Field`, `NativeSelect`, `ConfirmForm`, `Pager`, `PageHeader`, `StatusBadge`, `EmptyState`, `FormMessage`) dan `shared/charts` (SVG aksesibel: batang dengan target, histogram, peta panas, garis; semuanya memiliki ringkasan teks dan tabel pengganti). Token warna Blue-White di `routes/layout.css`; audit kontras di `design-system-audit.md`. Bantuan pengguna: `shared/help` (glosarium dan nama baku kode WA/WK), halaman `/app/help`, komponen `Term`-style tautan lewat `CodeChips`, daftar persiapan data di dasbor admin (`dashboard.setup.ts`, fungsi murni), dan `EmptyState` dengan tautan langkah berikutnya.
