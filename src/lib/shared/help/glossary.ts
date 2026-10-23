export type GlossaryEntry = { id: string; term: string; expansion: string; meaning: string };
export type GlossaryGroup = { id: string; title: string; entries: GlossaryEntry[] };

export const glossaryGroups: GlossaryGroup[] = [
	{
		id: 'kurikulum',
		title: 'Kurikulum',
		entries: [
			{ id: 'obe', term: 'OBE', expansion: 'Outcome-Based Education', meaning: 'Kurikulum dirancang dari kemampuan yang harus dimiliki lulusan, lalu dinilai apakah kemampuan itu tercapai.' },
			{ id: 'cpl', term: 'CPL', expansion: 'Capaian Pembelajaran Lulusan', meaning: 'Kemampuan yang harus dimiliki lulusan program studi. Nilai CPL mahasiswa dihitung dari CPMK yang dipetakan ke CPL itu.' },
			{ id: 'cpmk', term: 'CPMK', expansion: 'Capaian Pembelajaran Mata Kuliah', meaning: 'Kemampuan yang dituju satu mata kuliah. Nilai CPMK dihitung dari komponen penilaian yang dipetakan ke CPMK itu.' },
			{ id: 'wa', term: 'WA', expansion: 'Graduate Attributes (Atribut Lulusan)', meaning: 'Dua belas atribut lulusan standar Washington Accord dan IABEE, ditulis WA-1 sampai WA-12. Setiap CPL menyatakan WA mana yang dipenuhinya.' },
			{ id: 'wk', term: 'WK', expansion: 'Knowledge Profile (Profil Pengetahuan)', meaning: 'Delapan profil pengetahuan standar yang sama, ditulis WK-1 sampai WK-8. Setiap CPL menyatakan WK mana yang dicakupnya.' },
			{ id: 'profil-lulusan', term: 'Profil lulusan (PL)', expansion: 'Peran yang disiapkan program studi', meaning: 'Gambaran peran lulusan, misalnya praktisi profesional atau peneliti. Setiap profil dibentuk oleh beberapa CPL kunci.' },
			{ id: 'bidang-kerja', term: 'Bidang kerja (BK)', expansion: 'Pekerjaan yang dituju lulusan', meaning: 'Bidang kerja yang menjadi tujuan profil lulusan. Profil utama adalah jalur langsung; profil pendukung memberi keterampilan tambahan.' }
		]
	},
	{
		id: 'penilaian',
		title: 'Penilaian dan hasil',
		entries: [
			{ id: 'komponen', term: 'Komponen penilaian', expansion: 'UTS, UAS, tugas, kuis, dan sejenisnya', meaning: 'Bagian nilai yang diberi bobot. Jumlah bobot semua komponen satu kelas harus 100% agar nilai akhir dapat dihitung.' },
			{ id: 'kebijakan', term: 'Kebijakan OBE', expansion: 'Aturan ketercapaian yang berlaku', meaning: 'Memuat ambang ketercapaian CPMK, rasio kelas yang memenuhi, target tiap CPL, dan metode agregasi. Berversi, dan hanya satu yang aktif.' },
			{ id: 'ambang', term: 'Ambang dan target', expansion: 'Batas nilai yang dianggap tercapai', meaning: 'Ambang berlaku untuk CPMK, target berlaku untuk CPL. Tanpa ambang atau target, sistem tidak menyatakan tercapai atau tidak.' },
			{ id: 'agregasi', term: 'Agregasi CPL', expansion: 'Penggabungan hasil CPL dari banyak kelas', meaning: 'Cara menggabungkan nilai CPL dari beberapa kelas menjadi satu angka program studi. Sebelum metodenya dipilih, angka gabungan sengaja tidak ditampilkan.' },
			{ id: 'status', term: 'Status ketercapaian', expansion: 'Tercapai, belum tercapai, belum cukup data, target belum dikonfigurasi', meaning: 'Tercapai berarti nilai sama dengan atau di atas target. Belum cukup data berarti ada komponen wajib yang kosong. Target belum dikonfigurasi berarti kebijakan belum menetapkan target.' },
			{ id: 'kosong', term: 'Nilai kosong', expansion: 'Berbeda dari nol', meaning: 'Sel nilai yang kosong tidak dihitung sebagai 0. CPMK yang bergantung padanya ditandai belum lengkap.' },
			{ id: 'referensi', term: 'Hasil referensi Excel', expansion: 'Angka CPMK dan CPL dari berkas Excel', meaning: 'Disimpan sebagai pembanding dan tidak pernah menggantikan hasil yang dihitung sistem dari komponen. Selisihnya ditandai.' }
		]
	},
	{
		id: 'impor',
		title: 'Impor nilai',
		entries: [
			{ id: 'penawaran', term: 'Penawaran kelas', expansion: 'Kelas satu mata kuliah pada satu semester', meaning: 'Satuan tempat nilai dan hasil capaian disimpan. Setiap sheet Excel dipetakan ke tepat satu penawaran kelas.' },
			{ id: 'validasi', term: 'Validasi (dry-run)', expansion: 'Simulasi sebelum menyimpan', meaning: 'Menjalankan seluruh pemeriksaan dan menampilkan apa yang akan berubah, tanpa mengubah data. Data baru tersimpan hanya setelah Anda menekan Simpan.' },
			{ id: 'revisi', term: 'Riwayat revisi', expansion: 'Catatan perubahan nilai', meaning: 'Setiap penambahan atau perubahan nilai mencatat nilai lama, nilai baru, berkas sumber, dan pelaku. Mengimpor ulang berkas yang sama tidak mengubah apa pun.' }
		]
	},
	{
		id: 'mutu',
		title: 'Mutu',
		entries: [{ id: 'cqi', term: 'CQI', expansion: 'Continuous Quality Improvement', meaning: 'Siklus perbaikan berkelanjutan: temuan mutu dicatat, diberi tindakan dengan penanggung jawab dan tenggat, dibuktikan, lalu dievaluasi ulang.' }]
	}
];

export const glossaryEntries: GlossaryEntry[] = glossaryGroups.flatMap((group) => group.entries);
