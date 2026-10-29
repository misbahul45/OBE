# Riset kebutuhan grafik capaian OBE

Dokumen ini mencatat dasar pemilihan grafik pada kelas, program, dan profil mahasiswa. Hanya sumber yang benar-benar dibaca pada sesi 2026-10-28 yang dikutip; hal yang tidak ditemukan di literatur ditandai.

## Yang dibutuhkan pengguna OBE

| Kebutuhan | Dasar | Grafik yang menjawab |
|---|---|---|
| Peringatan ambang: CPMK atau CPL mana yang tidak memenuhi target | CLOAP memberi peringatan ambang yang dapat dikonfigurasi, contoh 70% mahasiswa dengan nilai minimal 60% pada tiap CPMK ([CLOAP](https://brassbe1982-bdlweb.share.connect.posit.cloud/portfolio/cloap.html)); Excel prodi memakai 62 untuk mahasiswa dan 75% untuk kelas | `StackedShare` (sebaran tercapai, belum, data kurang, dengan rasio dan status) |
| Penelusuran ke mahasiswa individu | CLOAP menyebut penelusuran ke kinerja mahasiswa sebagai satu-satunya tingkat telusur | tabel daftar mahasiswa pada halaman kelas dan profil mahasiswa |
| Penggulungan CPMK ke CPL ke program | CLOAP dan OBER+ menggulung capaian dari tingkat mata kuliah ke program ([OBER+](https://arxiv.org/abs/2609.03770)); prosedur CO-PO memakai matriks artikulasi dengan skala 1 sampai 3 ([JEETRIT](https://www.i-scholar.in/index.php/JEETRIT/article/view/88198)) | `LinkMatrix` (matriks bobot) dan `TraceFlow` (alur) |
| Peta kurikulum | peta kurikulum baku berupa matriks dua dimensi hasil belajar terhadap mata kuliah ([IADIS](https://iadisportal.org/digital-library/visualization-of-learning-outcomes-using-curriculum-mapping), [PolyU](https://www.polyu.edu.hk/obe/GuideOBE/curriculum_mapping.pdf)) | `LinkMatrix` sebagai bentuk utama, `TraceFlow` sebagai pelengkap visual |
| Tingkat capaian bertahap | templat laporan PLO memakai Exceeds, Meets, Does Not Meet ([Clayton State](https://www.clayton.edu/aie/docs/pair.docx)) | status memenuhi atau di bawah rasio kelas pada `StackedShare` dan `TraceFlow` |
| Profil CPL satu mahasiswa atau satu kelas | tidak ditemukan sumber yang menyebut radar untuk CPL; dipilih karena jumlah CPL kecil (8) dan pembanding tetap (ambang) | `RadarChart` dengan batang berambang sebagai padanan yang lebih mudah dibaca |
| Perbandingan dua sumber angka | bentuk baku untuk sebelum dan sesudah per butir adalah dumbbell (panduan dataviz yang dimuat pada sesi) | `Dumbbell` (Excel dibanding hitung sistem) |
| Tren antar penyampaian mata kuliah dan kesinambungan rumusan CPL | OBER+ mengakumulasi capaian antar penyampaian dan menjaga kesinambungan rumusan | belum dibuat; membutuhkan lebih dari satu semester berisi data |

## Yang tidak ditemukan

- Tidak ada sumber yang menggambar aliran dari CPMK ke CPL dengan diagram Sankey. Literatur Sankey yang ditemukan menggambar alur mahasiswa antar mata kuliah ([Templ dkk.](https://irf.fhnw.ch/entities/publication/a8561f40-69c7-422f-be27-616b6d96f434)). `TraceFlow` adalah rancangan sendiri, karena itu selalu disertai matriks dan tabel.
- Tidak ada sumber yang menyatakan radar sebagai bentuk baku capaian CPL.
- Tinjauan kebutuhan instruktur terhadap dasbor analitik pembelajaran tidak menghasilkan satu tinjauan sistematis; ulasan yang ditemukan menyebut kekurangan dasbor yang divalidasi secara empiris ([LAK21](https://www.cin.ufpe.br/~nivan/pdfs/lak21.pdf)).

## Aturan bentuk yang dipakai

Mengikuti panduan dataviz: satu sumbu, tanpa sumbu ganda; batang tipis dengan celah 2 px antar segmen; legenda selalu ada untuk dua seri atau lebih; angka hanya pada ujung atau segmen yang muat; status tidak bergantung pada warna saja; setiap grafik memiliki tabel pendamping dan keterangan yang sama saat disorot dengan penunjuk maupun difokus dengan papan ketik.

## Warna

Segmen memakai token tema: tercapai `--chart-1`, belum tercapai `--warning`, data belum cukup `--border`, komponen `--chart-2`. Setiap segmen berlabel teks pada legenda, jumlah pada segmen yang cukup lebar, dan baris tabel, sehingga warna bukan satu-satunya pembawa arti.
