# Pengujian E2E dan audit antarmuka

E2E menguji aplikasi hasil build lewat browser nyata (Playwright) terhadap database `obe_test` yang direset setiap kali dijalankan. Spec hanya memakai antarmuka (UI dan HTTP); tidak ada impor kode aplikasi atau driver database.

## Menjalankan

```bash
bun run db:up
bun run test:e2e                          # semua proyek
bunx playwright test tests/e2e/imports    # satu fitur
bunx playwright test --project=flows      # tanpa a11y dan responsif
bunx playwright show-report               # laporan HTML (playwright-report/)
```

`playwright.config.ts` menyalakan satu server dengan perintah berurutan: `scripts/e2e-seed.ts` → `bun run build` → `vite preview` di `127.0.0.1:4173`. Proses pertama memerlukan sekitar satu menit untuk build. Pada mesin dengan memori terbatas jalankan di latar belakang dan arahkan keluaran ke berkas.

## Data dan isolasi

| Elemen | Perilaku |
|---|---|
| Database | `TEST_DATABASE_URL` (`obe_test`); guard menolak host non-loopback dan nama yang bukan `*_test` |
| Seed (`scripts/e2e-seed.ts`) | mereset database, membuat Super Admin, dua dosen, semester aktif, dua mata kuliah, CPL/CPMK, kebijakan aktif, dan mengimpor 15 mahasiswa sintetis ke kelas A |
| Kredensial | dibangkitkan acak oleh seed dan ditulis ke `.e2e-state/credentials.json` (di-gitignore); tidak ada kata sandi tertanam di repositori |
| Sesi | `tests/support/e2e/global-setup.ts` login per peran lewat UI dan menyimpan `storageState`; fixture `asAdmin`, `asLecturerA`, `asLecturerB`, `anonymous` membuka konteks baru per tes |
| Fixture berkas | `tests/fixtures/workbooks/*.synthetic.xlsx` dan `invalid-*.xlsx`, dibangkitkan deterministik oleh `bun run fixtures:build` |

Spec dalam satu berkas bersifat serial (`mode: 'serial'`) karena alurnya berurutan. Antarberkas berjalan alfabetis dengan satu worker, sehingga spec yang membutuhkan data hasil spec lain (mis. profil mahasiswa setelah impor) bergantung pada urutan tersebut; seed sudah memuat data minimal yang dibutuhkan.

Jangan memakai storage state bersama untuk tes yang keluar (logout) atau menonaktifkan akun: tes semacam itu harus login sendiri agar tidak mencabut sesi tes lain.

## Cakupan

| Berkas | Isi |
|---|---|
| `landing/landing.spec.ts` | tepat satu H1 dan satu H2, tanpa badge/label pengisi, tiga ajakan ke `/login`, logo resmi, isi alur dan modul, kanvas titik dekoratif, toggle tema, gerakan dikurangi, CSP dan header |
| `landing/orbit.spec.ts` | diagram siklus OBE: keadaan awal, pilih dan batal, hover menyorot busur, papan ketik, nama aksesibel, gerakan dikurangi, tata letak 320 sampai 1920 px |
| `shared/theme-toggle.spec.ts` | toggle di shell dan login, kedip tema, pilihan Ikuti sistem |
| `auth/profile.spec.ts` | profil admin dan dosen, ubah nama, validasi, tautan sidebar, tamu dialihkan |
| `auth/auth.spec.ts` | pengalihan tamu, pesan galat login tidak membocorkan akun, pendaftaran mandiri tertutup, RBAC 403 dan 404, logout |
| `academic/admin-flow.spec.ts` | buat dosen dan password sementara sekali tampil, wajib ganti password, mata kuliah, penawaran, penugasan, semester, nonaktifkan dan cabut sesi |
| `imports/wizard.spec.ts` | cakupan kelas dosen, validasi tanpa mengubah data, konfirmasi nilai berubah, idempotensi, duplikat, berkas rusak, sheet tanpa NIM, batal, riwayat, CSV |
| `lecturers/class.spec.ts` | dasbor dan halaman kelas, grafik beralt teks dan tabel pengganti, ubah bobot dan pemetaan, PDF kelas, hitung ulang |
| `students/profile.spec.ts` | direktori dan filter, profil dengan sumber hasil dan riwayat perubahan, transkrip PDF, cakupan dosen |
| `cqi/cqi.spec.ts` | alur temuan dari baru sampai selesai dengan gerbang, peran penanggung jawab, bukti, evaluasi |
| `shared/a11y.spec.ts` (`@a11y`) | axe (WCAG 2.0/2.1/2.2 A dan AA) pada halaman publik, admin, dosen, profil, CQI, laporan, dan tiap tahap wizard; mode terang dan gelap |
| `shared/responsive.spec.ts` | tidak ada luapan horizontal pada viewport ponsel; navigasi dapat dibuka |

Proyek `a11y` dan `mobile` bergantung pada `flows` agar halaman diaudit dengan data nyata.

## Audit visual dengan Playwright MCP

Pemeriksaan otomatis tidak membuktikan tampilan baik. Setelah perubahan UI, jalankan server dev (`bun run dev`) dan periksa lewat Playwright MCP:

1. buka halaman kunci pada 1280 px dan 375 px (`browser_resize`), ambil tangkapan layar penuh, dan baca hasilnya;
2. bandingkan mode terang dan gelap (`browser_emulate_media` dengan `colorScheme`);
3. ukur luapan horizontal dengan `browser_evaluate` (`document.documentElement.scrollWidth` terhadap `window.innerWidth`) dan daftar elemen yang melewati batas;
4. periksa konsol (`browser_console_messages`) untuk galat hidrasi, CSP, dan nesting HTML;
5. simpan temuan sebagai tugas atau perbaikan, lalu tambahkan tes otomatis yang menangkapnya.

Berkas unggah untuk `browser_file_upload` harus berada di bawah folder proyek; gunakan `.playwright-mcp/` (di-gitignore) dan hapus setelah selesai. Jangan memakai data nyata pada tangkapan layar.

Temuan yang sudah ditangkap dengan cara ini dan kini punya tes: luapan grafik pada ponsel (`min-w-0` pada figure), `<form>` bersarang pada editor komponen, kontras tab dan tombol destruktif pada mode gelap, `<select>` tanpa nama aksesibel, wilayah gulir yang tidak dapat difokus keyboard, halaman kosong di PDF.

## Kendala yang pernah ditemui

- `getByLabel` mencocokkan substring tanpa membedakan huruf; beri `{ exact: true }` bila ada label lain yang memuat kata yang sama.
- Baca `page.url()` hanya setelah `expect(page).toHaveURL(...)`; pengalihan setelah unggah bersifat asinkron.
- Satu pesan galat tidak boleh muncul dua kali sebagai `role="alert"`; selain membingungkan pembaca layar, ini memicu pelanggaran mode ketat locator.
