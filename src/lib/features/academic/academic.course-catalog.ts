export type CatalogCategory = 'wajib' | 'pilihan_instrumentasi' | 'pilihan_biomaterial' | 'pilihan_bersama';

export type CatalogCourse = {
	code: string;
	name: string;
	credits: number;
	semester: number;
	category: CatalogCategory;
	provisionalCode?: true;
	alternativeGroup?: string;
};

export const categoryLabels: Record<CatalogCategory, string> = {
	wajib: 'Wajib',
	pilihan_instrumentasi: 'Pilihan Instrumentasi Biomedis',
	pilihan_biomaterial: 'Pilihan Biomaterial',
	pilihan_bersama: 'Pilihan Bersama'
};

const course = (semester: number, category: CatalogCategory, code: string, name: string, credits: number, extra: Partial<CatalogCourse> = {}): CatalogCourse => ({ code, name, credits, semester, category, ...extra });
const wajib = (semester: number, code: string, name: string, credits: number, extra: Partial<CatalogCourse> = {}) => course(semester, 'wajib', code, name, credits, extra);
const provisional = { provisionalCode: true } as const;

export const courseCatalog: CatalogCourse[] = [
	wajib(1, 'NOP103', 'Pancasila', 2),
	wajib(1, 'NOP104', 'Kewarganegaraan', 2),
	wajib(1, 'AGI101', 'Agama Islam I', 2, { alternativeGroup: 'agama-1' }),
	wajib(1, 'AGP101', 'Agama Kristen Protestan I', 2, { alternativeGroup: 'agama-1' }),
	wajib(1, 'AGK101', 'Agama Katolik I', 2, { alternativeGroup: 'agama-1' }),
	wajib(1, 'AGH101', 'Agama Hindu I', 2, { alternativeGroup: 'agama-1' }),
	wajib(1, 'AGB101', 'Agama Budha I', 2, { alternativeGroup: 'agama-1' }),
	wajib(1, 'BAI101', 'Bahasa Indonesia', 2),
	wajib(1, 'SIP107', 'Data dan Pustaka', 2),
	wajib(1, 'BID101', 'Biologi Dasar', 2),
	wajib(1, 'KID105', 'Kimia Dasar', 2),
	wajib(1, 'BID102', 'Praktikum Biologi Dasar', 1),
	wajib(1, 'KID102', 'Praktikum Kimia Dasar I', 1),
	wajib(1, 'MAA101', 'Kalkulus', 3),

	wajib(2, 'TBX001', 'Logika dan Pemikiran Kritis', 2, provisional),
	wajib(2, 'TBX002', 'Pengantar Kolaborasi Keilmuan', 2, provisional),
	wajib(2, 'TBX003', 'Komunikasi dan Pengembangan Diri', 2, provisional),
	wajib(2, 'FID113', 'Fisika Dasar I', 2),
	wajib(2, 'FID104', 'Fisika Dasar II', 2),
	wajib(2, 'FID114', 'Praktikum Fisika Dasar I', 1),
	wajib(2, 'BID112', 'Biologi Teknik Biomedis', 2),
	wajib(2, 'MAA103', 'Kalkulus Lanjut', 3),
	wajib(2, 'TMA101', 'Pengantar Teknobiomedik', 2),
	wajib(2, 'BAE111', 'Bahasa Inggris I', 2),

	wajib(3, 'FIM304', 'Ilmu Bahan', 3),
	wajib(3, 'BIA301', 'Sel dan Jaringan Manusia', 2),
	wajib(3, 'BIA208', 'Anatomi Manusia untuk Teknik', 2),
	wajib(3, 'BIA209', 'Praktikum Anatomi Manusia untuk Teknik', 1),
	wajib(3, 'FIE208', 'Elektronika Analog', 3),
	wajib(3, 'FIE209', 'Praktikum Elektronika Analog', 1),
	wajib(3, 'TML306', 'Rangkaian Listrik', 2),
	wajib(3, 'FIB201', 'Fisika Medis', 3),
	wajib(3, 'MAT207', 'Matematika Teknik I', 3),

	wajib(4, 'BIF204', 'Fisiologi Manusia untuk Teknik', 2),
	wajib(4, 'BIF205', 'Praktikum Fisiologi Manusia untuk Teknik', 1),
	wajib(4, 'LKT208', 'Menggambar Teknik', 2),
	wajib(4, 'SIA202', 'Pemrograman Komputer', 3),
	wajib(4, 'SIA203', 'Praktikum Pemrograman Komputer', 1),
	wajib(4, 'KIF201', 'Kimia Fisik', 2),
	wajib(4, 'FIT401', 'Medan Elektromagnetik', 3),
	wajib(4, 'FIE206', 'Elektronika Digital', 2),
	wajib(4, 'FIE207', 'Praktikum Elektronika Digital', 1),
	wajib(4, 'TBX004', 'Matematika Teknik II', 3, provisional),

	wajib(5, 'MAS207', 'Metode Statistika', 2),
	wajib(5, 'TMM201', 'Biomaterial', 3),
	wajib(5, 'FIA307', 'Sinyal, Sistem, dan Kontrol', 3),
	wajib(5, 'TMU201', 'Biomekanika', 3),
	wajib(5, 'FIA301', 'Eksperimen Teknik Biomedik I', 1),
	wajib(5, 'TMK301', 'Komputasi Biomedis', 3),
	wajib(5, 'TMK302', 'Praktikum Komputasi Biomedis', 1),
	wajib(5, 'FIK316', 'Sistem Instrumentasi dan Pengukuran Biomedis', 3),
	wajib(5, 'TMA304', 'Modalitas Citra Medis', 2),

	wajib(6, 'PNT497', 'Metodologi Penelitian', 2),
	wajib(6, 'TMU202', 'Biotransportasi', 2),
	wajib(6, 'KLT301', 'Praktek Kerja Lapangan', 2),
	wajib(6, 'FIA302', 'Eksperimen Teknik Biomedik II', 1),
	wajib(6, 'TMA302', 'Analisis Sinyal Biomedis', 2),
	wajib(6, 'FIA303', 'Embedded System', 2),
	wajib(6, 'BAE112', 'Bahasa Inggris II', 2),
	course(6, 'pilihan_instrumentasi', 'FIE309', 'Perangkat Antar Muka', 2),
	course(6, 'pilihan_instrumentasi', 'TMK401', 'Pemrosesan Citra Biomedis', 2),
	course(6, 'pilihan_instrumentasi', 'FIN301', 'Fisika Radiasi', 2),
	course(6, 'pilihan_instrumentasi', 'TMK303', 'Sistem Cerdas', 2),
	course(6, 'pilihan_biomaterial', 'TMA303', 'Analisis Biomaterial I', 2),
	course(6, 'pilihan_biomaterial', 'SIJ204', 'Pengantar Rekayasa Jaringan', 2),
	course(6, 'pilihan_biomaterial', 'TMA201', 'Biokompatibilitas', 2),
	course(6, 'pilihan_biomaterial', 'TMM305', 'Pemrosesan Biomaterial', 2),

	wajib(7, 'KNT401', 'Kuliah Kerja Nyata Belajar Bersama Masyarakat', 3),
	wajib(7, 'PNT498', 'Proposal Skripsi', 2),
	wajib(7, 'KMK212', 'Kesehatan dan Keselamatan Kerja', 2),
	wajib(7, 'AGI401', 'Agama Islam II', 2, { alternativeGroup: 'agama-2' }),
	wajib(7, 'AGP401', 'Agama Kristen Protestan II', 2, { alternativeGroup: 'agama-2' }),
	wajib(7, 'AGK401', 'Agama Katolik II', 2, { alternativeGroup: 'agama-2' }),
	wajib(7, 'AGH401', 'Agama Hindu II', 2, { alternativeGroup: 'agama-2' }),
	wajib(7, 'AGB401', 'Agama Budha II', 2, { alternativeGroup: 'agama-2' }),
	wajib(7, 'TBX005', 'Manajemen Industri dan Kewirausahaan', 2, provisional),
	course(7, 'pilihan_instrumentasi', 'TBX006', 'Robotika dan Mekatronika Biomedis', 2, provisional),
	course(7, 'pilihan_instrumentasi', 'TMK404', 'Sistem Rekam Medis', 2),
	course(7, 'pilihan_instrumentasi', 'TMU203', 'Telemedika', 2),
	course(7, 'pilihan_instrumentasi', 'TMU204', 'Rekayasa Rehab Medis', 2),
	course(7, 'pilihan_instrumentasi', 'TMK405', 'Sistem Kontrol Biomedis', 2),
	course(7, 'pilihan_biomaterial', 'TMM306', 'Analisis Biomaterial II', 2),
	course(7, 'pilihan_biomaterial', 'TMM304', 'Nanomaterial', 2),
	course(7, 'pilihan_biomaterial', 'TMK402', 'Pemodelan Material Implan', 2),
	course(7, 'pilihan_bersama', 'FIO306', 'Biofotonik', 2),
	course(7, 'pilihan_bersama', 'FIO307', 'Biosensor', 2),
	course(7, 'pilihan_bersama', 'KST419', 'Kapita Selekta Biomedis', 2),

	wajib(8, 'PNT499', 'Skripsi', 6)
];

export const provisionalNote = 'Kode sementara: kode resmi belum tercantum pada dokumen Struktur Kurikulum.';

export function catalogDescription(entry: CatalogCourse): string {
	const parts = ['Kurikulum 2021', `Semester ${entry.semester}`, categoryLabels[entry.category]];
	if (entry.provisionalCode) parts.push(provisionalNote);
	return parts.join(' · ');
}

export function requiredCredits(entries: CatalogCourse[], semester: number, category: CatalogCategory = 'wajib'): number {
	const picked = entries.filter((entry) => entry.semester === semester && entry.category === category);
	const groups = new Set<string>();
	let total = 0;
	for (const entry of picked) {
		if (entry.alternativeGroup) {
			if (groups.has(entry.alternativeGroup)) continue;
			groups.add(entry.alternativeGroup);
		}
		total += entry.credits;
	}
	return total;
}
