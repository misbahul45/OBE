import { describe, expect, test } from 'bun:test';
import { readWorkbook, WorkbookReadError } from '#lib/features/imports/workbook-reader.server.ts';
import { cellAt } from '#lib/features/imports/imports.types.ts';
import { fixtureFiles } from '../../fixtures/builders/build-workbooks.ts';

const readable = Object.entries(fixtureFiles).filter(([name]) => !name.includes('corrupt'));
const syntheticName = /^Mahasiswa Uji \d{3}$/;
const looksLikePersonName = /^[A-Z][a-z]+( [A-Z][a-z]+)+$/;

describe('fixture sintetis', () => {
	test.each(readable)('%s hanya memuat NIM berawalan 990 dan nama sintetis', (name, build) => {
		const workbook = readWorkbook(build(), name);
		const offenders: string[] = [];
		for (const grid of workbook.sheets) {
			for (let row = 0; row < grid.rowCount; row++) {
				for (let col = 0; col < grid.colCount; col++) {
					const cell = cellAt(grid, row, col);
					if (!cell || cell.value === null) continue;
					const text = String(cell.value).trim();
					if (/^0*[0-9]{8,}$/.test(text) && !/^0*990[0-9]+$/.test(text)) offenders.push(`${grid.name}!${col},${row}:angka-panjang`);
					if (col === 2 && looksLikePersonName.test(text) && !syntheticName.test(text)) offenders.push(`${grid.name}!${col},${row}:nama`);
				}
			}
		}
		expect(offenders).toEqual([]);
	});

	test('pendeteksi nama benar-benar menangkap nama manusia biasa', () => {
		expect(looksLikePersonName.test('Budi Santoso')).toBe(true);
		expect(looksLikePersonName.test('Mahasiswa Uji 001')).toBe(false);
		expect(syntheticName.test('Budi Santoso')).toBe(false);
	});

	test('berkas rusak memang ditolak pembaca (bukan fixture valid yang tertukar)', () => {
		expect(() => readWorkbook(fixtureFiles['invalid-corrupt.xlsx'](), 'invalid-corrupt.xlsx')).toThrow(WorkbookReadError);
	});

	test('pembangunan ulang menghasilkan isi sel yang sama (deterministik)', () => {
		const snapshot = (build: () => Buffer) => readWorkbook(build(), 'x.xlsx').sheets.map((g) => g.rows.map((r) => r.map((c) => c?.value ?? null)));
		const build = fixtureFiles['semester-1-multi-sheet.synthetic.xlsx'];
		expect(snapshot(build)).toEqual(snapshot(build));
	});
});
