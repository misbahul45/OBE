# Closed loop pengembangan

Tujuan: setiap perubahan dapat ditelusuri dari rencana sampai bukti verifikasi, dan status proyek selalu dihitung dari bukti, bukan dari klaim.

```
PLAN ──► BUILD ──► VERIFY ──► RECORD ──► NEXT ──┐
  ▲                                              │
  └──────────────────────────────────────────────┘
```

| Tahap | Artefak | Perintah |
|---|---|---|
| PLAN | `docs/tracking/ledger.json` (task, dependensi, acceptance criteria, perintah verifikasi) | edit ledger, `bun run track check` |
| BUILD | kode di `src/lib/features/<fitur>` | `bun run track start T-xxx` |
| VERIFY | perintah di field `verify` task | `bun run track verify T-xxx` |
| RECORD | `evidence` pada task, `docs/tracking/session-log.md` | otomatis oleh `verify`; manual: `bun run track note` |
| NEXT | `docs/tracking/STATUS.md` (dihasilkan) | `bun run track next` |

## Aturan

1. Task hanya menjadi `done` jika **semua** perintah `verify` bernilai PASS pada eksekusi terakhir dan semua dependensinya `done`. Tidak ada cara mengubah status ke `done` tanpa bukti.
2. Task tanpa perintah otomatis (misalnya pemeriksaan visual) memakai `bun run track note T-xxx "apa yang dilihat"`; bukti manual wajib menyebut apa yang diperiksa, bukan sekadar "OK".
3. Acceptance criteria (AC) tidak diubah manual. Status AC dihitung: `met` jika semua task yang menautnya `done`; `partial` jika sebagian; `blocked` jika ada task blocked; `open` selain itu. Setiap AC wajib punya minimal satu task.
4. Kegagalan verifikasi: task tetap `doing`, bukti FAIL tercatat, penyebab dan perbaikan ditulis satu baris di `session-log.md` (`bun run track log "..."`). Jika akar masalah berada di luar task, buat task baru di ledger.
5. Task `blocked` wajib berisi alasan faktual dan perintah yang harus dijalankan pengguna untuk melanjutkan.
6. `bun run docs:check` (ledger konsisten + STATUS.md mutakhir + guard) harus lulus sebelum sesi ditutup.
7. Nilai `PASS`, `FAIL`, `BLOCKED/NOT RUN` dipakai apa adanya di `docs/verification-report.md`.

## Siklus satu task

```bash
bun run track next
bun run track start T-040
bun run track verify T-040
bun run track check
bun run track log "T-040 selesai: reader menolak zip-bomb; catatan..."
```

## Skema ledger

| Field task | Arti |
|---|---|
| `id`, `phase`, `title` | identitas |
| `deps` | task yang harus `done` lebih dulu |
| `ac` | acceptance criteria yang dipenuhi task ini |
| `verify` | daftar perintah shell yang membuktikan task selesai |
| `status` | `todo`, `doing`, `done`, `blocked` |
| `evidence` | riwayat hasil verifikasi (maksimal 20 terakhir): waktu, perintah, PASS/FAIL, baris ringkasan |
| `notes` | wajib untuk `blocked` |

## Sumber acceptance criteria

`AC-01..AC-17` berasal dari Definition of Done (bagian 15 prompt utama), `AC-18..AC-43` dari kriteria tambahan addendum V2 (bagian 26), dan `AC-44..AC-52` dari instruksi lanjutan pengguna (Excel uji di Downloads, aturan tanpa commit/push, closed-loop docs, kode tanpa komentar, struktur feature-based, auth, CQI, keamanan, grafik).
