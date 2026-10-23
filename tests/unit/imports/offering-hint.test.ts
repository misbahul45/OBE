import { describe, expect, test } from 'bun:test';
import { hintOfferingFromSheetName } from '#lib/features/imports/offering-hint.ts';

describe('hintOfferingFromSheetName', () => {
	test('memisahkan kelas T1/T2 dari nama mata kuliah', () => {
		expect(hintOfferingFromSheetName('Pengantar Teknik Biomedis T1')).toEqual({ courseNameHint: 'Pengantar Teknik Biomedis', sectionHint: 'T1', isPractical: false });
		expect(hintOfferingFromSheetName('Kalkulus Lanjut T2')).toMatchObject({ courseNameHint: 'Kalkulus Lanjut', sectionHint: 'T2' });
	});

	test('praktikum dikenali dari awalan atau akhiran terpotong', () => {
		expect(hintOfferingFromSheetName('Prak. Elektronika Digital T3')).toEqual({ courseNameHint: 'Elektronika Digital', sectionHint: 'T3', isPractical: true });
		expect(hintOfferingFromSheetName('Elektronika Analog T1 (Praktiku')).toMatchObject({ courseNameHint: 'Elektronika Analog', sectionHint: 'T1', isPractical: true });
	});

	test('tahun angkatan di nama sheet dibuang dari petunjuk', () => {
		expect(hintOfferingFromSheetName('Biotransportasi T1 2022')).toMatchObject({ courseNameHint: 'Biotransportasi', sectionHint: 'T1' });
		expect(hintOfferingFromSheetName('2022 Fisiologi Manusia untuk Te').courseNameHint).toBe('Fisiologi Manusia untuk Te');
	});

	test('nama tanpa kelas tetap menjadi petunjuk mata kuliah', () => {
		expect(hintOfferingFromSheetName('Pancasila')).toEqual({ courseNameHint: 'Pancasila', sectionHint: null, isPractical: false });
		expect(hintOfferingFromSheetName('Metode Penelitian T')).toMatchObject({ courseNameHint: 'Metode Penelitian', sectionHint: null });
	});
});
