# OBE Teknik Biomedis

Sistem informasi Outcome-Based Education untuk Program Studi S1 Teknik Biomedis. Super Admin (Kaprodi) dan dosen mengimpor nilai dari Excel, sistem menghitung CPMK dan CPL secara dapat ditelusuri, lalu menampilkan dasbor, profil mahasiswa, laporan PDF, dan alur perbaikan berkelanjutan (CQI).

Tumpukan: SvelteKit 3 + Svelte 5 (runes), Bun, TypeScript, Drizzle ORM + PostgreSQL, Better Auth, Tailwind 4 + shadcn-svelte.

## Mulai cepat

```bash
bun install
bun run db:up
bun run db:migrate
bun run seed:superadmin   # membaca SUPERADMIN_* dari .env.local
bun run seed:demo         # opsional: data demo sintetis (hanya database lokal)
bun run dev
```

Variabel yang dibutuhkan dan langkah produksi ada di [docs/setup.md](docs/setup.md).

## Fitur

- Peran Super Admin dan Dosen; tanpa pendaftaran mandiri, tanpa akun mahasiswa.
- Data induk: tahun akademik, semester, mata kuliah, penawaran kelas, penugasan dosen.
- Kurikulum: CPL, CPMK, pemetaan, komponen asesmen, kebijakan OBE berversi.
- Impor Excel (.xlsx/.csv) dengan deteksi struktur, pemetaan, validasi, dry-run, dan commit atomik yang idempoten.
- Kalkulasi komponen → CPMK → CPL dengan status kelengkapan; hasil Excel disimpan sebagai pembanding.
- Dasbor program studi dan dosen, analitik kelas, profil mahasiswa lintas semester.
- Transkrip dan laporan kelas PDF, CSV catatan galat.
- CQI: temuan, tindakan, bukti, evaluasi dengan alur status bergerbang.
- Jejak audit dan riwayat revisi nilai.

## Perintah

| Perintah | Fungsi |
|---|---|
| `bun run dev` | server pengembangan |
| `bun run build` | build produksi (`adapter-node`) |
| `bun run check` | `svelte-check` |
| `bun run guard` | aturan keras: tanpa komentar, feature-based, batas server/klien, tata letak tes |
| `bun run test` | unit dan integrasi (PostgreSQL nyata, database terisolasi per suite) |
| `bun run test:e2e` | Playwright (butuh Docker PostgreSQL) |
| `bun run track next` / `verify <id>` / `check` | ledger pengembangan (closed loop) |
| `bun run docs:check` | konsistensi ledger dan guard |

## Dokumentasi

Indeks ada di [docs/README.md](docs/README.md). Status pengembangan terkini: [docs/tracking/STATUS.md](docs/tracking/STATUS.md). Aturan proyek: [CLAUDE.md](CLAUDE.md).

## Privasi

Repositori tidak memuat data akademik nyata. Fixture seluruhnya sintetis; Excel asli hanya dibaca lokal oleh tes opt-in. Lihat `tests/unit/shared/privacy.test.ts`.
