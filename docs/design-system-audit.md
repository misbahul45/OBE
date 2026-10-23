# Audit design system dan migrasi tema Blue-White

Tanggal audit: 2026-10-23. Sumber token tunggal: `src/routes/layout.css`. Konfigurasi: `components.json` (preset `nova`, ikon `lucide`, alias `#lib/*`). Keputusan: `docs/tracking/decisions.md` D-30.

## 1. Inventaris sebelum migrasi (palet Ocean Academic Blue)

| Aspek | Kondisi awal | Sumber |
|---|---|---|
| Latar aplikasi | `#F2FAFC` (biru kehijauan pucat) | `--background` |
| Primer | `#26778F` (teal), hover memakai `primary/80` dan `--primary-strong` | `--primary` |
| Sidebar | navy gelap `#082B3A` dengan teks terang | `--sidebar*` |
| Aksen pesaing | lavender, ungu, merah muda, biru medis (`--brand-*`) dipakai di landing | `--brand-*` |
| Seri grafik | teal, ungu, magenta, kuning, teal tua | `--chart-1..5` |
| Warna hardcoded | pita peta panas (`chart-math.ts`), renderer PDF (`reports.pdf.server.ts`) | `src/lib` |
| Komponen shadcn | token semantik, tanpa warna hardcoded | `src/lib/components/ui` |
| Rute dan fitur | tanpa warna hardcoded | `src/routes`, `src/lib/features` |

## 2. Temuan audit

| ID | Temuan | Penanganan |
|---|---|---|
| T-B1 | Palet teal, sidebar gelap, dan aksen lavender/merah muda tidak sesuai arah Blue-White enterprise | token ditulis ulang; `--brand-*` dihapus |
| T-B2 | Hover tombol utama memakai opasitas (`primary/80`), bukan warna hover resmi | `button.svelte` memakai `primary-hover` |
| T-B3 | Tombol destruktif berlatar merah tipis dengan teks `destructive` | varian `destructive` berbatas merah, teks `status-danger`; isian merah penuh hanya untuk konfirmasi (`destructive-solid`) |
| T-B4 | Pita peta panas dan warna PDF ditulis langsung dalam heksadesimal | dipindah ke keluarga biru/slate; kontras teks pita diuji |
| T-B5 | Warna kanonik sukses `#16A34A` dan peringatan `#D97706` bernilai 3,30 dan 3,19 sebagai teks di atas putih | dipertahankan untuk isian dan ikon; teks status memakai token turunan `--status-*` |
| T-B6 | Batas input kanonik `#CBD5E1` bernilai 1,48:1 di atas putih | penyimpangan terdokumentasi (bagian 6) |
| T-B7 | `lang="en"` pada `app.html` padahal UI berbahasa Indonesia; favicon masih logo Svelte | `lang="id"`; favicon titik biru senada merek (kemudian diganti logo resmi UNAIR, lihat D-35) |
| T-B8 | Seri grafik lama memuat ungu dan magenta | seri biru, slate, hijau toska, ambar tua, biru langit; seluruhnya ≥ 3:1 |
| T-B9 | Label grup sidebar memakai `sidebar-foreground/70` yang lulus di sidebar gelap lama tetapi 4,34:1 di atas putih (ditemukan axe pada E2E) | memakai `muted-foreground` (4,76:1); pasangan `muted-foreground / sidebar` ditambahkan ke uji kontras |
| T-B10 | Scrollbar bawaan peramban tebal dan berpanah, tidak senada dengan tema | scrollbar ramping 12 px bertoken (lihat bagian 10) |

## 3. Palet final

Seluruh nilai berada di `layout.css`; kelas utilitas tersedia lewat `@theme inline`.

| Token | Mode terang | Fungsi |
|---|---|---|
| `--background`, `--card`, `--popover`, `--sidebar` | `#FFFFFF` | permukaan dominan |
| `--foreground` | `#0F172A` | teks utama |
| `--primary` | `#2563EB` | aksi utama, tautan, elemen terpilih |
| `--primary-hover` | `#1D4ED8` | hover/pressed tombol utama |
| `--primary-light` | `#3B82F6` | garis dan dekorasi biru terang |
| `--primary-soft` | `#EFF6FF` | latar navigasi aktif, sorotan lembut |
| `--primary-muted` | `#DBEAFE` | latar sekunder biru, penanda logo |
| `--secondary`, `--muted` | `#F8FAFC` | permukaan sekunder |
| `--secondary-foreground` | `#334155` | teks pada permukaan sekunder |
| `--muted-foreground` | `#64748B` | teks sekunder |
| `--accent` / `--accent-foreground` | `#EFF6FF` / `#2563EB` | sorotan item menu |
| `--border` | `#E2E8F0` | pemisah struktural |
| `--input` | `#CBD5E1` | tepi kontrol formulir |
| `--ring` | `#3B82F6` | fokus keyboard |
| `--destructive` | `#DC2626` | galat kritis |
| `--success`, `--warning`, `--info` | `#16A34A`, `#D97706`, `#2563EB` | isian dan ikon semantik |
| `--sidebar-accent` / `-foreground` | `#EFF6FF` / `#2563EB` | navigasi aktif |
| `--chart-1..5` | `#2563EB`, `#475569`, `#0F766E`, `#B45309`, `#075985` | seri grafik |

Token teks status (berpasangan dengan latar lembut, selalu bersama ikon dan label):

| Status | Teks | Latar lembut |
|---|---|---|
| Sukses | `#15803D` | `#F0FDF4` |
| Peringatan | `#B45309` | `#FFFBEB` |
| Bahaya | `#B91C1C` | `#FEF2F2` |
| Info | `#1D4ED8` | `#EFF6FF` |
| Netral | `#475569` | `#F1F5F9` |

Mode gelap memakai latar `#0B1220`, kartu `#0F172A`, primer `#3B82F6` (teks di atasnya `#0B1220`), permukaan primer lembut `#111C3A`/`#1A2F6B`, dan batas input `#64748B`. Mode gelap mengikuti `prefers-color-scheme`; belum ada tombol pengalih tema.

## 4. Peta migrasi

| Token lama | Token baru |
|---|---|
| `--background #F2FAFC` | `#FFFFFF` |
| `--foreground #10354A` | `#0F172A` |
| `--primary #26778F` | `#2563EB` |
| `--primary-strong #164E63` | `--primary-hover #1D4ED8` |
| `--secondary`, `--muted #E1F3F8` | `#F8FAFC` |
| `--accent #C8EAF2` | `#EFF6FF` |
| `--muted-foreground #4A6675` | `#64748B` |
| `--border #CFE3EA` | `#E2E8F0` |
| `--input #6B95A6` | `#CBD5E1` |
| `--ring #26778F` | `#3B82F6` |
| `--sidebar #082B3A` | `#FFFFFF` dengan aktif `#EFF6FF`/`#2563EB` |
| `--chart-1..5` | `#2563EB`, `#475569`, `#0F766E`, `#B45309`, `#075985` |
| `--brand-*` | dihapus |
| (baru) | `--primary-hover/-light/-soft/-muted`, `--success`, `--warning`, `--info` |

Perubahan pada komponen bersama (bukan halaman): `button.svelte` (hover primer, varian destruktif), `badge.svelte` (destruktif), `ConfirmForm.svelte` (aksi konfirmasi memakai `destructive-solid`), `BarChart.svelte`, `LineChart.svelte`, `chart-math.ts` (pita peta panas `#EFF6FF`, `#DBEAFE`, `#93C5FD`, `#2563EB`, `#1E3A8A`), dan `reports.pdf.server.ts`.

## 5. Landing

Gaya mengacu pada halaman fitur "dots" milik ChatGPT: tanda cincin besar di tengah, judul sangat besar berbobot ringan, subjudul abu-abu besar, tombol pil, dan panel visual membulat besar di atas bidang titik-titik. Aturan proyek tetap berlaku: satu H1 dan satu H2, tanpa lencana, label kecil, kartu statistik, atau daftar; satu CTA utama menuju `/login`; GSAP dengan `prefers-reduced-motion`. Visual `OutcomeOrbitVisual` memakai jalur putus-putus dan simpul bernuansa biru tanpa gradien, filter, atau aksen warna lain.

## 6. Status aksesibilitas dan kontras

Diperiksa otomatis oleh `tests/unit/shared/contrast.test.ts`, yang membaca token langsung dari `layout.css`. Rasio terhitung:

| Pasangan | Terang | Gelap |
|---|---|---|
| foreground / background | 17,85 | 15,19 |
| card-foreground / card | 17,85 | 14,48 |
| primary-foreground / primary | 5,17 | 5,09 |
| primary-foreground / primary-hover | 6,70 | 7,36 |
| primary / background | 5,17 | 5,09 |
| primary / primary-soft (navigasi aktif) | 4,75 | 4,56 |
| primary-hover / primary-muted | 5,49 | 4,97 |
| secondary-foreground / secondary | 9,90 | 9,85 |
| muted-foreground / background | 4,76 | 7,30 |
| muted-foreground / muted | 4,55 | 5,71 |
| destructive-foreground / destructive | 4,83 | 6,77 |
| sidebar-foreground / sidebar | 10,35 | 12,02 |
| status-success / soft | 4,79 | 10,62 |
| status-warning / soft | 4,84 | 10,11 |
| status-danger / soft | 5,91 | 8,51 |
| status-info / soft | 6,16 | 8,15 |
| ring / background (min 3) | 3,68 | 7,36 |
| chart-1..5 / card (min 3) | 5,17; 7,58; 5,47; 5,02; 7,56 | 7,02; 6,96; 9,59; 10,69; 10,71 |

Penyimpangan yang disengaja dan terdokumentasi:

- **Batas input terang `#CBD5E1` bernilai 1,48:1** di atas putih, di bawah 3:1 yang disarankan WCAG 1.4.11 untuk batas komponen. Nilai ini mengikuti spesifikasi desain. Label, fokus (3,68:1 dengan cincin 3 px), dan pesan galat tetap menyampaikan status tanpa bergantung pada batas. Bila kebutuhan aksesibilitas mengharuskan, `--input` dapat diganti ke sekitar `#8A97AB` (sekitar 2,96:1) atau lebih gelap; satu baris di `layout.css`, dan tes yang mengunci nilai kanonik harus diperbarui bersamanya. Mode gelap memenuhi 3:1 (3,93).
- **`--success` `#16A34A` dan `--warning` `#D97706` bernilai 3,30 dan 3,19** sebagai teks di atas putih. Keduanya hanya dipakai untuk isian dan ikon; teks status selalu memakai `--status-*` yang lulus 4,5:1.
- `muted-foreground` di atas `muted` bernilai 4,55 (lulus tipis); teks di atas permukaan biru lembut memakai `secondary-foreground`.

Pemeriksaan keyboard, label, dan struktur judul dilakukan pada audit browser dan `tests/e2e/shared/a11y.spec.ts`.

## 7. Prinsip pemakaian

- Putih dominan; biru hanya untuk aksi utama, elemen terpilih, dan fokus.
- Dashboard: status memakai `StatusBadge` dengan ikon dan teks; tabel dan aksi dibedakan dari ornamen.
- Tipografi Geist; angka tabel memakai `font-variant-numeric: tabular-nums`.
- Gerak singkat; `prefers-reduced-motion` mematikan animasi dan transisi.
- Warna hanya lewat token semantik; pengecualian yang tercatat adalah pita peta panas dan renderer PDF (tidak dapat membaca CSS), yang nilainya diuji kontrasnya dan diselaraskan dengan palet ini.

## 8. Komponen yang ditata

Terpasang dari registry shadcn-svelte: alert, alert-dialog, badge, breadcrumb, button, card, checkbox, dialog, dropdown-menu, input, label, pagination, progress, radio-group, select, separator, sheet, sidebar, skeleton, sonner, switch, table, tabs, textarea, tooltip. Komponen domain (misalnya `StatusBadge`, kerangka halaman, grafik) berada di folder fitur masing-masing.

## 9. Validasi visual

Dilakukan dengan Playwright MCP pada build produksi lokal dengan data sintetis. Rute dan ukuran layar yang benar-benar dibuka dicantumkan di `docs/verification-report.md`.

## 10. Scrollbar

`layout.css` mendefinisikan `--scrollbar-thumb` dan `--scrollbar-thumb-hover` (terang `#CBD5E1` dan `#94A3B8`, gelap `#334155` dan `#475569`). Peramban berbasis WebKit memakai `::-webkit-scrollbar` (lebar 12 px, trek transparan, jempol membulat dengan jarak 3 px, tanpa tombol panah, warna menebal saat disorot); Firefox memakai `scrollbar-width: thin` dan `scrollbar-color` dari token yang sama lewat `@supports`. Panel gulir yang dapat difokus keyboard tetap memakai cincin fokus. Chromium headless milik Playwright menyembunyikan scrollbar, sehingga tes E2E memeriksa aturan CSS yang dimuat, sedangkan tampilannya diperiksa langsung di browser.
