import { describe, expect, test } from 'bun:test';
import { mappingFromForm, sheetMappingSchema } from '#lib/features/imports/mapping.validation.ts';
import type { SheetMapping } from '#lib/features/imports/imports.types.ts';

const base: SheetMapping = {
	headerRow: 1,
	nimColumn: 1,
	nameColumn: 2,
	firstDataRow: 2,
	components: [
		{ column: 3, code: 'UTS-1', name: 'UTS', type: 'uts', weightPercent: 40, maxScore: 100 },
		{ column: 4, code: 'UAS-1', name: 'UAS', type: 'uas', weightPercent: 60, maxScore: 100 }
	],
	cpmkColumns: [{ column: 5, code: 'CPMK-1' }],
	cplColumns: [{ column: 6, code: 'CPL-1' }],
	excludedRows: []
};

describe('sheetMappingSchema', () => {
	test('pemetaan yang konsisten diterima dan kode dinormalisasi', () => {
		const parsed = sheetMappingSchema.parse({ ...base, components: [{ ...base.components[0], code: 'uts-1' }, base.components[1]] });
		expect(parsed.components[0].code).toBe('UTS-1');
	});

	test('kolom yang sama untuk dua peran ditolak', () => {
		const result = sheetMappingSchema.safeParse({ ...base, cpmkColumns: [{ column: 3, code: 'CPMK-1' }] });
		expect(result.success).toBe(false);
		expect(result.error!.issues[0].message).toContain('Kolom yang sama');
		expect(sheetMappingSchema.safeParse({ ...base, nameColumn: 1 }).success).toBe(false);
	});

	test('kode komponen ganda, baris data sebelum header, dan bobot di luar rentang ditolak', () => {
		expect(sheetMappingSchema.safeParse({ ...base, components: [base.components[0], { ...base.components[1], code: 'UTS-1' }] }).success).toBe(false);
		expect(sheetMappingSchema.safeParse({ ...base, firstDataRow: 1 }).success).toBe(false);
		expect(sheetMappingSchema.safeParse({ ...base, components: [{ ...base.components[0], weightPercent: 120 }] }).success).toBe(false);
		expect(sheetMappingSchema.safeParse({ ...base, components: [{ ...base.components[0], maxScore: 0 }] }).success).toBe(false);
	});

	test('kode CPMK/CPL harus berformat baku dan kolom di luar batas ditolak', () => {
		expect(sheetMappingSchema.safeParse({ ...base, cpmkColumns: [{ column: 5, code: 'CPMK 1' }] }).success).toBe(false);
		expect(sheetMappingSchema.safeParse({ ...base, nimColumn: 500 }).success).toBe(false);
	});

	test('bobot kosong (null) diterima sebagai belum dikonfigurasi', () => {
		expect(sheetMappingSchema.safeParse({ ...base, components: [{ ...base.components[0], weightPercent: null }] }).success).toBe(true);
	});
});

describe('mappingFromForm', () => {
	const entries = {
		headerRow: '1',
		nimColumn: '1',
		nameColumn: '2',
		firstDataRow: '2',
		col_3_role: 'component',
		col_3_code: 'uts-1',
		col_3_name: 'UTS',
		col_3_type: 'uts',
		col_3_weight: '40',
		col_4_role: 'component',
		col_4_code: 'UAS-1',
		col_4_name: 'UAS',
		col_4_type: 'uas',
		col_4_weight: '',
		col_5_role: 'cpmk',
		col_5_code: 'cpmk-1',
		col_6_role: 'cpl',
		col_6_code: 'CPL-1',
		col_7_role: 'ignore',
		excludedRows: '5, 9;12'
	};

	test('mengubah isian formulir menjadi pemetaan, bobot kosong menjadi null', () => {
		const mapping = mappingFromForm(entries, base);
		expect(mapping.components.map((c) => [c.column, c.code, c.weightPercent])).toEqual([[3, 'uts-1', 40], [4, 'UAS-1', null]]);
		expect(mapping.cpmkColumns).toEqual([{ column: 5, code: 'CPMK-1' }]);
		expect(mapping.cplColumns).toEqual([{ column: 6, code: 'CPL-1' }]);
		expect(mapping.excludedRows).toEqual([5, 9, 12]);
		expect(mapping.components.every((c) => c.maxScore === 100)).toBe(true);
		expect(sheetMappingSchema.safeParse(mapping).success).toBe(true);
	});

	test('kolom berperan abaikan tidak masuk pemetaan; nilai tidak valid menjadi NaN dan ditolak skema', () => {
		const mapping = mappingFromForm({ ...entries, col_3_weight: 'abc' }, base);
		expect(Number.isNaN(mapping.components[0].weightPercent)).toBe(true);
		expect(sheetMappingSchema.safeParse(mapping).success).toBe(false);
		expect(mappingFromForm(entries, base).components.some((c) => c.column === 7)).toBe(false);
	});

	test('kolom nama dikosongkan menjadi null dan baris data pertama default setelah header', () => {
		const mapping = mappingFromForm({ ...entries, nameColumn: '', firstDataRow: '', headerRow: '3' }, base);
		expect(mapping.nameColumn).toBeNull();
		expect(mapping.firstDataRow).toBe(4);
	});
});
