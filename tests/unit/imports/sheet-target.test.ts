import { describe, expect, test } from 'bun:test';
import { courseCatalog } from '#lib/features/academic/academic.course-catalog.ts';
import { matchSheetCourse, parseSheetTarget, pickOffering, resolveSheet } from '#lib/features/imports/sheet-target.ts';

const courses = courseCatalog.map((entry) => ({ code: entry.code, name: entry.name }));
const resolve = (sheet: string) => {
	const resolved = resolveSheet(sheet, courses);
	return { code: resolved?.course.code ?? null, section: resolved?.section ?? null };
};

describe('parseSheetTarget', () => {
	test('memisahkan bagian kelas, praktikum, dan angkatan dari nama sheet', () => {
		expect(parseSheetTarget('Biomaterial T1')).toMatchObject({ practical: false, section: 'T1' });
		expect(parseSheetTarget('Kimia Fisik T')).toMatchObject({ practical: false, section: 'T' });
		expect(parseSheetTarget('Pancasila')).toMatchObject({ practical: false, section: 'A' });
		expect(parseSheetTarget('Prak. Elektronika Digital T3')).toMatchObject({ practical: true, section: 'T3', nameKey: 'elektronika digital' });
		expect(parseSheetTarget('Elektronika Analog T2 (Praktiku')).toMatchObject({ practical: true, section: 'T2', nameKey: 'elektronika analog' });
		expect(parseSheetTarget('Biotransportasi T1 2021')).toMatchObject({ section: '21T1', nameKey: 'biotransportasi' });
		expect(parseSheetTarget('2022 Fisiologi Manusia untuk Te')).toMatchObject({ section: '22A' });
	});

	test('bagian kelas selalu memenuhi aturan kelas 1-6 karakter huruf besar atau angka', () => {
		for (const sheet of ['Biotransportasi T1 2022', '2022 Fisiologi Manusia untuk Te', 'Pancasila', 'Kimia Fisik T', 'Prak. Pemrograman Komputer T4']) expect(parseSheetTarget(sheet).section).toMatch(/^[A-Z0-9]{1,6}$/);
	});

	test('spasi ganda, spasi di tepi, dan tanda kurung terpotong dibersihkan', () => {
		expect(parseSheetTarget(' Sistem Kontrol Biomedis T').nameKey).toBe('sistem kontrol biomedis');
		expect(parseSheetTarget('Kapita Selekta Biomedis  T').nameKey).toBe('kapita selekta biomedis');
		expect(parseSheetTarget('PENGANTAR KOLABORASI KEILMUAN (').nameKey).toBe('pengantar kolaborasi keilmuan');
	});
});

describe('matchSheetCourse pada seluruh nama sheet berkas Semester 1 sampai 7', () => {
	const expected: [string, string, string][] = [
		['Pancasila', 'NOP103', 'A'],
		['Kewarganegaraan', 'NOP104', 'A'],
		['PENGANTAR KOLABORASI KEILMUAN (', 'TBX002', 'A'],
		['KOMUNIKASI DAN PENGEMBANGAN DIR', 'TBX003', 'A'],
		['Biologi Teknik Biomedis', 'BID112', 'A'],
		['Pengantar Teknik Biomedis T1', 'TMA101', 'T1'],
		['Kalkulus Lanjut T2', 'MAA103', 'T2'],
		['Ilmu Bahan T1', 'FIM304', 'T1'],
		['Sel & Jaringan Manusia T2', 'BIA301', 'T2'],
		['Anatomi Manusia untuk Teknik T1', 'BIA208', 'T1'],
		['Elektronika Analog T1', 'FIE208', 'T1'],
		['Elektronika Analog T3 (Praktiku', 'FIE209', 'T3'],
		['Rangkaian Listrik T2', 'TML306', 'T2'],
		['FIsika Medis T1 ', 'FIB201', 'T1'],
		['Matematika Teknik I T2', 'MAT207', 'T2'],
		['Fisiologi Manusia untuk Teknik ', 'BIF204', 'A'],
		['2022 Fisiologi Manusia untuk Te', 'BIF204', '22A'],
		['Prak. Fisiologi Manusia untuk T', 'BIF205', 'A'],
		['Menggambar Teknik T1', 'LKT208', 'T1'],
		['Pemrograman Komputer T2', 'SIA202', 'T2'],
		['Prak. Pemrograman Komputer T4', 'SIA203', 'T4'],
		['KImia FIsik T', 'KIF201', 'T'],
		['Medan Elektromagnetik T1', 'FIT401', 'T1'],
		['Elektronika Digital T2', 'FIE206', 'T2'],
		['Prak. Elektronika Digital T3', 'FIE207', 'T3'],
		['Matematika Teknik II T1', 'TBX004', 'T1'],
		['Metode Statistika T1', 'MAS207', 'T1'],
		['Biomaterial T2', 'TMM201', 'T2'],
		['Sinyal, Sistem, dan Kontrol T1', 'FIA307', 'T1'],
		['Biomekanika T2', 'TMU201', 'T2'],
		['Eksperimen Tek. Biomedik I T3', 'FIA301', 'T3'],
		['Komputasi Biomedis T1', 'TMK301', 'T1'],
		['Prak. Komputasi Biomedis T3', 'TMK302', 'T3'],
		['Sistem Instrumentasi dan Penguk', 'FIK316', 'A'],
		['Modalitas CItra Medis T2', 'TMA304', 'T2'],
		['Metode Penelitian T', 'PNT497', 'T'],
		['Biotransportasi T1 2021', 'TMU202', '21T1'],
		['Biotransportasi T2 2022', 'TMU202', '22T2'],
		['Praktek Kerja Lapangan T', 'KLT301', 'T'],
		['Eksperimen Teknik Biomedik II T', 'FIA302', 'T'],
		['Analisis Sinyal Biomedis T1', 'TMA302', 'T1'],
		['Embeded Sistem T2 ', 'FIA303', 'T2'],
		['Perangkat Antar Muka T', 'FIE309', 'T'],
		['Pemrosesan Citra Biomedis T', 'TMK401', 'T'],
		['Fisika Radiasi T', 'FIN301', 'T'],
		['Sistem Cerdas T', 'TMK303', 'T'],
		['Analisis Biomaterial I T', 'TMA303', 'T'],
		['Pengantar Rekayasa Jaringan T', 'SIJ204', 'T'],
		['Biokompatibilitas T', 'TMA201', 'T'],
		['Kesehatan Dan Keselamatan Kerja', 'KMK212', 'A'],
		['Manajemen Industri dan Kewiraus', 'TBX005', 'A'],
		['Robotika dan Mekatronika Biomed', 'TBX006', 'A'],
		[' Sistem Kontrol Biomedis T', 'TMK405', 'T'],
		[' Analisis Biomaterial II T', 'TMM306', 'T'],
		['Nanomaterial T', 'TMM304', 'T'],
		['Pemodelan Material Implan T', 'TMK402', 'T'],
		['Biosensor T', 'FIO307', 'T'],
		['Kapita Selekta Biomedis  T', 'KST419', 'T']
	];

	test.each(expected)('%s menjadi %s kelas %s', (sheet, code, section) => {
		expect(resolve(sheet)).toEqual({ code, section });
	});

	test('huruf T di akhir nama yang terpotong 31 karakter dibaca sebagai bagian kata, bukan kelas', () => {
		expect(resolve('Prak. Fisiologi Manusia untuk T')).toEqual({ code: 'BIF205', section: 'A' });
		expect(resolve('KImia FIsik T')).toEqual({ code: 'KIF201', section: 'T' });
	});

	test('baris mata kuliah ganda (satu mata kuliah dengan beberapa kelas) tidak membuat pencocokan ambigu', () => {
		const repeated = [...courses, ...courses.filter((course) => course.code === 'FIE208'), ...courses.filter((course) => course.code === 'FIE208')];
		expect(matchSheetCourse(parseSheetTarget('Elektronika Analog T1'), repeated)?.code).toBe('FIE208');
	});

	test('sheet bantu tanpa nama mata kuliah tidak dipetakan dan nama yang tidak dikenal ditolak', () => {
		expect(resolve('Sheet1').code).toBeNull();
		expect(resolve('Sheet2').code).toBeNull();
		expect(resolve('Mata Kuliah Tidak Ada T1').code).toBeNull();
	});

	test('praktikum dan teori dengan nama dasar sama tidak tertukar', () => {
		expect(resolve('Elektronika Analog T1').code).not.toBe(resolve('Elektronika Analog T1 (Praktiku').code);
		expect(resolve('Komputasi Biomedis T1').code).toBe('TMK301');
		expect(resolve('Prak. Komputasi Biomedis T1').code).toBe('TMK302');
	});

	test('dua mata kuliah dengan awalan sama tidak dianggap cocok bila awalan ambigu', () => {
		const ambiguous = [{ code: 'AAA1', name: 'Analisis Sinyal Biomedis Lanjut' }, { code: 'AAA2', name: 'Analisis Sinyal Biomedis Dasar' }];
		expect(matchSheetCourse({ nameKey: 'analisis sinyal biomedis', practical: false, section: 'A', cohortPrefix: '', bareTail: false, explicitSection: false }, ambiguous)).toBeNull();
	});
});

describe('pickOffering', () => {
	const offerings = [
		{ courseCode: 'FIE208', section: 'T1', id: 'a' },
		{ courseCode: 'FIE208', section: 'T2', id: 'b' },
		{ courseCode: 'TMM201', section: 'B', id: 'c' }
	];
	const resolved = (sheet: string) => resolveSheet(sheet, courses)!;

	test('kelas yang sama persis dipilih', () => {
		expect(pickOffering(offerings, resolved('Elektronika Analog T2'))?.id).toBe('b');
	});

	test('sheet tanpa penanda kelas memakai satu-satunya kelas mata kuliah itu', () => {
		expect(pickOffering(offerings, resolved('Biomaterial'))?.id).toBe('c');
	});

	test('sheet tanpa penanda kelas tidak memilih bila kelasnya lebih dari satu', () => {
		expect(pickOffering(offerings, resolved('Elektronika Analog'))).toBeNull();
	});

	test('sheet dengan kelas atau angkatan eksplisit tidak jatuh ke kelas lain', () => {
		expect(pickOffering(offerings, resolved('Elektronika Analog T3'))).toBeNull();
		expect(pickOffering(offerings, resolved('Biomaterial T1'))).toBeNull();
		expect(pickOffering(offerings, resolved('2022 Biomaterial'))).toBeNull();
	});

	test('mata kuliah yang berbeda tidak pernah dipilih walau namanya mirip', () => {
		expect(pickOffering(offerings, resolved('Analisis Biomaterial I T'))).toBeNull();
	});
});
