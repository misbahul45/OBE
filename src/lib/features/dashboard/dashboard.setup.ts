export type SetupCounts = {
	cpl: number;
	profiles: number;
	semesterActive: boolean;
	courses: number;
	offerings: number;
	lecturers: number;
	activePolicy: boolean;
	committedImports: number;
};

export type SetupStep = { key: string; title: string; detail: string; href: string; actionLabel: string; done: boolean };

const plural = (count: number, noun: string) => `${count} ${noun}`;

export function buildSetupSteps(counts: SetupCounts): SetupStep[] {
	return [
		{
			key: 'cpl',
			title: 'Isi CPL program studi',
			detail: counts.cpl > 0 ? `${plural(counts.cpl, 'CPL')} terdaftar.` : 'Belum ada CPL. Tambahkan pada menu CPL dan CPMK, atau jalankan seed:curriculum.',
			href: '/app/admin/curriculum',
			actionLabel: 'Buka CPL dan CPMK',
			done: counts.cpl > 0
		},
		{
			key: 'profiles',
			title: 'Hubungkan profil lulusan dan bidang kerja',
			detail: counts.profiles > 0 ? `${plural(counts.profiles, 'profil lulusan')} terdaftar.` : 'Belum ada profil lulusan. Jalankan seed:curriculum untuk memuatnya dari dokumen kurikulum.',
			href: '/app/admin/profiles',
			actionLabel: 'Buka Profil lulusan',
			done: counts.profiles > 0
		},
		{
			key: 'semester',
			title: 'Aktifkan semester berjalan',
			detail: counts.semesterActive ? 'Ada semester aktif.' : 'Belum ada semester aktif. Buat tahun akademik dan semester, lalu aktifkan.',
			href: '/app/admin/terms',
			actionLabel: 'Buka Tahun akademik',
			done: counts.semesterActive
		},
		{
			key: 'courses',
			title: 'Tambahkan mata kuliah',
			detail: counts.courses > 0 ? `${plural(counts.courses, 'mata kuliah')} terdaftar.` : 'Belum ada mata kuliah.',
			href: '/app/admin/courses',
			actionLabel: 'Buka Mata kuliah',
			done: counts.courses > 0
		},
		{
			key: 'offerings',
			title: 'Buat penawaran kelas dan tugaskan dosen',
			detail:
				counts.offerings === 0
					? 'Belum ada penawaran kelas pada semester aktif.'
					: counts.lecturers === 0
						? `${plural(counts.offerings, 'kelas')} sudah ada, tetapi belum ada dosen yang ditugaskan.`
						: `${plural(counts.offerings, 'kelas')} diampu ${plural(counts.lecturers, 'dosen')}.`,
			href: '/app/admin/offerings',
			actionLabel: 'Buka Penawaran kelas',
			done: counts.offerings > 0 && counts.lecturers > 0
		},
		{
			key: 'policy',
			title: 'Aktifkan kebijakan OBE',
			detail: counts.activePolicy ? 'Kebijakan OBE aktif.' : 'Belum ada kebijakan aktif. Tetapkan ambang, target CPL, dan metode agregasi.',
			href: '/app/admin/curriculum',
			actionLabel: 'Buka Kebijakan',
			done: counts.activePolicy
		},
		{
			key: 'imports',
			title: 'Impor nilai kelas',
			detail: counts.committedImports > 0 ? `${plural(counts.committedImports, 'impor')} tersimpan.` : 'Belum ada nilai yang diimpor. Hasil CPMK dan CPL muncul setelah nilai masuk.',
			href: '/app/admin/imports',
			actionLabel: 'Buka Impor nilai',
			done: counts.committedImports > 0
		}
	];
}

export function nextSetupStep(steps: SetupStep[]): SetupStep | null {
	return steps.find((step) => !step.done) ?? null;
}
