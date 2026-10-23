# Setup dan operasi

## Prasyarat

| Kebutuhan | Versi | Catatan |
|---|---|---|
| Bun | 1.4 atau lebih baru | runtime, pengelola paket, dan runner tes unit/integrasi |
| Node.js | 24 | runtime Playwright dan hasil build `adapter-node` |
| Docker + Compose | terkini | hanya untuk PostgreSQL pengembangan |
| Browser Playwright | Chromium | `bunx playwright install chromium` bila belum ada |

## Variabel lingkungan

Nilai dev lokal berada di `.env.local` (di-gitignore). `.env.example` memuat nama variabel tanpa nilai rahasia. Jangan menimpa `.env` milik pengguna dan jangan mencetak nilainya.

| Variabel | Fungsi | Catatan |
|---|---|---|
| `DATABASE_URL` | koneksi PostgreSQL aplikasi | dibaca lewat `$app/env/private` |
| `ORIGIN` | origin publik aplikasi | dipakai Better Auth, pemeriksaan CSRF, dan HSTS (aktif hanya bila `https://`) |
| `BETTER_AUTH_SECRET` | penanda token sesi | produksi: minimal 32 karakter acak |
| `AUTH_RATE_LIMIT_ENABLED` | pembatas laju login | bawaan `true`; hanya `false` pada tes |
| `UPLOADTHING_TOKEN` | token UploadThing | opsional; bila terisi, unggahan Excel dikirim browser langsung ke penyimpanan lalu diambil server (lihat bagian UploadThing); kosong berarti unggahan langsung ke server |
| `MIGRATE_DATABASE_URL` | koneksi khusus migrasi | opsional; dipakai `drizzle-kit` (mis. koneksi langsung Neon, bukan pooler) |
| `TEST_DATABASE_URL` | database tes | wajib loopback dan berakhiran `_test` |
| `SUPERADMIN_EMAIL`, `SUPERADMIN_NAME`, `SUPERADMIN_PASSWORD` | masukan `seed:superadmin` | password harus memenuhi kebijakan (10+ karakter, besar, kecil, angka, simbol) |
| `OBE_LOCAL_EXCEL_DIR` | folder Excel asli untuk tes `local` | bawaan `~/Downloads`; tidak pernah disalin ke repositori |

## Langkah pertama

```bash
bun install
bun run db:up
bun run db:migrate
bun run seed:superadmin
bun run dev
```

| Perintah | Hasil |
|---|---|
| `bun run db:up` / `db:down` / `db:logs` / `db:status` / `db:psql` | mengelola kontainer PostgreSQL 17.6 (`obe-tb-postgres`, port loopback `55432`) |
| `bun run db:generate` | membuat migrasi dari skema Drizzle |
| `bun run db:migrate` | menerapkan migrasi ke `obe_dev` |
| `bun run seed:superadmin` | membuat Super Admin dari variabel `SUPERADMIN_*`; idempoten |
| `bun run seed:curriculum` | memuat blueprint kurikulum (8 CPL beratribut WA/WK, 4 profil lulusan, 7 bidang kerja, tautannya) dan 88 mata kuliah Kurikulum 2021; idempoten dan aman untuk produksi; `-- --overwrite` mengembalikan data ke blueprint (lihat `curriculum-data.md`) |
| `bun run seed:lecturers` | membuat akun dosen dari berkas JSON di luar repositori (`--file`, `--actor <email Super Admin>`) dengan kata sandi dari `LECTURER_SEED_PASSWORD`; semua akun wajib ganti kata sandi saat masuk pertama |
| `bun run import:semesters` | impor massal `Semester N.xlsx` (`--dir`, `--actor <email Super Admin>`, `--year`, `--term`, `--levels`, `--commit`); tanpa `--commit` hanya latihan pada basis data uji; lihat `excel-import-contract.md` |
| `bun run seed:demo` | data demo sintetis (2 kelas, 2 dosen, 3 CPL, 5 CPMK, kebijakan, nilai) dan satu akun admin demo; hanya berjalan pada database loopback non-produksi; idempoten |
| `bun run db:test:reset` | menghapus dan membuat ulang `obe_test` lalu memigrasikannya |
| `bun run db:test:template` | membangun ulang template `obe_template_test` bila migrasi berubah |

`seed:demo` mencetak password sementara dosen dan password admin demo satu kali. Simpan saat itu juga; keduanya tidak dapat ditampilkan lagi. Dosen wajib mengganti password pada login pertama.

## Akun dan peran

- Hanya ada dua peran: `super_admin` (Kaprodi) dan `lecturer` (Dosen). Tidak ada pendaftaran mandiri dan mahasiswa tidak memiliki akun.
- Super Admin membuat akun dosen; password sementara muncul sekali di layar dan wajib diganti saat masuk.
- Menonaktifkan dosen mencabut seluruh sesinya.

## Unggah berkas lewat UploadThing

Fungsi serverless Vercel menolak badan permintaan di atas 4,5 MB, sedangkan berkas impor dapat mencapai 10 MB. Karena itu, saat `UPLOADTHING_TOKEN` terisi, browser mengunggah berkas langsung ke UploadThing dan server hanya menerima referensinya.

```
browser ──presign──▶ /api/uploadthing (sesi + peran dicek, nama berkas dibatasi .xlsx/.csv)
browser ──PUT──────▶ UploadThing (customId = <id akun>:<uuid>)
browser ──form─────▶ ?/uploadStored (fileRef, fileName)
server  ──ambil────▶ UploadThing (URL bertanda tangan, batas 10 MB), stageUpload, lalu hapus berkas di UploadThing
```

- Referensi berkas harus berawalan ID akun pemanggil; referensi akun lain ditolak sebelum menyentuh penyimpanan.
- Berkas di UploadThing dihapus segera setelah masuk ke tabel staging (berhasil maupun gagal), sehingga data mahasiswa tidak menetap di pihak ketiga. Kegagalan penghapusan tidak menggagalkan impor.
- Di dashboard UploadThing atur akses berkas (ACL) menjadi *private*; server memakai URL bertanda tangan 2 menit dan kembali ke URL biasa bila berkas publik.
- CSP mengizinkan `https://*.uploadthing.com` dan `https://*.ufs.sh` hanya pada `connect-src`.
- E2E memaksa mode langsung (`UPLOADTHING_TOKEN=''` pada server uji) agar tidak mengirim berkas ke layanan luar. Untuk memakai mode langsung saat pengembangan, kosongkan variabel itu.

## Neon (PostgreSQL produksi)

```bash
bunx neonctl projects create --name obe-tb --region-id aws-ap-southeast-1 --org-id <id-organisasi>
bunx neonctl connection-string --project-id <id> --database-name neondb --ssl require             # langsung
bunx neonctl connection-string --project-id <id> --database-name neondb --ssl require --pooled    # pooler
MIGRATE_DATABASE_URL="<koneksi langsung>" bun run db:migrate
DATABASE_URL="<koneksi langsung>" BETTER_AUTH_SECRET="<acak>" ORIGIN="https://<domain>" bun run seed:superadmin
```

- Aplikasi memakai koneksi **pooler** (host berisi `-pooler`); klien otomatis mematikan prepared statement (`prepare: false`) karena PgBouncer mode transaksi. Migrasi dan seed memakai koneksi langsung.
- Jangan menjalankan `seed:demo` pada Neon: skrip menolak host non-loopback. `seed:curriculum` dan `seed:lecturers` memang dimaksudkan untuk produksi: keduanya idempoten dan hanya menambah data yang belum ada.
- Urutan data awal produksi: `db:migrate` (koneksi langsung), `seed:superadmin`, `seed:curriculum`, `seed:lecturers`. Kata sandi dosen bersama harus segera diganti oleh masing-masing dosen; sistem memaksanya pada login pertama.
- String koneksi berisi kata sandi; simpan hanya sebagai variabel lingkungan.

## Vercel

`vite.config.ts` memilih `adapter-vercel` bila variabel `VERCEL` ada (otomatis di build Vercel) dan `adapter-node` selain itu, sehingga `bun run build` lokal dan E2E tidak berubah. Fungsi dijalankan di `sin1` (dekat Neon Singapura) dengan `maxDuration` 60 detik untuk validasi dan commit impor yang besar.

```bash
vercel link --yes --project obe-tb
printf '%s' "$VALUE" | vercel env add DATABASE_URL production --sensitive      # pooler Neon
printf '%s' "$VALUE" | vercel env add BETTER_AUTH_SECRET production --sensitive # acak 48 byte
printf '%s' "$VALUE" | vercel env add UPLOADTHING_TOKEN production --sensitive
printf '%s' "https://obe-tb.vercel.app" | vercel env add ORIGIN production
vercel deploy --prod --yes
```

- `ORIGIN` harus sama dengan domain produksi (dipakai Better Auth, pemeriksaan CSRF, dan HSTS). Bila domain berubah, ubah variabel lalu deploy ulang.
- `.vercelignore` mengecualikan berkas lingkungan, `tests/`, `docs/`, `scripts/`, dan artefak lokal dari unggahan. `vercel link` dapat menambahkan `VERCEL_OIDC_TOKEN` ke `.env.local`; hapus baris itu bila tidak dibutuhkan.
- Alamat klien diambil dari `x-forwarded-for` yang diisi Vercel, sehingga pembatas laju login per IP berfungsi tanpa pengaturan `ADDRESS_HEADER`.
- Pengecekan setelah deploy: `curl -sI https://<domain>/` (CSP dan HSTS), halaman `/login`, login Super Admin, lalu satu unggahan berkas sintetis yang dibatalkan.
- Ganti password Super Admin produksi lewat halaman Password setelah login pertama bila memakai kredensial yang sama dengan lingkungan pengembangan.

## Produksi mandiri (`adapter-node`)

```bash
bun run build
node build
```

| Pengaturan | Alasan |
|---|---|
| `ORIGIN=https://domain-anda` | `adapter-node` tidak membaca `ORIGIN` untuk menentukan protokol; tanpa pengaturan di bawah, protokol dianggap `https` dan formulir POST dari `http` ditolak (403) |
| `PROTOCOL_HEADER=x-forwarded-proto`, `HOST_HEADER=x-forwarded-host` | wajib bila di belakang reverse proxy yang menghentikan TLS |
| `ADDRESS_HEADER=x-forwarded-for`, `XFF_DEPTH=1` | agar alamat klien benar; dipakai pembatas laju login per IP |
| `BODY_SIZE_LIMIT=12M` | batas bawaan 512 KB menolak unggahan Excel; aplikasi membatasi berkas 10 MB |
| `BETTER_AUTH_SECRET` acak 32+ karakter | jangan memakai nilai dev |
| HTTPS di proxy | HSTS dikirim otomatis hanya bila `ORIGIN` berawalan `https://` |

Proxy harus menimpa (bukan meneruskan) header `X-Forwarded-*` dari klien. Pembatas laju bawaan Better Auth hanya melindungi endpoint `/api/auth/*`; pembatas login aplikasi sendiri (per IP dan per email, atomik di tabel `rate_limit`) melindungi form masuk. Log Better Auth dapat memperingatkan bahwa IP klien tidak diketahui bila proxy tidak meneruskan alamat.

### Berkas sementara impor

Berkas yang diunggah disimpan di PostgreSQL (`import_staged_files`, `bytea`) hingga 24 jam, lalu dihapus saat commit, pembatalan, atau pada unggahan berikutnya yang membersihkan baris kedaluwarsa. Tidak ada berkas di disk server.

### Pencadangan dan pemulihan

```bash
docker compose -f docker-compose.dev.yml exec -T postgres pg_dump -U obe -d obe_dev --format=custom > cadangan.dump
docker compose -f docker-compose.dev.yml exec -T postgres pg_restore -U obe -d obe_dev --clean --if-exists < cadangan.dump
```

Cadangan memuat NIM dan nama mahasiswa sehingga harus diperlakukan sebagai data pribadi: simpan terenkripsi dan jangan masukkan ke repositori.

## Batasan yang diketahui

- Dashboard dan hasil CPL tingkat program memerlukan kebijakan OBE aktif dengan metode agregasi; tanpa itu sistem sengaja tidak menampilkan angka gabungan.
- Format `.xls` lama tidak didukung (hanya `.xlsx` dan `.csv`).
- Ukuran berkas impor maksimum 10 MB, 5.000 baris dan 200 kolom per sheet.
- Pembatalan atau penghapusan data mahasiswa tidak tersedia; data dipertahankan beserta riwayat revisi.
