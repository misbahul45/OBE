# Baseline audit (sebelum perubahan)

Tanggal audit: 2026-10-23. Direktori: `~/code/obe-tb`. Bukan repositori git.

## Stack terdeteksi

| Komponen | Versi |
|---|---|
| Bun | 1.4.0 |
| Node | 24.16.0 |
| SvelteKit | 3.1.0 |
| Svelte | 5.57 (runes dipaksa di `vite.config.ts`) |
| Vite | 8.3 |
| TypeScript | 6.0.3 |
| Tailwind | 4.3 |
| Drizzle ORM / Kit | 0.45 / 0.31 (dialect `postgresql`, driver `postgres`) |
| Better Auth | 1.6.24 |
| shadcn-svelte | 1.7 (preset Nova, Lucide, Geist; baru komponen `button`) |
| Docker / Compose | 29.9.1 / 5.6.0 |

Tidak ada: lint (tidak ada eslint/prettier), test runner, route aplikasi (hanya demo Better Auth), schema domain (hanya tabel `task` contoh), `auth.schema.ts` (stub kosong).

## Temuan

| ID | Temuan | Dampak | Tindakan |
|---|---|---|---|
| F-01 | Proyek discaffold sebagai template library (`svelte-package`, `publint`, `exports`, `files`) | `build` memanggil `prepack` | script dan field library dihapus; paket `@sveltejs/package` dan `publint` dicabut |
| F-02 | `svelte.config.js` berisi stub dokumentasi shadcn tanpa `export default` | SvelteKit 3 menolak file ini (`config_file_unsupported`) sehingga `check` dan `build` gagal | berkas dihapus; konfigurasi lewat `sveltekit()` di `vite.config.ts` |
| F-03 | `.env` berisi placeholder `postgres://user:password@host:port/db-name` | `build` gagal pada fase analyse (`Invalid URL`) karena client DB dibuat saat modul dimuat | `.env` tidak diubah; nilai lokal di `.env.local`; client DB dibuat lazy |
| F-04 | `emailAndPassword` aktif tanpa `disableSignUp`, dan demo menyediakan action `signUpEmail` | registrasi publik terbuka | dihapus; `disableSignUp: true` |
| F-05 | Adapter `adapter-auto` | tidak menghasilkan server yang dapat dijalankan di luar platform terdeteksi | `adapter-node` |
| F-06 | Komentar di berkas scaffold | melanggar aturan kode tanpa komentar | dibersihkan oleh `guard --fix` |
| F-07 | Struktur `src/lib/server/*` berbasis lapisan | melanggar aturan feature-based | dipindah ke `features/*` dan `shared/*` |

## Hasil baseline

| Perintah | Sebelum | Setelah koreksi konfigurasi |
|---|---|---|
| `bun run check` | FAIL (`config_file_unsupported`) | PASS: 0 error, 0 warning, 1170 berkas |
| `bun run build` | FAIL (`config_file_unsupported`) | FAIL (`Invalid URL` dari `.env` placeholder), lalu ditangani F-03 |
| lint | tidak tersedia | tidak tersedia |
| test | tidak tersedia | belum ada |

Kegagalan awal di atas sudah ada sebelum perubahan lain dan tidak berasal dari regresi.

## Inventaris Excel uji (`~/Downloads`)

Hanya struktur; tidak ada nama atau NIM yang dicatat.

| Berkas | Sheet | Catatan |
|---|---|---|
| Semester 1.xlsx | 2 | 87 dan 86 baris mahasiswa; NIM numerik 8 digit |
| Semester 1(1).xlsx | 2 | byte-identik dengan Semester 1.xlsx (SHA-256 sama) |
| Semester 2.xlsx | 7 | NIM numerik 11 dan 12 digit |
| Semester 3.xlsx | 20 | |
| Semester 4.xlsx | 24 | NIM campur 9 dan 11 digit pada sebagian sheet |
| Semester 5.xlsx | 20 | |
| Semester 6.xlsx | 20 | nama sheet memuat tahun angkatan |
| Semester 7.xlsx | 9 | satu sheet menyimpan NIM sebagai string |
| Capaian_CPMK_OBE_Sinyal Sistem Kontrol.xlsx | 1 | sheet `CPMK_T1`, CPL 3 dan 5 |

Pola yang ditemukan di seluruh berkas (menjadi dasar `docs/excel-import-contract.md`):

1. Header di baris 1, kolom A `No`, B `NIM`, C `Nama`, lalu komponen penilaian dengan bobot di teks header (`(25 %)`), kolom CPMK-n, kolom CPL k.
2. Teks header memuat newline, pemisah `#`, dan kata terpotong (`Midter m`, `Finalter m`); label yang sama berulang pada beberapa kolom.
3. Kolom tanpa header yang berisi data (sering kolom `I`, berisi `0`) berada di antara komponen dan CPMK.
4. Blok metadata di kanan (bobot komponen, matriks CPMK × komponen, threshold, bobot CPL × CPMK, rekap ketercapaian) menempati baris yang sama dengan data mahasiswa.
5. Rumus CPMK/CPL memakai `SUMPRODUCT` posisional; pada `Semester 1.xlsx` sheet Pancasila rentang nilai `D:K` dipasangkan dengan bobot `T2:AA2` yang labelnya berbeda, dan semua CPMK bernilai sama karena matriks flag seluruhnya 1. Hasil Excel karena itu diperlakukan sebagai `imported_reference`, bukan sumber resmi.
6. Rumus Excel memperlakukan sel kosong sebagai 0 pada pembilang namun bobotnya tetap ada di penyebut; sistem ini membedakan kosong dan 0.
7. Nama sheet terpotong 31 karakter dan memuat kelas (`T1`, `T2`) atau praktikum (`Prak.`); hanya saran target offering.
8. Dimensi sheet (`!ref`) sampai baris 1000 meski data hanya puluhan baris.
