import { describe, expect, test } from 'bun:test';
import { catalogDescription, categoryLabels, courseCatalog, requiredCredits } from '#lib/features/academic/academic.course-catalog.ts';

describe('katalog mata kuliah Kurikulum 2021', () => {
	test('kode unik, berformat sesuai validasi mata kuliah, dan SKS dalam rentang basis data', () => {
		const codes = courseCatalog.map((entry) => entry.code);
		expect(new Set(codes).size).toBe(codes.length);
		for (const entry of courseCatalog) {
			expect(entry.code, entry.name).toMatch(/^[A-Z0-9]{2,12}$/);
			expect(entry.credits, entry.code).toBeGreaterThanOrEqual(1);
			expect(entry.credits, entry.code).toBeLessThanOrEqual(12);
			expect(entry.semester, entry.code).toBeGreaterThanOrEqual(1);
			expect(entry.semester, entry.code).toBeLessThanOrEqual(8);
			expect(entry.name, entry.code).toBe(entry.name.trim());
			expect(entry.name.length, entry.code).toBeGreaterThanOrEqual(3);
			expect(entry.name.length, entry.code).toBeLessThanOrEqual(150);
		}
	});

	test('total SKS wajib per semester sama dengan Struktur Kurikulum resmi (satu agama dihitung sekali)', () => {
		const official = { 1: 19, 2: 20, 3: 20, 4: 20, 5: 21, 6: 13, 7: 11, 8: 6 } as const;
		for (const [semester, total] of Object.entries(official)) expect(requiredCredits(courseCatalog, Number(semester)), `semester ${semester}`).toBe(total);
	});

	test('mata kuliah pilihan sesuai paket resmi', () => {
		expect(requiredCredits(courseCatalog, 6, 'pilihan_instrumentasi')).toBe(8);
		expect(requiredCredits(courseCatalog, 6, 'pilihan_biomaterial')).toBe(8);
		expect(requiredCredits(courseCatalog, 7, 'pilihan_instrumentasi')).toBe(10);
		expect(requiredCredits(courseCatalog, 7, 'pilihan_biomaterial')).toBe(6);
		expect(requiredCredits(courseCatalog, 7, 'pilihan_bersama')).toBe(6);
	});

	test('pilihan agama tersedia untuk lima agama pada semester 1 dan 7', () => {
		for (const group of ['agama-1', 'agama-2']) expect(courseCatalog.filter((entry) => entry.alternativeGroup === group)).toHaveLength(5);
		expect(courseCatalog.filter((entry) => entry.alternativeGroup === 'agama-1').every((entry) => entry.semester === 1)).toBe(true);
		expect(courseCatalog.filter((entry) => entry.alternativeGroup === 'agama-2').every((entry) => entry.semester === 7)).toBe(true);
	});

	test('kode sementara memakai awalan TBX dan hanya itu yang bertanda sementara', () => {
		const flagged = courseCatalog.filter((entry) => entry.provisionalCode);
		expect(flagged.map((entry) => entry.code)).toEqual(['TBX001', 'TBX002', 'TBX003', 'TBX004', 'TBX005', 'TBX006']);
		expect(courseCatalog.filter((entry) => entry.code.startsWith('TBX')).length).toBe(flagged.length);
	});

	test('keterangan memuat kurikulum, semester, dan kategori; kode sementara dijelaskan', () => {
		const regular = courseCatalog.find((entry) => entry.code === 'TMK404')!;
		expect(catalogDescription(regular)).toBe(`Kurikulum 2021 · Semester 7 · ${categoryLabels.pilihan_instrumentasi}`);
		const temporary = courseCatalog.find((entry) => entry.code === 'TBX004')!;
		expect(catalogDescription(temporary)).toContain('Kode sementara');
		expect(catalogDescription(temporary).length).toBeLessThanOrEqual(1000);
	});

	test('mencakup mata kuliah kunci OBE program studi', () => {
		const names = new Set(courseCatalog.map((entry) => entry.name));
		for (const required of ['Biomaterial', 'Biomekanika', 'Komputasi Biomedis', 'Sistem Cerdas', 'Biofotonik', 'Biosensor', 'Skripsi', 'Pancasila']) expect(names.has(required), required).toBe(true);
	});
});
