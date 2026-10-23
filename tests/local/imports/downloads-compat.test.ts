import { describe, expect, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { sha256Hex } from '#lib/features/imports/file-safety.server.ts';
import { cellAt, type SheetAnalysis, type SheetGrid } from '#lib/features/imports/imports.types.ts';
import { analyzeSheet } from '#lib/features/imports/sheet-analysis.ts';
import { readWorkbook } from '#lib/features/imports/workbook-reader.server.ts';

const directory = process.env.OBE_LOCAL_EXCEL_DIR || join(homedir(), 'Downloads');
const files = existsSync(directory)
	? readdirSync(directory)
			.filter((name) => /^(Semester \d+(\(\d+\))?|Capaian_CPMK.*)\.xlsx$/i.test(name))
			.sort()
	: [];

type SheetReport = { file: string; grid: SheetGrid; analysis: SheetAnalysis };

const reports: SheetReport[] = [];
for (const file of files) {
	const workbook = readWorkbook(readFileSync(join(directory, file)), file);
	for (const grid of workbook.sheets) reports.push({ file, grid, analysis: analyzeSheet(grid) });
}

function independentCandidateCount(grid: SheetGrid, headerRow: number, nimColumn: number, nameColumn: number | null): { valid: number; invalid: number } {
	let valid = 0;
	let invalid = 0;
	for (let row = headerRow; row < grid.rowCount; row++) {
		const cell = cellAt(grid, row, nimColumn);
		const name = nameColumn === null ? undefined : cellAt(grid, row, nameColumn);
		if (cell && cell.value !== null && /^[0-9]{6,15}$/.test(String(cell.value).trim())) valid++;
		else if (name && typeof name.value === 'string' && name.value.trim() !== '') invalid++;
	}
	return { valid, invalid };
}

const suite = files.length > 0 ? describe : describe.skip;

suite(`kompatibilitas Excel lokal (${files.length} berkas)`, () => {
	test('setiap sheet berisi data mahasiswa memiliki header, kolom NIM, dan baris mahasiswa', () => {
		const broken = reports.filter((r) => r.analysis.headerRow === null || r.analysis.studentRowCount === 0).map((r) => `${r.file}:${r.grid.name}`);
		expect(broken).toEqual([]);
	});

	test('jumlah baris mahasiswa sama dengan penghitungan independen (NIM valid ditambah baris bernama tanpa NIM valid)', () => {
		const mismatches = reports
			.map((r) => {
				const { valid, invalid } = independentCandidateCount(r.grid, r.analysis.headerRow!, r.analysis.nimColumn!, r.analysis.nameColumn);
				return { id: `${r.file}:${r.grid.name}`, got: r.analysis.studentRowCount, expected: valid + invalid };
			})
			.filter((x) => x.got !== x.expected);
		expect(mismatches).toEqual([]);
	});

	test('rumus yang terisi turun ke baris kosong tidak diperlakukan sebagai data; baris penutup tabel dikecualikan tanpa alarm', () => {
		const orphan = reports.reduce((sum, r) => sum + r.analysis.issues.filter((i) => i.code === 'ROW_WITHOUT_IDENTITY').length, 0);
		const footers = reports.reduce((sum, r) => sum + r.analysis.rows.filter((x) => x.reason === 'FOOTER_ROW').length, 0);
		expect(orphan).toBe(0);
		expect(footers).toBeGreaterThan(0);
	});

	test('kolom komponen hanya berada di dalam blok nilai dan tidak pernah berupa kolom metadata kanan', () => {
		const violations = reports.flatMap((r) =>
			r.analysis.columns
				.filter((c) => c.role === 'component' && (r.analysis.mainBlockEnd === null || c.index > r.analysis.mainBlockEnd || c.header === ''))
				.map((c) => `${r.file}:${r.grid.name}:${c.letter}`)
		);
		expect(violations).toEqual([]);
	});

	test('kolom CPMK/CPL tidak pernah dianggap komponen mentah dan sebaliknya', () => {
		const violations = reports.flatMap((r) =>
			r.analysis.columns
				.filter((c) => (c.role === 'component' && /^(cpmk|cpl)\b/i.test(c.header)) || ((c.role === 'cpmk' || c.role === 'cpl') && !c.outcomeCode))
				.map((c) => `${r.file}:${r.grid.name}:${c.letter}`)
		);
		expect(violations).toEqual([]);
	});

	test('tidak ada kolom di sebelah kanan blok nilai yang berperan komponen, CPMK, atau CPL', () => {
		const violations = reports.flatMap((r) =>
			r.analysis.columns
				.filter((c) => r.analysis.mainBlockEnd !== null && c.index > r.analysis.mainBlockEnd && ['component', 'cpmk', 'cpl'].includes(c.role))
				.map((c) => `${r.file}:${r.grid.name}:${c.letter}`)
		);
		expect(violations).toEqual([]);
	});

	test('Semester 1(1).xlsx identik dengan Semester 1.xlsx berdasarkan SHA-256', () => {
		const original = join(directory, 'Semester 1.xlsx');
		const copy = join(directory, 'Semester 1(1).xlsx');
		if (!existsSync(original) || !existsSync(copy)) return;
		expect(sha256Hex(readFileSync(original))).toBe(sha256Hex(readFileSync(copy)));
	});

	test('ringkasan agregat (tanpa nama atau NIM)', () => {
		const sheets = reports.length;
		const students = reports.reduce((sum, r) => sum + r.analysis.studentRowCount, 0);
		const withWeight100 = reports.filter((r) => r.analysis.weightsTotalPercent === 100).length;
		const weightNull = reports.filter((r) => r.analysis.weightsTotalPercent === null).length;
		const histogram: Record<string, number> = {};
		for (const r of reports) for (const issue of r.analysis.issues) histogram[issue.code] = (histogram[issue.code] ?? 0) + 1;
		const otherWeights = reports.filter((r) => r.analysis.weightsTotalPercent !== null && r.analysis.weightsTotalPercent !== 100).map((r) => r.analysis.weightsTotalPercent);
		const noOutcome = reports.filter((r) => !r.analysis.columns.some((c) => c.role === 'cpmk')).length;
		console.log(
			JSON.stringify({ berkas: files.length, sheet: sheets, barisMahasiswa: students, bobot100: withWeight100, bobotTidakLengkap: weightNull, bobotLain: otherWeights, tanpaKolomCPMK: noOutcome, isu: histogram })
		);
		expect(sheets).toBeGreaterThan(0);
	});
});
