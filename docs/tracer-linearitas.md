# Tracer alumni dan linearitas

Halaman `/app/admin/tracer` (Super Admin) menampilkan statistik berapa mahasiswa yang linear dan yang tidak, menurut dua sumber: prediksi dari nilai CPL dan isian nyata yang dimasukkan manual.

## Dua sumber yang dibandingkan

| Sumber | Asal | Arti |
|---|---|---|
| Prediksi | dihitung dari nilai CPL mahasiswa, matriks CPL ke profil lulusan, dan matriks profil ke bidang kerja | apakah kompetensi mahasiswa cocok dengan bidang kerja tertentu |
| Nyata | diisi manual oleh admin, per mahasiswa: linear atau tidak, bidang kerja, dan keeratan lima tingkat (opsional) | apakah alumni bekerja linear menurut kenyataan |

Isian nyata dapat dikosongkan dan diisi kapan saja. Sistem tidak menganggap "belum diisi" sebagai "tidak linear".

## Rumus (dari dokumen OBE prodi)

- Capaian CPL `C = MIN(nilai / ambang, 1)`; tercapai bila `nilai >= ambang`; gap `= MAX(0, ambang - nilai)`.
- Profil: skor `P = Σ ŵ·C × 100`, cakupan `Cov = Σ w·X / Σ w × 100`, indeks `IKP = α·P + (1 - α)·Cov`, dengan `α = 0,7`. Kategori: sangat sesuai ≥ 85, sesuai ≥ 70, cukup sesuai ≥ 55, selain itu kurang sesuai.
- Bidang kerja (Jalur A, rumus utama): bobot `r_lj = Σ_k q_lk × w_kj`, level `R_lj = ambang CPL`, kecocokan `F = Σ r·MIN(nilai / R, 1) / Σ r × 100`. Versi berbasis gap `F' = (1 - Σ r·MAX(0, R - nilai) / Σ r·R) × 100`. Jalur B memakai rata-rata IKP profil berbobot relevansi.
- Prediksi linear bila `F >= 70` pada bidang kerja terbaik (atau pada bidang yang dipilih pada isian nyata).
- Persen linear nyata = nyata linear ÷ jumlah isian. Prediksi sesuai nyata = prediksi sama dengan isian, dari isian yang menyebut bidang kerja.

Contoh hitung dokumen (ambang 70, nilai 80, 63, 70, bobot profil 3, 2, 1) menghasilkan P 96,7; Cov 66,7; IKP 87,7 dan diuji di `tests/unit/tracer/calc.test.ts`.

## Keputusan data kurang

CPL tanpa nilai atau tanpa ambang tidak dihitung sebagai nol dan keluar dari penyebut; profil tanpa satu pun CPL bernilai tidak dinilai. Nilai CPL mahasiswa adalah rata-rata antar mata kuliah (hasil hitung sistem bila lengkap, kolom Excel bila tidak). Ambang dari kebijakan OBE aktif, atau bila tidak ada, dari ambang nilai mahasiswa pada sheet Excel (nilai terbanyak). Tanpa keduanya prediksi tidak dihitung dan halaman menyatakannya.

## Hubungan dengan tracer study resmi UNAIR

Instrumen Tracer Study UNAIR 2025 (sistem ATSS, dikelola DPKKA) mengukur kesesuaian lewat penilaian alumni: "Seberapa erat hubungan antara bidang studi dengan pekerjaan / wiraswasta / studi lanjut Anda?" dengan lima pilihan (Sangat erat, Erat, Cukup erat, Kurang erat, Tidak sama sekali), dan membandingkan kompetensi yang dikuasai dengan yang diperlukan pada skala 1 sampai 5 (gap = dikuasai dikurangi diperlukan). Prediksi di sini adalah ukuran turunan dari nilai CPL, bukan pengganti ukuran resmi tersebut; karena itu keeratan lima tingkat ikut disimpan sebagai isian nyata.

Sumber: [tracerstudy.unair.ac.id](https://tracerstudy.unair.ac.id/) dan [Laporan Tracer Study UNAIR 2025](https://psikologi.unair.ac.id/wp-content/uploads/2026/06/Buku-Tracer-Study-2025_FPsi.pdf). Batas persentase "linear" yang resmi tidak ditemukan pada sumber yang dapat dibaca; ambang 70 dan α 0,7 adalah asumsi dari dokumen OBE prodi dan perlu ditetapkan prodi.

## Data dan privasi

Tabel `tracer_records` (satu baris per mahasiswa) dan enum `tracer_keeratan` ditambahkan oleh migrasi `0002`, yang hanya menambah objek baru. Audit mencatat perubahan tanpa nama maupun NIM. Data alumni asli tidak disimpan di repositori, log, atau fixture.

## Menerapkan ke produksi

Jalankan migrasi pada koneksi langsung Neon sebelum membuka halaman ini di produksi: `MIGRATE_DATABASE_URL="<koneksi langsung>" bun run db:migrate`.
