# Manajemen tes

Tes dipisah berdasarkan jenis, fitur, dan data. Tidak ada tumpukan tes campuran.

## Jenis tes

| Jenis | Lokasi | Sentuhan eksternal | Berakhiran | Dijalankan oleh |
|---|---|---|---|---|
| unit | `tests/unit/<fitur>/` | tidak ada database, jaringan, atau browser | `.test.ts` | `bun run test:unit` |
| integration | `tests/integration/<fitur>/` | PostgreSQL nyata, database terisolasi per suite | `.test.ts` | `bun run test:integration` |
| e2e | `tests/e2e/<fitur>/` | browser (Playwright), aplikasi hasil build, database E2E sendiri | `.spec.ts` | `bun run test:e2e` |
| local | `tests/local/<fitur>/` | berkas nyata di mesin pengguna (opt-in, tidak masuk `test`) | `.test.ts` | `bun run test:local` |

`<fitur>` harus sama dengan folder di `src/lib/features` atau `shared`. Berkas bantu bukan tes berada di `tests/support/`; data tes di `tests/fixtures/`.

## Isolasi data

| Sumber data | Database | Siklus hidup |
|---|---|---|
| tes unit | tidak memakai database | tidak ada |
| tes integrasi | klon dari `obe_template_test`: `obe_<suite>_<6hex>_test` | dibuat di `beforeAll`, dihapus di `afterAll` |
| tes E2E | `obe_test` (`TEST_DATABASE_URL`) | direset dan di-seed `scripts/e2e-seed.ts` pada awal setiap `bun run test:e2e` |
| development | `obe_dev` | tidak pernah disentuh tes |

- `obe_template_test` dimigrasi satu kali. Fingerprint isi folder `drizzle/` disimpan sebagai komentar database; template dibangun ulang otomatis hanya jika migrasi berubah. Klon dari template memakan waktu puluhan milidetik.
- Guard (`assertTestDatabaseUrl`) menolak URL yang bukan loopback, nama yang tidak berakhiran `_test`, nama berhuruf besar, dan nama yang memuat karakter berbahaya.
- Satu suite integrasi = satu berkas. Berkas memakai `useIsolatedDatabase('<nama_suite>')` dari `tests/support/integration.ts`, sehingga data satu berkas tidak pernah terlihat di berkas lain dan berkas dapat dijalankan sendiri-sendiri.
- Template dan klon sisa dari proses yang mati dibersihkan saat template dibangun ulang.

## Aturan yang ditegakkan `bun run guard`

1. Berkas tes harus berada di `tests/<jenis>/<fitur>/` dan berakhiran sesuai jenisnya.
2. Tes unit tidak boleh mengimpor `postgres`, `drizzle-orm/postgres-js`, `shared/db/*`, `tests/support/integration`, atau Playwright.
3. Tes integrasi tidak boleh mengimpor Playwright maupun tes unit/e2e.
4. Spec E2E tidak boleh mengimpor `#lib/*`, driver database, atau tes jenis lain; akses data lewat `tests/support/e2e/*`.
5. Folder `tests/` hanya berisi `unit`, `integration`, `e2e`, `local`, `support`, `fixtures`.

## Perintah

```bash
bun run test:unit
bun run test:integration
bun run test:e2e
bun run test:local
bun run test:feature imports
bun run test:feature imports --e2e
bun run test
bun run test:all
bun test tests/integration/shared/isolated-database.test.ts
```

`bun run test` menjalankan unit lalu integrasi sebagai dua langkah terpisah dengan ringkasan masing-masing. `test:feature <fitur>` menjalankan unit dan integrasi fitur itu saja, berlabel per jenis.

## Data tes

- Fixture seluruhnya sintetis (`tests/fixtures/workbooks`), dibangkitkan deterministik oleh `tests/fixtures/builders`.
- Tes `local` membaca Excel asli dari `OBE_LOCAL_EXCEL_DIR` (default `~/Downloads`), hanya melaporkan agregat (jumlah sheet, kolom, baris), dan dilewati bila direktori tidak ada.
- `tests/unit/shared/privacy.test.ts` memastikan fixture hanya berisi NIM dan nama sintetis, tidak ada spreadsheet di luar `tests/fixtures/workbooks`, tidak ada angka menyerupai NIM atau surel di luar domain cadangan, dan artefak tampilan di-gitignore. `tests/local/shared/privacy-downloads.test.ts` memastikan Excel asli di Downloads tidak pernah disalin ke repositori (perbandingan hash).

Pengujian E2E, audit aksesibilitas, dan audit visual dijelaskan di `testing-e2e.md`.
