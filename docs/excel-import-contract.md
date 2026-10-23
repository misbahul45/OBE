# Kontrak impor Excel

Dokumen ini adalah kontrak perilaku impor nilai. Tes yang menegakkannya ada di `tests/unit/imports`, `tests/integration/imports`, dan `tests/e2e/imports`.

## Berkas yang diterima

| Aturan | Nilai |
|---|---|
| Format | `.xlsx` dan `.csv` (UTF-8, pemisah dideteksi); `.xls` ditolak |
| Ukuran | maksimum 10 MB |
| Sheet | maksimum 60; sheet tersembunyi dilewati dan dilaporkan |
| Dimensi sheet | maksimum 5.000 baris dan 200 kolom |
| Keamanan arsip | magic bytes ZIP diperiksa; maksimum 500 entri, 120 MB tak terkompres, rasio kompresi 200 |
| Nama berkas | disanitasi (path, karakter berbahaya) dan disimpan sebagai `file_name`; isi berkas tidak dieksekusi |

Kegagalan menghasilkan kode yang jelas (`CORRUPT_FILE`, `ZIP_BOMB`, `UNSUPPORTED_TYPE`, `EMPTY_FILE`, `FILE_TOO_LARGE`, `SHEET_TOO_LARGE`), tanpa membuat batch dan tanpa menyimpan apa pun.

## Deteksi struktur (per sheet)

1. **Baris header** dicari sebagai baris yang memuat kolom NIM; header bertingkat (beberapa baris, sel gabungan) digabung. Dosen dapat menentukan ulang nomor baris header secara manual.
2. **Peran kolom**: nomor, NIM, nama, komponen nilai, CPMK referensi, CPL referensi, diabaikan, metadata. Setiap deteksi membawa tingkat keyakinan (tinggi/sedang/rendah) dan alasan.
3. **Bobot** dibaca dari header berpola `(NN %)`; jumlah bobot dibandingkan dengan 100% (toleransi 0,5 poin).
4. **Kolom hantu**: kolom kosong yang berbobot tetap dikenali sebagai komponen agar jumlah bobot tidak salah.
5. **Baris mahasiswa**: baris dengan identitas (NIM atau nama) dan nilai mentah (bukan hasil rumus). Baris ringkasan, rata-rata, dan keterangan di bawah daftar dikecualikan sebagai `ROW_EXCLUDED`/`FOOTER_ROW`; baris bernilai tanpa identitas dikecualikan dengan peringatan.
6. **Blok metadata** di sisi kanan (matriks CPMK-komponen, matriks CPL-CPMK, ambang, ringkasan ketercapaian) tidak pernah diimpor sebagai data mahasiswa.
7. **Sidik jari struktur** (fingerprint) dihitung dari bentuk header dan peran kolom, bukan nama berkas. Preset pemetaan tersimpan dicocokkan lewat sidik jari ini.
8. **Petunjuk kelas** diambil dari nama sheet dan dipakai menyarankan penawaran kelas hanya bila tepat satu kandidat dalam cakupan pengguna.

## Aturan nilai

| Masukan | Perlakuan |
|---|---|
| NIM bertipe teks | dibersihkan dari spasi/karakter tak terlihat dan awalan `'`; harus 6-15 digit |
| NIM bertipe angka | diterima bila bilangan bulat aman; digit 0 di depan tidak dapat dipulihkan sehingga dosen wajib mengonfirmasi (`NIM_NUMERIC_UNACKNOWLEDGED` menahan impor sampai dikonfirmasi) |
| NIM notasi ilmiah | direkonstruksi hanya bila digitnya lengkap; selain itu `NIM_SCIENTIFIC_AMBIGUOUS` |
| NIM kosong, tidak valid, atau ganda dalam sheet | galat baris (`NIM_EMPTY`, `NIM_INVALID_FORMAT`, `NIM_DUPLICATE_IN_SHEET`) |
| Nama kosong | `NAME_EMPTY`; nama berbeda dari master: `NAME_CONFLICT`, nama master dipertahankan |
| Nilai kosong | disimpan sebagai `null` (kosong), **bukan** `0`; komponen wajib yang kosong membuat CPMK terkait belum lengkap |
| Nilai angka dengan koma desimal | diterima (`85,5` = `85.5`) |
| Nilai teks bukan angka, tanggal, galat rumus | galat sel (`SCORE_NOT_NUMERIC`, `SCORE_DATE_FORMAT`, `SCORE_FORMULA_ERROR`) |
| Rumus tanpa nilai tersimpan (cache) | dianggap kosong dengan peringatan `SCORE_FORMULA_NO_CACHE` |
| Nilai di luar 0..nilai maksimum komponen | `SCORE_OUT_OF_RANGE` |
| Kolom CPMK/CPL pada Excel | disimpan sebagai `imported_reference`, tidak pernah menjadi nilai komponen |

Daftar kode lengkap dan pesannya ada di `imports.issues.ts` (`issueCatalog`).

## Alur wizard

| Tahap | Perilaku | Mengubah data akademik? |
|---|---|---|
| Unggah | berkas dianalisis dan disimpan di tabel staging (`bytea`, kedaluwarsa 24 jam); satu pemetaan per sheet dibuat | tidak |
| Atur sheet | pilih kelas tujuan (hanya kelas yang ditugaskan; Super Admin semua), sertakan atau keluarkan sheet, konfirmasi NIM angka, edit pemetaan kolom, simpan sebagai preset | tidak |
| Validasi (dry-run) | simulasi penuh terhadap data saat ini; isu dicatat; ringkasan baru/diubah/sama per entitas | tidak |
| Simpan | gerbang diperiksa ulang di server, lalu satu transaksi atomik | ya |

### Gerbang (penghalang penyimpanan)

`OFFERING_NOT_SELECTED`, `OFFERING_NOT_FOUND` (termasuk pelanggaran akses yang diperiksa ulang saat commit), `SHEET_ERRORS`, `ROW_ERRORS` (kecuali kebijakan "lewati baris galat"), `NIM_NUMERIC_UNACKNOWLEDGED`, `SCORE_UPDATES_UNCONFIRMED` (ada nilai lama yang berubah), `WEIGHT_CHANGES_UNCONFIRMED` (bobot komponen berubah), `NOTHING_TO_IMPORT`.

Pilihan strategi: `upsert` (tambah dan perbarui) atau `insert_missing` (hanya tambah). Kebijakan galat: `block_on_error` atau `skip_invalid_rows`.

### Commit atomik dan idempotensi

- Seluruh sheet disimpan dalam satu transaksi; kegagalan membatalkan semuanya.
- Mahasiswa di-upsert berdasarkan NIM, pendaftaran berdasarkan (mahasiswa, kelas), komponen berdasarkan (kelas, kode), nilai berdasarkan (pendaftaran, komponen). Baris dikunci (`FOR UPDATE`) selama pembaruan.
- Nilai yang sama tidak diubah dan tidak menghasilkan revisi. Mengimpor ulang berkas yang sama menghasilkan 0 perubahan.
- Setiap penambahan atau perubahan nilai menulis satu baris `assessment_revisions` (nilai lama, nilai baru, jenis, batch, pelaku).
- Audit mencatat unggah, pengaturan sheet, commit, dan pembatalan.
- Sesudah commit, CPMK/CPL kelas terkait dihitung ulang (lihat `data-lineage-obe.md`) dan berkas staging dihapus. Bila hitung ulang gagal, data tersimpan dan halaman melaporkan status "perhitungan ulang gagal".

### Duplikat dan privasi

- Berkas dengan hash SHA-256 yang sama dengan batch tersimpan milik pengunggah diberi tahu sebagai duplikat; impor ulang tetap aman. Dosen tidak melihat batch milik pengguna lain meski isinya identik.
- Laporan batch menampilkan NIM disamarkan (`*******1234`). CSV catatan galat memuat kode, sheet, baris, dan kolom, tanpa NIM maupun nama, dengan netralisasi awalan rumus.

## Pemetaan sheet ke kelas

Setiap sheet harus dipetakan ke satu kelas pada semester aktif. Ada dua jalur, dan keduanya memakai pencocok yang sama (`sheet-target.ts`):

1. **Saran saat unggah:** hanya dari kelas yang sudah ada dalam cakupan pengguna pada semester aktif. Saran diberikan bila mata kuliah dan kelasnya cocok persis; tanpa itu sheet dibiarkan kosong.
2. **Tombol "Petakan otomatis"** pada tahap Atur sheet: untuk Super Admin, kelas yang belum ada dibuka lebih dulu; untuk dosen, hanya kelas yang ditugaskan kepadanya yang dapat dipetakan.

| Aturan | Perlakuan |
|---|---|
| Nama mata kuliah | harus sama persis setelah normalisasi (huruf kecil, `&` menjadi "dan", `Tek.` menjadi "Teknik", tanda baca dibuang); tiga ejaan berbeda diselesaikan dengan alias terbatas; nama terpotong 31 karakter (batas Excel) cocok lewat awalan hanya bila unik dan sedikitnya 14 karakter |
| Praktikum | sheet berawalan `Prak.` atau berakhiran `(Praktikum` dicocokkan ke mata kuliah "Praktikum ..." dan tidak pernah tertukar dengan teorinya |
| Kelas | `T`, `T1`, `T2`, dan seterusnya dari nama sheet; angkatan pada nama (`T1 2021`, `2022 ...`) menjadi awalan (`21T1`, `22A`); tanpa penanda berarti `A` |
| Tanpa penanda kelas | dipetakan ke satu-satunya kelas mata kuliah itu bila hanya ada satu; bila lebih dari satu, tidak dipetakan |
| Sheet yang tidak cocok | dilaporkan dengan alasan dan tetap dapat dipetakan manual; tidak pernah ditebak |
| Dua sheet ke kelas yang sama | sheet kedua dilaporkan, tidak dipetakan |
| Tanpa semester aktif | ditolak dengan petunjuk mengaktifkan semester |

Daftar kelas pada dropdown wizard memuat seluruh kelas semester aktif (tidak lagi terpotong 100 kelas pertama).

### Impor massal

`scripts/import-semesters.ts` menjalankan alur yang sama untuk banyak berkas (`Semester N.xlsx`): memastikan tahun akademik dan semester aktif, memakai ulang batch terbuka yang berkas yang sama, memetakan otomatis, memeriksa panjang NIM sebelum mengonfirmasi NIM angka (panjang harus termasuk himpunan yang diberikan lewat `--nim-lengths`, bawaan 8, 9, 11, 12, dan tidak berawalan 0), mengecualikan sheet yang tertahan, lalu menyimpan bila diberi `--commit`. Laporannya agregat tanpa NIM maupun nama.

## Batasan

- Hanya komponen numerik; sel catatan teks tidak diimpor.
- Satu sheet dipetakan ke tepat satu kelas.
- Penentuan kelas otomatis hanya saran; dosen harus memilih dan menyimpan.
