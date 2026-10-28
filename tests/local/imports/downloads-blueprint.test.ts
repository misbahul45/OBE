import { describe, expect, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { cellAt, type SheetGrid } from '#lib/features/imports/imports.types.ts';
import { extractObeBlueprint } from '#lib/features/imports/obe-blueprint.ts';
import { analyzeSheet, suggestMapping } from '#lib/features/imports/sheet-analysis.ts';
import { readWorkbook } from '#lib/features/imports/workbook-reader.server.ts';

const directory = process.env.OBE_LOCAL_EXCEL_DIR || join(homedir(), 'Downloads');
const files = existsSync(directory) ? readdirSync(directory).filter((name) => /^Semester \d+\.xlsx$/i.test(name)).sort() : [];

const suite = files.length > 0 ? describe : describe.skip;

type Checked = { grid: SheetGrid; blueprint: NonNullable<ReturnType<typeof extractObeBlueprint>>; cplChecked: number; cplMatched: number };

const sheets: Checked[] = [];
for (const file of files) {
	for (const grid of readWorkbook(readFileSync(join(directory, file)), file).sheets) {
		const analysis = analyzeSheet(grid);
		const mapping = suggestMapping(analysis);
		if (!mapping) continue;
		const blueprint = extractObeBlueprint(grid, analysis, mapping);
		if (!blueprint) continue;
		const numberAt = (row: number, col: number) => {
			const cell = cellAt(grid, row, col);
			return cell && cell.kind === 'number' && typeof cell.value === 'number' ? cell.value : null;
		};
		const cpmkColumn = new Map(mapping.cpmkColumns.map((c) => [c.code, c.column]));
		const cplColumn = new Map(mapping.cplColumns.map((c) => [c.code, c.column]));
		let cplChecked = 0;
		let cplMatched = 0;
		for (const cpl of blueprint.cpl) {
			const column = cplColumn.get(cpl.code);
			if (column === undefined || cpl.links.length === 0) continue;
			for (const row of analysis.rows.filter((r) => r.kind === 'student').map((r) => r.row - 1)) {
				const excel = numberAt(row, column);
				if (excel === null) continue;
				let numerator = 0;
				let denominator = 0;
				let complete = true;
				for (const link of cpl.links) {
					const source = cpmkColumn.get(link.cpmk);
					const value = source === undefined ? null : numberAt(row, source);
					if (value === null) {
						complete = false;
						break;
					}
					numerator += link.weight * value;
					denominator += link.weight;
				}
				if (!complete || denominator === 0) continue;
				cplChecked++;
				if (Math.abs(numerator / denominator - excel) < 0.51) cplMatched++;
			}
		}
		sheets.push({ grid, blueprint, cplChecked, cplMatched });
	}
}

suite(`cetak biru OBE pada Excel lokal (${files.length} berkas)`, () => {
	test('setiap sheet menghasilkan cetak biru dengan ambang mahasiswa dan rasio kelas', () => {
		expect(sheets.length).toBeGreaterThan(0);
		const without = sheets.filter((s) => s.blueprint.thresholds.studentScore === null || s.blueprint.thresholds.classRatioPercent === null).map((s) => s.grid.name);
		expect(without).toEqual([]);
	});

	test('hampir setiap sheet memiliki CPMK dengan koefisien komponen, dan setiap sheet memiliki CPL dengan bobot CPMK', () => {
		const noCpmk = sheets.filter((s) => s.blueprint.cpmk.filter((c) => c.components.length > 0).length === 0).map((s) => s.grid.name);
		const noCpl = sheets.filter((s) => s.blueprint.cpl.filter((c) => c.links.length > 0).length === 0).map((s) => s.grid.name);
		expect(noCpmk.length / sheets.length).toBeLessThan(0.02);
		expect(noCpl).toEqual([]);
	});

	test('bobot CPL terbaca mereproduksi nilai CPL pada Excel untuk hampir semua sel', () => {
		const checked = sheets.reduce((sum, s) => sum + s.cplChecked, 0);
		const matched = sheets.reduce((sum, s) => sum + s.cplMatched, 0);
		expect(checked).toBeGreaterThan(1000);
		expect(matched / checked).toBeGreaterThan(0.98);
	});

	test('cetak biru tidak memuat nama atau NIM mahasiswa', () => {
		for (const { blueprint } of sheets) expect(JSON.stringify(blueprint)).not.toMatch(/(?<![\d.])\d{8,13}(?![\d.])/);
	});
});
