import { describe, expect, test } from 'bun:test';
import { importLimits, readWorkbook, WorkbookReadError, type WorkbookErrorCode } from '#lib/features/imports/workbook-reader.server.ts';
import { cellAt } from '#lib/features/imports/imports.types.ts';
import { sanitizeFileName, sha256Hex } from '#lib/features/imports/file-safety.server.ts';
import { buildSemesterWorkbook, buildSinyalWorkbook } from '../../fixtures/builders/templates.ts';
import {
	buildCorruptWorkbook,
	buildHiddenSheetWorkbook,
	buildHighRatioZip,
	buildMacroLikeWorkbook,
	buildPathTraversalZip,
	buildTooManyEntriesZip,
	buildVariationsWorkbook,
	buildZipBombLike,
	variationRows
} from '../../fixtures/builders/variations.ts';

function codeOf(run: () => unknown): WorkbookErrorCode | 'NO_ERROR' {
	try {
		run();
		return 'NO_ERROR';
	} catch (error) {
		if (error instanceof WorkbookReadError) return error.code;
		throw error;
	}
}

describe('pembacaan workbook sintetis', () => {
	test('dua sheet terbaca terpisah dan ukuran sheet dihitung dari sel terisi, bukan dimensi Excel', () => {
		const result = readWorkbook(buildSemesterWorkbook(), 'semester.xlsx');
		expect(result.kind).toBe('xlsx');
		expect(result.sheets.map((s) => s.name)).toEqual(['Mata Kuliah Uji A', 'Kelas Uji B T1']);
		for (const sheet of result.sheets) {
			expect(sheet.rowCount).toBeLessThan(40);
			expect(sheet.colCount).toBeLessThan(40);
		}
	});

	test('NIM numerik terbaca utuh sebagai angka dan rumus menyimpan nilai cache', () => {
		const [grid] = readWorkbook(buildSemesterWorkbook(), 'semester.xlsx').sheets;
		const nim = cellAt(grid, 1, 1)!;
		expect(nim.kind).toBe('number');
		expect(nim.value).toBe(99000000001);
		const cpmk = cellAt(grid, 1, 11)!;
		expect(cpmk.formula).toContain('SUMPRODUCT');
		expect(cpmk.cached).toBe(true);
		expect(typeof cpmk.value).toBe('number');
	});

	test('sel gabungan dilaporkan dan header bertipe string dengan baris baru dipertahankan', () => {
		const [grid] = readWorkbook(buildSemesterWorkbook(), 'semester.xlsx').sheets;
		expect(grid.merges.length).toBe(1);
		expect(String(cellAt(grid, 0, 3)!.value)).toContain('\n');
	});

	test('rumus tanpa cache ditandai, galat rumus dan sel tanggal dibedakan', () => {
		const { cases } = variationRows();
		const [grid] = readWorkbook(buildVariationsWorkbook(), 'variasi.xlsx').sheets;
		expect(cellAt(grid, cases.formula_no_cache - 1, 3)).toMatchObject({ formula: 'AVERAGE(D2:D5)', cached: false });
		expect(cellAt(grid, cases.formula_error - 1, 4)!.kind).toBe('error');
		expect(cellAt(grid, cases.score_date - 1, 3)!.kind).toBe('date');
		expect(cellAt(grid, cases.leading_zero_string - 1, 1)).toMatchObject({ kind: 'string', value: '0099000001' });
		expect(cellAt(grid, cases.zero_and_blank - 1, 3)).toMatchObject({ kind: 'number', value: 0 });
		expect(cellAt(grid, cases.zero_and_blank - 1, 4)).toBeUndefined();
	});

	test('sheet tersembunyi dilewati dan dilaporkan', () => {
		const result = readWorkbook(buildHiddenSheetWorkbook(), 'tersembunyi.xlsx');
		expect(result.sheets.map((s) => s.name)).toEqual(['Terlihat']);
		expect(result.skipped).toEqual([{ name: 'Tersembunyi', reason: 'Sheet tersembunyi' }]);
	});

	test('satu sheet format kedua terbaca', () => {
		const result = readWorkbook(buildSinyalWorkbook(), 'sinyal.xlsx');
		expect(result.sheets.map((s) => s.name)).toEqual(['CPMK_T1']);
	});
});

describe('penolakan berkas tidak aman atau rusak', () => {
	test('berkas kosong, terlalu besar, dan tipe tidak didukung', () => {
		expect(codeOf(() => readWorkbook(new Uint8Array(0), 'a.xlsx'))).toBe('EMPTY_FILE');
		expect(codeOf(() => readWorkbook(buildSinyalWorkbook(), 'a.xlsx', { ...importLimits, maxFileBytes: 1000 }))).toBe('FILE_TOO_LARGE');
		expect(codeOf(() => readWorkbook(buildSinyalWorkbook(), 'a.pdf'))).toBe('UNSUPPORTED_TYPE');
		expect(codeOf(() => readWorkbook(buildSinyalWorkbook(), 'a'))).toBe('UNSUPPORTED_TYPE');
		expect(codeOf(() => readWorkbook(buildSinyalWorkbook(), 'lama.xls'))).toBe('UNSUPPORTED_TYPE');
	});

	test('isi OLE dengan ekstensi xlsx ditolak sebagai format lama', () => {
		const ole = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(600)]);
		expect(codeOf(() => readWorkbook(ole, 'palsu.xlsx'))).toBe('UNSUPPORTED_TYPE');
	});

	test('berkas rusak atau terpotong ditolak tanpa melempar galat mentah', () => {
		expect(codeOf(() => readWorkbook(buildCorruptWorkbook(), 'rusak.xlsx'))).toBe('CORRUPT_FILE');
		const valid = buildSinyalWorkbook();
		expect(codeOf(() => readWorkbook(valid.subarray(0, Math.floor(valid.length / 2)), 'terpotong.xlsx'))).toBe('CORRUPT_FILE');
		expect(codeOf(() => readWorkbook(Buffer.from('bukan zip sama sekali'), 'teks.xlsx'))).toBe('CORRUPT_FILE');
	});

	test('zip bomb, rasio kompresi mencurigakan, path traversal, dan terlalu banyak entri', () => {
		expect(codeOf(() => readWorkbook(buildZipBombLike(), 'bom.xlsx'))).toBe('ZIP_BOMB');
		expect(codeOf(() => readWorkbook(buildHighRatioZip(), 'rasio.xlsx'))).toBe('ZIP_BOMB');
		expect(codeOf(() => readWorkbook(buildPathTraversalZip(), 'traversal.xlsx'))).toBe('ZIP_BOMB');
		expect(codeOf(() => readWorkbook(buildTooManyEntriesZip(600), 'banyak.xlsx'))).toBe('ZIP_BOMB');
	});

	test('workbook bermakro ditolak', () => {
		expect(codeOf(() => readWorkbook(buildMacroLikeWorkbook(), 'makro.xlsx'))).toBe('MACRO_NOT_SUPPORTED');
	});

	test('batas jumlah sheet dan ukuran sheet ditegakkan', () => {
		expect(codeOf(() => readWorkbook(buildSemesterWorkbook(), 'a.xlsx', { ...importLimits, maxSheets: 1 }))).toBe('TOO_MANY_SHEETS');
		expect(codeOf(() => readWorkbook(buildSemesterWorkbook(), 'a.xlsx', { ...importLimits, maxRowsPerSheet: 5 }))).toBe('SHEET_TOO_LARGE');
		expect(codeOf(() => readWorkbook(buildSemesterWorkbook(), 'a.xlsx', { ...importLimits, maxColsPerSheet: 5 }))).toBe('SHEET_TOO_LARGE');
	});
});

describe('berkas CSV', () => {
	const csv = (text: string) => new TextEncoder().encode(text);

	test('pemisah titik koma dideteksi dan NIM tetap teks dengan nol di depan', () => {
		const result = readWorkbook(csv('NIM;Nama;UTS (100 %)\n0099000001;Mahasiswa Uji 1;80,5\n'), 'nilai.csv');
		expect(result.kind).toBe('csv');
		const [grid] = result.sheets;
		expect(grid.name).toBe('CSV');
		expect(cellAt(grid, 1, 0)).toMatchObject({ kind: 'string', value: '0099000001' });
		expect(cellAt(grid, 1, 2)).toMatchObject({ kind: 'string', value: '80,5' });
	});

	test('BOM UTF-8 dibuang dan pemisah koma dideteksi', () => {
		const result = readWorkbook(csv('\ufeffNIM,Nama\n99000000001,Mahasiswa Uji 1\n'), 'nilai.csv');
		expect(cellAt(result.sheets[0], 0, 0)).toMatchObject({ value: 'NIM' });
	});

	test('CSV berisi byte NUL ditolak', () => {
		expect(codeOf(() => readWorkbook(new Uint8Array([78, 73, 77, 0, 0, 1, 2]), 'biner.csv'))).toBe('CORRUPT_FILE');
	});
});

describe('utilitas berkas', () => {
	test('SHA-256 stabil untuk isi yang sama dan berbeda untuk isi berbeda', () => {
		const a = buildSinyalWorkbook();
		expect(sha256Hex(a)).toBe(sha256Hex(Buffer.from(a)));
		expect(sha256Hex(a)).toHaveLength(64);
		expect(sha256Hex(a)).not.toBe(sha256Hex(buildSemesterWorkbook()));
	});

	test('nama berkas disanitasi dari path, karakter kontrol, dan titik awal', () => {
		expect(sanitizeFileName('../../etc/passwd.xlsx')).toBe('passwd.xlsx');
		expect(sanitizeFileName('C:\\Users\\x\\Berkas Uji 7(1).XLSX')).toBe('Berkas Uji 7(1).xlsx');
		expect(sanitizeFileName('a<b>:c|d?.xlsx')).toBe('abcd.xlsx');
		expect(sanitizeFileName('.hidden.csv')).toBe('hidden.csv');
		expect(sanitizeFileName('')).toBe('berkas');
		expect(sanitizeFileName(`${'x'.repeat(300)}.xlsx`).length).toBeLessThanOrEqual(110);
	});
});
