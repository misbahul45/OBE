# OBE Teknik Biomedis (obe-tb)

Sistem informasi Outcome-Based Education untuk S1 Teknik Biomedis: SvelteKit 3 + Svelte 5 (runes), Bun, Drizzle ORM + PostgreSQL, Better Auth, Tailwind 4 + shadcn-svelte (Nova/Lucide/Geist). UI berbahasa Indonesia; identifier, tabel, dan nama file berbahasa Inggris.

## Aturan keras (jangan dilanggar)

1. **Dilarang `git commit`, `git push`, dan `git init`** kecuali pengguna meminta eksplisit pada pesan itu. Repo ini bukan repositori git saat ini. Perubahan dilacak lewat ledger (`docs/tracking`), bukan commit.
2. **Kode tanpa komentar.** Tidak ada `//`, `/* */`, JSDoc, `<!-- -->`, atau komentar CSS/YAML/SQL di kode. Penjelasan, alasan desain, dan kontrak ditulis di `docs/`. Nama yang jelas menggantikan komentar. Ditegakkan oleh `bun run guard`.
3. **Struktur feature-based domain.** Semua kode domain berada di `src/lib/features/<fitur>/` (schema, service, query, validasi, tipe, komponen UI fitur itu). Lintas fitur hanya lewat `index.ts`, `index.server.ts`, `*.schema.ts`, atau `*.types.ts`. Kode lintas-fitur yang generik di `src/lib/shared/`. `src/lib/components/ui` hanya untuk primitif shadcn-svelte. `src/routes` tipis: validasi sesi/input, panggil service fitur, kembalikan data.
4. **Berkas server-only memakai akhiran `.server.ts`.** Impor `node:*`, `postgres`, `xlsx`, `pdfkit`, `better-auth` sisi server, `$app/env/private`, dan `$app/server` hanya di berkas `*.server.ts` (kecuali `*.schema.ts` yang hanya memakai `drizzle-orm/pg-core`).
5. **Otorisasi di server pada setiap load/action/endpoint.** Default-deny. Dosen tidak boleh mengakses offering yang tidak ditugaskan, walau ID diganti di request.
6. **NIM selalu string.** Nilai kosong (`null`) tidak sama dengan `0`. Hasil CPMK/CPL dari Excel disimpan sebagai `imported_reference`, bukan nilai komponen mentah.
7. **Tidak ada data akademik nyata di repo, log, screenshot, atau fixture.** Fixture sintetis saja. Excel uji asli berada di `~/Downloads` dan hanya dibaca lokal.
8. **Jangan menimpa `.env` pengguna** atau mencetak nilai secret. Nilai dev lokal ada di `.env.local` (di-gitignore).
9. Jangan mengklaim lulus sebelum perintah verifikasinya dijalankan. Status: `PASS`, `FAIL`, `BLOCKED/NOT RUN`.

## Closed loop pengembangan

`PLAN (ledger) → BUILD → VERIFY → RECORD → NEXT`. Detail di `docs/process/closed-loop.md`.

```bash
bun run track next
bun run track start T-xxx
bun run track verify T-xxx
bun run track note T-xxx "bukti manual"
bun run track check
bun run guard
```

Sebelum menyatakan task selesai: `bun run track verify <id>` harus PASS, lalu `bun run track check` dan `bun run guard` lulus.

## Perintah

```bash
bun run db:up
bun run db:migrate
bun run seed:superadmin
bun run dev
bun run check
bun run test
bun run test:e2e
bun run build
```

## Catatan teknis SvelteKit 3

- Tidak ada `svelte.config.js`; konfigurasi lewat `sveltekit({...})` di `vite.config.ts`.
- Env didefinisikan di `src/env.ts` (`defineEnvVars`) dan dibaca lewat `$app/env/private`.
- Alias: `#lib/*` → `src/lib/*` (package.json `imports`). Impor TypeScript memakai ekstensi `.ts`.
- Logika domain murni (tanpa `$app/*`) agar bisa diuji dengan `bun test`.

## Peta dokumen

`docs/README.md` adalah indeks. Status terkini: `docs/tracking/STATUS.md`.
