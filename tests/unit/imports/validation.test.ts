import { beforeAll, describe, expect, test } from 'bun:test';
import { analyzeSheet, suggestMapping } from '#lib/features/imports/sheet-analysis.ts';
import { allIssues, validateSheet, type ParsedRow, type SheetValidation } from '#lib/features/imports/validation.ts';
import { readWorkbook } from '#lib/features/imports/workbook-reader.server.ts';
import type { SheetGrid, SheetMapping } from '#lib/features/imports/imports.types.ts';
import { buildSemesterWorkbook } from '../../fixtures/builders/templates.ts';
import { buildVariationsWorkbook, variationRows } from '../../fixtures/builders/variations.ts';
import { gridOf } from '../../support/grid.ts';

let grid: SheetGrid;
let mapping: SheetMapping;
let result: SheetValidation;
const cases = variationRows().cases;

const rowOf = (label: string): ParsedRow => result.rows.find((r) => r.row === cases[label])!;
const codesOf = (row: ParsedRow) => row.issues.map((i) => i.code);

beforeAll(() => {
	[grid] = readWorkbook(buildVariationsWorkbook(), 'v.xlsx').sheets;
	mapping = suggestMapping(analyzeSheet(grid))!;
	result = validateSheet(grid, mapping);
});

describe('identitas mahasiswa', () => {
	test('NIM string dengan nol di depan valid dan dipertahankan', () => {
		expect(rowOf('leading_zero_string')).toMatchObject({ nim: '0099000001', nimSource: 'string', status: 'valid' });
	});

	test('NIM ilmiah yang digitnya lengkap diterima, yang ambigu ditolak', () => {
		expect(rowOf('scientific_full')).toMatchObject({ nim: '99000000013', status: 'valid' });
		expect(codesOf(rowOf('scientific_ambiguous'))).toEqual(['NIM_SCIENTIFIC_AMBIGUOUS']);
	});

	test('NIM kosong, tidak valid, dan nama kosong dilaporkan sebagai galat', () => {
		expect(codesOf(rowOf('nim_blank'))).toEqual(['NIM_EMPTY']);
		expect(codesOf(rowOf('nim_text_invalid'))).toEqual(['NIM_INVALID_FORMAT']);
		expect(codesOf(rowOf('name_blank'))).toEqual(['NAME_EMPTY']);
		expect(rowOf('nim_blank').status).toBe('error');
	});

	test('NIM duplikat menandai kedua baris sehingga tidak ada pilihan diam-diam', () => {
		const first = result.rows.find((r) => r.row === cases.out_of_range)!;
		const second = rowOf('duplicate_nim');
		expect(codesOf(first)).toContain('NIM_DUPLICATE_IN_SHEET');
		expect(codesOf(second)).toContain('NIM_DUPLICATE_IN_SHEET');
	});

	test('baris ringkasan dikecualikan dari mahasiswa dan dicatat alasannya', () => {
		expect(result.excludedRows).toContainEqual({ row: cases.summary_row, reason: 'SUMMARY_ROW' });
		expect(result.rows.some((r) => r.row === cases.summary_row)).toBe(false);
	});

	test('NIM bertipe angka menghasilkan satu peringatan tingkat sheet, bukan peringatan per baris', () => {
		const numeric = result.rows.filter((r) => r.nimSource === 'number').length;
		const issue = result.issues.find((i) => i.code === 'NIM_NUMERIC_SOURCE')!;
		expect(issue.severity).toBe('warning');
		expect(issue.message).toContain(`${numeric} baris`);
		expect(result.summary.numericNimRows).toBe(numeric);
	});
});

describe('nilai', () => {
	test('nol tersimpan sebagai 0, kosong sebagai null, dan keduanya dihitung terpisah', () => {
		const row = rowOf('zero_and_blank');
		expect(row.scores).toEqual({ 'UTS-1': 0, 'UAS-1': null });
		expect(row.blankComponents).toEqual(['UAS-1']);
		expect(result.summary.zeroCells).toBeGreaterThanOrEqual(1);
		expect(result.summary.blankCells).toBeGreaterThanOrEqual(1);
	});

	test('desimal koma pada teks dibaca sebagai angka', () => {
		expect(rowOf('comma_decimal').scores['UTS-1']).toBe(85.5);
		expect(rowOf('comma_decimal').status).toBe('valid');
	});

	test('nilai di luar rentang dan negatif ditolak tanpa diubah menjadi nol', () => {
		const row = result.rows.find((r) => r.row === cases.out_of_range)!;
		expect(codesOf(row).filter((c) => c === 'SCORE_OUT_OF_RANGE')).toHaveLength(2);
		expect(row.scores).toEqual({ 'UTS-1': null, 'UAS-1': null });
	});

	test('teks, tanggal, galat rumus, dan rumus tanpa cache dibedakan', () => {
		expect(codesOf(rowOf('score_text'))).toEqual(['SCORE_NOT_NUMERIC']);
		expect(codesOf(rowOf('score_date'))).toEqual(['SCORE_DATE_FORMAT']);
		expect(codesOf(rowOf('formula_error'))).toEqual(['SCORE_FORMULA_ERROR']);
		const noCache = rowOf('formula_no_cache');
		expect(codesOf(noCache)).toEqual(['SCORE_FORMULA_NO_CACHE']);
		expect(noCache.status).toBe('warning');
		expect(noCache.scores['UTS-1']).toBeNull();
	});

	test('nilai CPMK/CPL referensi di luar 0-100 dibuang dengan peringatan', () => {
		const row = rowOf('reference_out_of_range');
		expect(codesOf(row)).toEqual(['REFERENCE_OUT_OF_RANGE']);
		expect(row.references.cpmk['CPMK-1']).toBeNull();
		expect(row.references.cpl['CPL-1']).toBe(85);
		expect(row.status).toBe('warning');
	});

	test('ringkasan jumlah baris konsisten dengan status baris', () => {
		const { total, valid, warning, error } = result.summary;
		expect(valid + warning + error).toBe(total);
		expect(total).toBe(result.rows.length);
	});
});

describe('bobot komponen', () => {
	const sheetWithWeights = (a: number, b: number) =>
		gridOf('Bobot', [
			['NIM', 'Nama', `UTS (${a} %)`, `UAS (${b} %)`],
			[99000000001, 'Mahasiswa Uji 001', 80, 90]
		]);

	test('jumlah bobot selain 100 menjadi galat tingkat sheet dan tidak dinormalisasi diam-diam', () => {
		const g = sheetWithWeights(60, 60);
		const out = validateSheet(g, suggestMapping(analyzeSheet(g))!);
		expect(out.issues.map((i) => i.code)).toContain('WEIGHT_TOTAL_MISMATCH');
		expect(out.weights).toEqual({ total: 120, complete: true, ok: false });
	});

	test('jumlah tepat 100 dan dalam toleransi diterima', () => {
		const exact = sheetWithWeights(40, 60);
		expect(validateSheet(exact, suggestMapping(analyzeSheet(exact))!).weights.ok).toBe(true);
		const near = sheetWithWeights(40, 59.8);
		expect(validateSheet(near, suggestMapping(analyzeSheet(near))!).weights.ok).toBe(true);
		expect(validateSheet(near, suggestMapping(analyzeSheet(near))!, { weightTolerancePercent: 0.1 }).weights.ok).toBe(false);
	});

	test('bobot hilang ditandai belum dikonfigurasi', () => {
		const g = gridOf('Tanpa Bobot', [['NIM', 'Nama', 'UTS', 'UAS (50 %)'], [99000000001, 'Mahasiswa Uji 001', 80, 90]]);
		const out = validateSheet(g, suggestMapping(analyzeSheet(g))!);
		expect(out.issues.map((i) => i.code)).toContain('WEIGHT_MISSING');
		expect(out.weights).toMatchObject({ total: null, complete: false, ok: false });
	});

	test('kode komponen ganda dari pemetaan manual dilaporkan', () => {
		const g = sheetWithWeights(40, 60);
		const m = suggestMapping(analyzeSheet(g))!;
		m.components[1].code = m.components[0].code;
		expect(validateSheet(g, m).issues.map((i) => i.code)).toContain('COMPONENT_CODE_DUPLICATE');
	});
});

describe('CPMK/CPL tidak dikenal dan pengecualian manual', () => {
	test('kolom yang belum didefinisikan tidak diimpor dan dilaporkan', () => {
		const out = validateSheet(grid, mapping, { knownCpmkCodes: new Set(), knownCplCodes: new Set(['CPL-1']) });
		expect(out.issues.map((i) => i.code)).toContain('CPMK_UNKNOWN');
		expect(out.issues.map((i) => i.code)).not.toContain('CPL_UNKNOWN');
		expect(out.usableReferences).toEqual({ cpmk: [], cpl: ['CPL-1'] });
		expect(out.rows[0].references.cpmk).toEqual({});
	});

	test('baris yang dikecualikan pengguna tidak diproses', () => {
		const out = validateSheet(grid, { ...mapping, excludedRows: [cases.score_text] });
		expect(out.rows.some((r) => r.row === cases.score_text)).toBe(false);
		expect(out.excludedRows).toContainEqual({ row: cases.score_text, reason: 'USER_EXCLUDED' });
	});
});

describe('format Semester 1 sintetis end-to-end', () => {
	test('semua mahasiswa valid dan referensi CPMK/CPL terbaca sebagai referensi, bukan komponen', () => {
		const [sheetA] = readWorkbook(buildSemesterWorkbook(), 's.xlsx').sheets;
		const m = suggestMapping(analyzeSheet(sheetA))!;
		const out = validateSheet(sheetA, m, { knownCpmkCodes: new Set(['CPMK-1', 'CPMK-2', 'CPMK-3', 'CPMK-4', 'CPMK-5']), knownCplCodes: new Set(['CPL-1']) });
		expect(out.summary).toMatchObject({ total: 15, valid: 15, warning: 0, error: 0, blankCells: 0 });
		expect(Object.keys(out.rows[0].scores)).toHaveLength(8);
		expect(Object.keys(out.rows[0].references.cpmk)).toHaveLength(5);
		expect(typeof out.rows[0].references.cpl['CPL-1']).toBe('number');
		expect(out.weights).toEqual({ total: 100, complete: true, ok: true });
		expect(allIssues(out).filter((i) => i.severity === 'error')).toEqual([]);
	});
});
