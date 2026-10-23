# Data kurikulum dan dosen: asal, cakupan, dan batasan

Dokumen ini menjelaskan data program studi yang dimuat oleh `bun run seed:curriculum` dan `bun run seed:lecturers`, dari mana angka dan teksnya berasal, serta hal yang sengaja tidak dimuat. Keputusan terkait: `tracking/decisions.md` D-31.

## Yang dimuat

| Data | Jumlah | Sumber | Perintah |
|---|---|---|---|
| CPL beserta atribut WA dan profil pengetahuan WK | 8 | dokumen sesi OBE milik pengguna (sheet Deskripsi CPL) | `seed:curriculum` |
| Profil lulusan | 4 | dokumen yang sama (sheet CPL terhadap Profil dan uraian profil) | `seed:curriculum` |
| Bidang kerja | 7 | dokumen yang sama; nama selaras dengan situs dasbor prodi | `seed:curriculum` |
| Tautan CPL-profil | 8 | matriks centang pada dokumen | `seed:curriculum` |
| Tautan profil-bidang | 11 | 7 profil utama dan 4 pendukung (nilai 3 dan 1) | `seed:curriculum` |
| Mata kuliah Kurikulum 2021 | 88 | dokumen Struktur Kurikulum S1 Teknik Biomedis dari situs prodi | `seed:curriculum` |
| Dosen tetap | 13 | halaman Dosen Tetap Program Studi pada situs prodi | `seed:lecturers` |

Sumber publik yang dipakai: `tekno.fst.unair.ac.id` (halaman Dosen Tetap Program Studi, Kurikulum 2021, Peta Mata Kuliah, Panduan Mata Kuliah). Daftar nama mata kuliah yang benar-benar diajarkan pada berkas nilai (56 mata kuliah) dicocokkan dengan katalog; seluruhnya tercakup, selisihnya hanya ejaan.

## Cara memakai

```bash
bun run seed:curriculum
bun run seed:curriculum -- --overwrite

LECTURER_SEED_PASSWORD='<kata sandi>' BETTER_AUTH_SECRET='<acak>' ORIGIN='http://127.0.0.1:5173' \
  bun run seed:lecturers -- --file ~/.local/share/obe-tb/unair-lecturers.json --actor <email-super-admin>
```

- Keduanya idempoten. Tanpa `--overwrite`, data yang sudah ada dan sunting manual dipertahankan; hanya atribut WA/WK yang masih kosong dilengkapi.
- Berkas dosen berformat `[{ "name": "...", "email": "..." }]` dan **tidak** disimpan di repositori karena memuat nama dan email orang tertentu. NIP tidak dimuat.
- Kata sandi diberikan lewat variabel lingkungan, bukan argumen baris perintah. Ia harus memenuhi kebijakan kata sandi (10 karakter atau lebih, huruf besar dan kecil, angka, simbol). Setiap akun ditandai wajib ganti kata sandi pada login pertama.
- Penugasan dosen ke kelas tidak di-seed karena tidak ada pada sumber; lakukan di menu Penawaran kelas.

## Hal yang perlu diketahui dari sumber

| Temuan | Perlakuan |
|---|---|
| Tabel Panduan Mata Kuliah pada situs berasal dari kurikulum lama (berkas diunggah 2017) dan sebagian SKS-nya terbalik (Skripsi 2, Metodologi Penelitian 6) | tidak dipakai sebagai sumber SKS; dokumen Struktur Kurikulum dan Peta Mata Kuliah menjadi acuan (Skripsi 6, Metodologi Penelitian 2) |
| Dokumen Struktur Kurikulum tidak mencantumkan kode untuk enam mata kuliah (Logika dan Pemikiran Kritis, Pengantar Kolaborasi Keilmuan, Komunikasi dan Pengembangan Diri, Matematika Teknik II, Manajemen Industri dan Kewirausahaan, Robotika dan Mekatronika Biomedis); Matematika Teknik II memakai kode ganda MAT207 | diberi kode sementara `TBX001`..`TBX006` dengan keterangan "Kode sementara"; ganti lewat menu Mata kuliah bila kode resmi diketahui |
| Kode Agama II tertulis `AGI…` pada dokumen | memakai kode dari Panduan Mata Kuliah (`AGI401`, `AGP401`, `AGK401`, `AGH401`, `AGB401`); Agama Konghucu tidak memiliki kode sehingga tidak dimuat |
| Paket MBKM (sembilan mata kuliah komponen, 15 SKS per paket) tidak berkode, dan satu paket melampaui batas 12 SKS per mata kuliah di basis data | tidak dimuat |
| Dokumen menulis "Pegantar Teknobiomedik" dan "Embeded Sistem" | ejaan diperbaiki menjadi "Pengantar Teknobiomedik" dan "Embedded System" |
| Daftar CPL pada dokumen sesi OBE berbeda urutan dan redaksi dari daftar CPL pada situs dasbor prodi | blueprint mengikuti dokumen sesi OBE milik pengguna; ubah di `profiles.blueprint.ts` bila situs dasbor yang menjadi acuan |
| Dokumen sesi OBE menyebut CPL-1 tidak terkait profil mana pun | dipertahankan; halaman Profil lulusan menandainya sebagai belum terpetakan |
| Nilai bobot hubungan profil-bidang (3 utama, 1 pendukung) berasal dari asumsi pada dokumen sesi OBE, selaras dengan keterangan "(+PL)" pada situs dasbor | perlu divalidasi pemangku kepentingan |
| Target CPL, ambang, dan metode agregasi tidak ada pada sumber | tidak di-seed; tetapkan lewat menu Kurikulum sehingga angka tingkat program tidak dikarang |

Beban studi total pada dokumen resmi: 144-166 SKS. Tes `tests/unit/academic/course-catalog.test.ts` memastikan total SKS wajib setiap semester (19, 20, 20, 20, 21, 13, 11, 6) sama dengan dokumen.

## Impor nilai Semester 1 sampai 7 ke produksi (2026-10-24)

Berkas `Semester 1.xlsx` sampai `Semester 7.xlsx` diimpor dengan `scripts/import-semesters.ts`. Hasil pada produksi:

| Ukuran | Nilai |
|---|---|
| Semester aktif | Genap 2025/2026 (asumsi, lihat di bawah) |
| Sheet dibaca, disimpan, dikecualikan | 102, 92, 10 |
| Kelas dibuka otomatis | 95 (3 di antaranya belum berisi mahasiswa, lihat sheet dikecualikan) |
| Mahasiswa, pendaftaran, nilai komponen | 471, 3.139, 12.843 |
| NIM ganda, NIM berawalan 0 | 0, 0 |
| Baris ditolak | 19: `NIM_DUPLICATE_IN_SHEET` 13 (seluruhnya pada satu sheet praktikum), `SCORE_DATE_FORMAT` 2, `NIM_EMPTY` 2, `NIM_INVALID_FORMAT` 2 |

Yang dikecualikan:

| Sheet | Alasan |
|---|---|
| `Sheet1` dan `Sheet2` (tujuh sheet pada Semester 3, 4, 5, 6) | tidak berisi data nilai |
| `Kalkulus Lanjut T1`, `Elektronika Analog T1`, `Matematika Teknik I T2` | jumlah bobot komponen 125%, 90%, dan 130%; sistem tidak menebak bobot. Perbaiki bobot kolom pada tahap Atur sheet, lalu unggah ulang berkasnya (kelas dan sheet lain tidak berubah karena nilai yang sama tidak diubah) |

Asumsi dan dasar:

- **Semester:** berkas tidak memuat tahun ajaran dan wizard hanya mengenal kelas semester aktif, sehingga seluruh sheet masuk satu semester, "Genap 2025/2026" (berkas dibuat April 2026). Bila salah, ganti namanya di menu Tahun akademik; data tidak perlu diimpor ulang.
- **NIM angka:** semua NIM tersimpan sebagai angka. Konfirmasi "tidak ada NIM berawalan 0" diberikan karena 14 NIM bertipe teks pada Semester 7 berpanjang 11 digit dan tidak ada yang berawalan 0, sama dengan panjang NIM angka (8, 9, 11, 12 digit tersebar sesuai angkatan).
- **Baris ditolak:** dilewati dan tidak mengubah baris lain. Salah satu sheet praktikum memuat NIM yang sama dua kali; baris pertama yang dipakai.
- **Belum ada hasil CPMK dan CPL terhitung:** impor hanya menyimpan nilai komponen. Hasil muncul setelah CPMK per mata kuliah, pemetaan komponen ke CPMK, pemetaan CPMK ke CPL, dan kebijakan OBE aktif dikonfigurasi. Nilai CPL pada Excel disimpan sebagai referensi impor.
- **Dosen belum ditugaskan** pada kelas mana pun karena berkas tidak memuat penugasan.
