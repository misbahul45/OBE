export const landingCopy = {
	brand: 'OBE Teknik Biomedis',
	university: 'Universitas Airlangga',
	faculty: 'Fakultas Sains dan Teknologi',
	program: 'Program Studi S1 Teknik Biomedis',
	logoSrc: '/brand/unair-logo.png',
	logoAlt: 'Logo Universitas Airlangga',
	title: 'Capaian pembelajaran, terhubung dalam satu sistem',
	subtitle:
		'Dari nilai asesmen ke CPMK dan CPL, hingga perbaikan berkelanjutan: satu alur yang dapat ditelusuri untuk Program Studi S1 Teknik Biomedis.',
	cta: 'Masuk ke sistem',
	closingCta: 'Masuk dengan akun Anda',
	loginHref: '/login',
	visualTitle: 'Alur Outcome-Based Education',
	visualDescription:
		'Siklus empat tahap yang berulang: Mata Kuliah, CPMK, CPL, lalu CQI, dengan umpan balik perbaikan dari CQI kembali ke mata kuliah dan kurikulum.',
	stages: ['Mata Kuliah', 'CPMK', 'CPL', 'CQI'],
	loop: {
		hub: { label: 'OBE', name: 'Outcome-Based Education', caption: 'Siklus evaluasi dan perbaikan berkelanjutan' },
		feedback: 'Umpan balik perbaikan',
		overview: {
			title: 'Satu siklus, empat tahap',
			body: 'Nilai asesmen di setiap mata kuliah diukur sebagai CPMK, digabung menjadi CPL, dievaluasi lewat CQI, lalu hasilnya kembali memperbaiki mata kuliah dan kurikulum.',
			hint: 'Pilih salah satu tahap untuk melihat perannya. Dengan papan ketik: Tab atau tombol panah untuk berpindah, Enter untuk memilih, Esc untuk membatalkan.'
		},
		nodes: [
			{
				id: 'mk',
				label: 'Mata Kuliah',
				fullName: 'Mata Kuliah',
				body: 'Kegiatan pembelajaran dan komponen penilaian di setiap kelas. Nilai komponen yang diimpor dari Excel menjadi bahan ukur bagi seluruh siklus.',
				flow: 'Nilai komponen dipetakan ke CPMK.'
			},
			{
				id: 'cpmk',
				label: 'CPMK',
				fullName: 'Capaian Pembelajaran Mata Kuliah',
				body: 'Hasil belajar yang diharapkan dari satu mata kuliah. Sistem menghitungnya dari komponen penilaian yang dipetakan; angka CPMK dari Excel disimpan terpisah sebagai nilai referensi.',
				flow: 'CPMK dipetakan dan digabung menjadi CPL.'
			},
			{
				id: 'cpl',
				label: 'CPL',
				fullName: 'Capaian Pembelajaran Lulusan',
				body: 'Kompetensi yang diharapkan dimiliki lulusan program studi. Capaian CPL dibandingkan dengan target pada kebijakan penilaian yang sedang aktif.',
				flow: 'Capaian yang belum memenuhi target menjadi bahan evaluasi mutu.'
			},
			{
				id: 'cqi',
				label: 'CQI',
				fullName: 'Continuous Quality Improvement',
				body: 'Proses evaluasi dan perbaikan berkelanjutan berdasarkan hasil pengukuran. Temuan dicatat bersama tindakan perbaikan, bukti, dan evaluasinya.',
				flow: 'Perbaikan kembali ke mata kuliah dan kurikulum, lalu siklus berulang.'
			}
		]
	},
	chainTitle: 'Satu rantai bukti, dari nilai sampai perbaikan',
	chainIntro: 'Setiap angka dapat ditelusuri mundur: dari capaian CPL, ke CPMK, ke komponen penilaian, sampai berkas nilai yang diunggah.',
	steps: [
		{
			title: 'Nilai asesmen per mata kuliah',
			body: 'Dosen mengunggah Excel nilai kelas. Sistem memeriksa berkas lebih dulu tanpa mengubah data, lalu menyimpannya setelah dikonfirmasi. NIM selalu dibaca sebagai teks dan sel kosong tidak dianggap nol.'
		},
		{
			title: 'CPMK terukur dari komponen penilaian',
			body: 'Setiap komponen penilaian dipetakan ke CPMK. Hasilnya dihitung dari nilai mentah dengan rumus yang versinya tercatat, sedangkan angka CPMK dari Excel disimpan terpisah sebagai nilai referensi.'
		},
		{
			title: 'CPL dari gabungan CPMK',
			body: 'CPMK dipetakan ke CPL. Capaian tiap mahasiswa dan tiap kelas dibandingkan dengan target pada kebijakan penilaian yang sedang aktif.'
		},
		{
			title: 'CQI menutup siklus',
			body: 'Capaian yang belum memenuhi target menjadi temuan mutu, lengkap dengan tindakan perbaikan, bukti, dan evaluasi, sehingga kurikulum belajar dari datanya sendiri.'
		}
	],
	audiencesTitle: 'Dirancang untuk yang mengelola dan mengajar',
	audiences: [
		{
			title: 'Kaprodi dan Super Admin',
			body: 'Mengelola kurikulum, CPL dan CPMK, tahun akademik, penawaran kelas, akun dosen, impor nilai, laporan, dan temuan CQI.'
		},
		{
			title: 'Dosen pengampu',
			body: 'Melihat kelas yang ditugaskan, mengatur komponen penilaian, mengunggah nilai, membaca capaian kelas, dan menindaklanjuti temuan CQI.'
		},
		{
			title: 'Capaian mahasiswa',
			body: 'Profil capaian dan transkrip PDF tiap mahasiswa dapat dibuka dan diunduh oleh staf yang berwenang atas kelasnya.'
		}
	],
	modulesTitle: 'Modul yang saling terhubung',
	modules: [
		{ title: 'Kurikulum dan pemetaan', body: 'CPL, CPMK, pemetaan komponen asesmen, serta kebijakan dan target capaian.', icon: 'target' },
		{ title: 'Impor nilai Excel', body: 'Unggah, periksa, konfirmasi, dan simpan, dengan jejak revisi setiap perubahan nilai.', icon: 'upload' },
		{ title: 'Capaian mahasiswa', body: 'Hasil CPMK dan CPL per mata kuliah, ringkasan per semester, dan transkrip PDF.', icon: 'graduation' },
		{ title: 'Laporan kelas', body: 'Statistik komponen, ketercapaian CPMK dan CPL, serta rekap mahasiswa dalam PDF.', icon: 'report' },
		{ title: 'Profil lulusan', body: 'Hubungan CPL dengan profil lulusan dan bidang kerja yang dituju program studi.', icon: 'profile' },
		{ title: 'CQI dan jejak audit', body: 'Temuan, tindakan, bukti, dan evaluasi, dengan riwayat perubahan yang dapat diperiksa.', icon: 'quality' }
	],
	cycleTitle: 'Siklus PDCA yang berjalan di dalam sistem',
	cycle: [
		{ key: 'Plan', title: 'Rencanakan', body: 'Tetapkan CPL, CPMK, pemetaan, dan target pada kebijakan penilaian.' },
		{ key: 'Do', title: 'Laksanakan', body: 'Kelas berjalan dan nilai komponen diimpor ke sistem.' },
		{ key: 'Check', title: 'Evaluasi', body: 'Bandingkan hasil CPMK dan CPL dengan target di setiap kelas.' },
		{ key: 'Act', title: 'Tindak lanjut', body: 'Catat temuan, tindakan perbaikan, bukti, dan hasil evaluasinya.' }
	],
	closingTitle: 'Akun diberikan oleh Super Admin program studi',
	closingBody: 'Akun dibuat oleh Super Admin dan tidak dapat dibuat sendiri. Masuk dengan akun yang Anda terima untuk melanjutkan.'
} as const;
