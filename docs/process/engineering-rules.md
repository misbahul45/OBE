# Aturan rekayasa

Aturan ini juga ditulis di `CLAUDE.md` agar terbaca oleh agen. Penegakan otomatis: `bun run guard`.

## 1. Kode tanpa komentar

- Tidak ada komentar dalam bentuk apa pun di `src`, `scripts`, `tests`, `drizzle`, konfigurasi TypeScript, dan `docker-compose.dev.yml`.
- Alasan, kontrak, dan batasan ditulis di `docs/` (arsitektur, kontrak impor Excel, lineage data). Kode menjelaskan dirinya lewat nama fungsi, tipe domain, dan struktur modul.
- Pendeteksian memakai parser TypeScript (bukan regex), sehingga literal regex dan URL tidak menghasilkan false positive. `bun run guard -- comments --fix` menghapus komentar yang terlanjur ada.
- Berkas JSON, `.env*`, dan berkas biner tidak dipindai; `.env.example` sengaja tanpa komentar dan dijelaskan di `docs/setup.md`.

## 2. Struktur feature-based domain

```
src/
  env.ts
  hooks.server.ts
  routes/                       tipis: sesi, validasi input, panggil service fitur
  lib/
    features/
      auth/
      academic/
      lecturers/
      students/
      curriculum/
      imports/
      outcomes/
      reports/
      cqi/
      audit/
      dashboard/
      landing/
    shared/
      db/
      http/
      charts/
      format/
    components/ui/              hanya primitif shadcn-svelte
```

Anatomi satu fitur (hanya berkas yang diperlukan):

| Berkas | Isi |
|---|---|
| `<fitur>.schema.ts` | tabel Drizzle milik fitur (hanya `drizzle-orm/pg-core`) |
| `<fitur>.types.ts` | tipe domain yang aman dipakai klien |
| `<fitur>.validation.ts` | skema zod untuk form/request (dipakai klien dan server) |
| `<fitur>.queries.server.ts` | query baca |
| `<fitur>.service.server.ts` | use case, transaksi, audit |
| `components/*.svelte` | UI khusus fitur |
| `index.ts` | API publik yang aman untuk klien |
| `index.server.ts` | API publik server untuk fitur lain |

Aturan batas:

- Fitur lain hanya boleh mengimpor `index.ts`, `index.server.ts`, `*.schema.ts`, atau `*.types.ts` dari sebuah fitur.
- Berkas non-server tidak boleh mengimpor modul server atau paket server-only (`postgres`, `xlsx`, `pdfkit`, `node:*`, `$app/env/private`, `$app/server`, `better-auth` sisi server).
- Logika domain murni (parser, kalkulasi, validasi) tidak memakai `$app/*` supaya dapat diuji dengan `bun test`.
- `src/routes` tidak berisi query SQL maupun logika bisnis.

## 3. Git

- Tidak ada `git init`, `git commit`, atau `git push` kecuali diminta eksplisit oleh pengguna pada pesan tersebut.
- Pelacakan perubahan memakai ledger dan `docs/tracking/session-log.md`.

## 4. Data dan privasi

- Excel uji asli berada di `~/Downloads` (9 berkas, lihat `docs/tracking/baseline.md`) dan hanya dibaca lokal; tidak disalin ke repo.
- Fixture di `tests/fixtures` seluruhnya sintetis (nama `Mahasiswa Uji NNN`, NIM berawalan `990`).
- Log, screenshot, trace, dan laporan tidak memuat NIM atau nama nyata.

## 5. Bahasa

UI dan dokumentasi produk berbahasa Indonesia. Identifier, tabel, kolom, dan nama berkas berbahasa Inggris.
