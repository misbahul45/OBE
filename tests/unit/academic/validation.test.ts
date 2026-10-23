import { describe, expect, test } from 'bun:test';
import { academicYearSchema, assignmentSchema, courseSchema, offeringSchema, semesterSchema } from '#lib/features/academic/academic.validation.ts';

const uuid = '3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b';

describe('courseSchema', () => {
	test('kode dinormalisasi menjadi huruf besar dan spasi dipangkas', () => {
		const result = courseSchema.parse({ code: ' bme101 ', name: 'Pengantar Biomedis', credits: '3', description: '' });
		expect(result).toEqual({ code: 'BME101', name: 'Pengantar Biomedis', credits: 3, description: null });
	});

	test('kode dengan spasi/simbol, SKS di luar rentang, dan nama pendek ditolak dengan pesan', () => {
		const result = courseSchema.safeParse({ code: 'BM E', name: 'ab', credits: 13 });
		expect(result.success).toBe(false);
		const messages = result.error!.issues.map((i) => i.message);
		expect(messages).toContain('Kode 2-12 karakter huruf besar atau angka tanpa spasi');
		expect(messages).toContain('Nama minimal 3 karakter');
		expect(messages).toContain('SKS maksimal 12');
	});
});

describe('semesterSchema', () => {
	test('tanggal akhir sebelum mulai ditolak pada bidang endDate', () => {
		const result = semesterSchema.safeParse({ academicYearId: uuid, term: 'ganjil', startDate: '2026-08-01', endDate: '2026-07-31' });
		expect(result.success).toBe(false);
		expect(result.error!.issues[0].path).toEqual(['endDate']);
	});

	test('format tanggal dan jenis semester divalidasi', () => {
		expect(semesterSchema.safeParse({ academicYearId: uuid, term: 'ganjil', startDate: '01/08/2026', endDate: '2027-01-31' }).success).toBe(false);
		expect(semesterSchema.safeParse({ academicYearId: uuid, term: 'tengah', startDate: '2026-08-01', endDate: '2027-01-31' }).success).toBe(false);
		expect(semesterSchema.safeParse({ academicYearId: uuid, term: 'genap', startDate: '2027-02-01', endDate: '2027-06-30' }).success).toBe(true);
	});
});

describe('academicYearSchema, offeringSchema, assignmentSchema', () => {
	test('tahun dibatasi 2000-2100 dan dikonversi dari teks formulir', () => {
		expect(academicYearSchema.parse({ startYear: '2026' }).startYear).toBe(2026);
		expect(academicYearSchema.safeParse({ startYear: '1999' }).success).toBe(false);
		expect(academicYearSchema.safeParse({ startYear: 'abc' }).success).toBe(false);
	});

	test('kelas kosong menjadi A dan huruf kecil menjadi besar', () => {
		expect(offeringSchema.parse({ courseId: uuid, semesterId: uuid, section: '' }).section).toBe('A');
		expect(offeringSchema.parse({ courseId: uuid, semesterId: uuid, section: 't2' }).section).toBe('T2');
		expect(offeringSchema.safeParse({ courseId: uuid, semesterId: uuid, section: 'kelas panjang sekali' }).success).toBe(false);
		expect(offeringSchema.safeParse({ courseId: 'bukan-uuid', semesterId: uuid }).success).toBe(false);
	});

	test('peran penugasan default anggota dan hanya menerima nilai yang sah', () => {
		expect(assignmentSchema.parse({ offeringId: uuid, lecturerId: uuid }).role).toBe('member');
		expect(assignmentSchema.safeParse({ offeringId: uuid, lecturerId: uuid, role: 'admin' }).success).toBe(false);
	});
});
