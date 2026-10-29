import { describe, expect, test } from 'bun:test';
import { blueprintCpmkCodes, extractObeBlueprint } from '#lib/features/imports/obe-blueprint.ts';
import { analyzeSheet, suggestMapping } from '#lib/features/imports/sheet-analysis.ts';
import type { SheetGrid } from '#lib/features/imports/imports.types.ts';
import { blueprintSheet } from '../../support/blueprint.ts';
import { simpleSheet } from '../../support/imports.ts';

function extract(grid: SheetGrid) {
	const analysis = analyzeSheet(grid);
	const mapping = suggestMapping(analysis)!;
	return { blueprint: extractObeBlueprint(grid, analysis, mapping), mapping, analysis };
}

describe('ekstraksi cetak biru OBE dari blok kanan sheet', () => {
	test('membaca koefisien komponen ke CPMK dengan kode komponen sama seperti pemetaan kolom', () => {
		const { blueprint, mapping } = extract(blueprintSheet());
		const codes = mapping.components.map((c) => c.code);
		expect(codes).toEqual(['UTS-1', 'UAS-1']);
		expect(blueprint!.cpmk).toEqual([
			{ code: 'CPMK-1', components: [{ componentCode: 'UTS-1', coefficient: 1 }] },
			{ code: 'CPMK-2', components: [{ componentCode: 'UAS-1', coefficient: 1 }] }
		]);
	});

	test('membaca bobot CPMK ke CPL dari matriks CPL \\ CPMK', () => {
		const { blueprint } = extract(blueprintSheet());
		expect(blueprint!.cpl).toEqual([{ code: 'CPL-1', links: [{ cpmk: 'CPMK-1', weight: 0.4 }, { cpmk: 'CPMK-2', weight: 0.6 }] }]);
	});

	test('membaca ambang nilai mahasiswa, ambang rasio kelas, total mahasiswa, dan klaim ketercapaian', () => {
		const { blueprint } = extract(blueprintSheet());
		expect(blueprint!.thresholds).toEqual({ studentScore: 62, classRatioPercent: 75 });
		expect(blueprint!.totalStudents).toBe(3);
		expect(blueprint!.claims).toEqual([
			{ cpmk: 'CPMK-1', achieved: 2, percent: 66.67, reached: false },
			{ cpmk: 'CPMK-2', achieved: 2, percent: 66.67, reached: false }
		]);
	});

	test('header matriks yang berbeda dari header kolom dipetakan menurut urutan bila jumlahnya sama', () => {
		const { blueprint } = extract(blueprintSheet('Sheet Urutan', undefined, { matrixHeaders: ['Ujian tengah', 'Ujian akhir'] }));
		expect(blueprint!.cpmk.map((c) => c.components.map((p) => p.componentCode))).toEqual([['UTS-1'], ['UAS-1']]);
	});

	test('sheet tanpa blok kanan menghasilkan null, bukan cetak biru kosong', () => {
		const { blueprint } = extract(simpleSheet('Polos', [{ nim: 99030000009, name: 'Mahasiswa Polos', uts: 80, uas: 70 }]));
		expect(blueprint).toBeNull();
	});

	test('nilai mahasiswa tidak pernah masuk ke cetak biru', () => {
		const { blueprint } = extract(blueprintSheet());
		const serialized = JSON.stringify(blueprint);
		expect(serialized).not.toContain('Mahasiswa Cetak Biru');
		expect(serialized).not.toContain('99030000001');
	});

	test('daftar kode CPMK gabungan terurut secara numerik', () => {
		const codes = blueprintCpmkCodes({
			version: 1,
			cpmk: [{ code: 'CPMK-10', components: [] }, { code: 'CPMK-2', components: [] }],
			cpl: [{ code: 'CPL-1', links: [{ cpmk: 'CPMK-1', weight: 1 }] }],
			thresholds: { studentScore: null, classRatioPercent: null },
			claims: [{ cpmk: 'CPMK-2', achieved: 1, percent: null, reached: null }],
			totalStudents: null
		});
		expect(codes).toEqual(['CPMK-1', 'CPMK-2', 'CPMK-10']);
	});

	test('kolom komponen dengan teks header identik dipasangkan menurut urutan, tidak ke kode yang sama dua kali', () => {
		const grid = blueprintSheet('Header Kembar', undefined, { matrixHeaders: ['UTS (40 %)', 'UTS (40 %)'] });
		const analysis = analyzeSheet(grid);
		const mapping = suggestMapping(analysis)!;
		const first = mapping.components[0];
		const second = mapping.components[1];
		const twin = { ...mapping, components: [first, { ...second, column: first.column, code: 'UTS-2' }] };
		const blueprint = extractObeBlueprint(grid, analysis, twin)!;
		const used = blueprint.cpmk.flatMap((c) => c.components.map((p) => p.componentCode));
		expect(used.sort()).toEqual(['UTS-1', 'UTS-2']);
	});
});
