# Lineage data dan rumus OBE

Dokumen ini menjelaskan dari mana setiap angka capaian berasal dan bagaimana menelusurinya kembali ke baris Excel.

## Jalur data

```
Sel Excel
  → assessment_scores            nilai mentah per (pendaftaran, komponen); sumber: batch, sheet, baris
  → assessment_revisions         riwayat tiap penambahan dan perubahan nilai
  → cpmk_results (calculated)    dihitung dari komponen, bobot, dan pemetaan komponen→CPMK
  → cpl_results  (calculated)    dihitung dari CPMK dan pemetaan CPMK→CPL
  → analitik kelas dan program   dibaca dari hasil tersimpan; tidak dihitung ulang di UI

Kolom CPMK/CPL pada Excel
  → cpmk_results / cpl_results (imported_reference)   pembanding; tidak pernah menimpa hasil hitung
```

`result_source` bernilai `calculated`, `imported_reference`, atau `manual_approved` (cadangan untuk koreksi yang disahkan). Satu pendaftaran dapat memiliki hasil `calculated` dan `imported_reference` untuk CPMK yang sama; keduanya ditampilkan berdampingan dan selisihnya ditandai.

## Rumus v1 (`formulaVersion = 'v1'`)

Nilai ternormalisasi: `norm = skor / skor_maks × 100`.

**CPMK** untuk satu mahasiswa memakai komponen yang dipetakan ke CPMK itu dengan koefisien `k` dan bobot `w` (persen):

```
CPMK = Σ(k · w · norm) / Σ(k · w)      atas komponen terpetakan
```

| Kondisi | Status |
|---|---|
| tidak ada komponen terpetakan, ada bobot kosong, atau total bobot nol | `not_configured` (tidak dihitung, tidak ditulis) |
| komponen wajib kosong atau nilai di luar rentang | `incomplete` (nilai `null`) |
| semua komponen wajib terisi | `complete` |

Komponen opsional yang kosong dilewati dan tidak masuk penyebut.

**CPL** untuk satu mahasiswa pada satu kelas:

```
CPL = Σ(bobot_cpmk · CPMK) / Σ(bobot_cpmk)
```

`incomplete` bila ada CPMK terpetakan yang belum lengkap; `not_configured` bila ada CPMK tanpa konfigurasi komponen atau tidak ada pemetaan CPMK→CPL.

**Nilai akhir** kelas hanya dihitung bila seluruh komponen berbobot dan jumlahnya 100% (toleransi 0,5): `Σ(w · norm) / Σ(w)`. Selain itu `not_configured` dengan alasan (`WEIGHT_MISSING` atau `WEIGHT_TOTAL_MISMATCH`).

Nilai kosong tidak pernah diperlakukan sebagai 0.

## Ketercapaian

Klasifikasi mengikuti kebijakan OBE aktif:

| Hasil | Arti |
|---|---|
| `tercapai` | nilai ≥ target |
| `belum_tercapai` | nilai < target |
| `belum_cukup_data` | nilai `null` (belum lengkap) |
| `target_belum_dikonfigurasi` | kebijakan atau target belum ditetapkan |

Ambang CPMK = `achievementThreshold` kebijakan; target CPL = `cpl_targets` kebijakan. Rasio ketercapaian kelas = tercapai ÷ (tercapai + belum tercapai); kelas "memenuhi rasio" bila rasio ≥ `classAchievementRatio`. Tanpa ambang atau target, sistem tidak mengklaim ketercapaian.

## Kebijakan OBE berversi

`outcome_policies`: `draft` → `active` → `retired`, hanya satu `active` pada satu waktu. Kebijakan aktif tidak dapat diubah; perubahan dilakukan lewat salinan draf lalu aktivasi (dengan audit). Metode agregasi CPL antar kelas: `not_configured` (bawaan; tidak ada angka gabungan), `simple_mean`, `credit_weighted_mean`. Angka tingkat program atau lintas mata kuliah ditampilkan hanya bila metode dipilih; selain itu halaman menjelaskan alasannya dan menampilkan rincian per kelas.

## Hitung ulang

`recomputeOffering` dipicu oleh: commit impor, perubahan komponen, perubahan pemetaan komponen→CPMK, perubahan pemetaan CPMK→CPL, dan tombol hitung ulang manual. Prosesnya:

1. memuat komponen aktif, pemetaan, nilai, dan kebijakan aktif dalam satu transaksi;
2. menghitung semua hasil; hanya baris yang berubah (nilai, kelengkapan, versi formula, kebijakan) yang ditulis;
3. menghapus hasil basi (kombinasi yang tidak lagi terkonfigurasi);
4. mencatat satu `outcome_calculation_runs` (pemicu, versi formula, kebijakan, jumlah baris) hanya bila ada perubahan.

Menjalankannya berulang tanpa perubahan data tidak menulis apa pun (idempoten).

## Provenance pada setiap hasil

`cpmk_results` dan `cpl_results` menyimpan `source`, `formula_version`, `policy_id`, `run_id`, `batch_id` (untuk referensi impor), `computed_at`, dan `inputs` (jejak per komponen: nilai, ternormalisasi, bobot, koefisien, yang kosong). Profil mahasiswa menampilkan sumber dan waktu hitung; riwayat nilai ada pada tab "Riwayat perubahan".

## Pembatasan dan kejujuran data

- Hasil yang tidak dapat dihitung tampil sebagai "belum lengkap" atau "belum dikonfigurasi", bukan 0.
- Rata-rata dan sebaran hanya memakai data lengkap; jumlah data kurang selalu ditampilkan.
- Profil dosen hanya memuat hasil di kelas yang diampunya.
