import { beforeAll, describe, expect, test } from 'bun:test';
import { analyzeSheet, suggestMapping } from '#lib/features/imports/sheet-analysis.ts';
import { readWorkbook } from '#lib/features/imports/workbook-reader.server.ts';
import type { SheetAnalysis, SheetGrid } from '#lib/features/imports/imports.types.ts';
import { buildSemesterWorkbook, buildSinyalWorkbook } from '../../fixtures/builders/templates.ts';
import { buildMultiHeaderWorkbook, buildNoStudentIdWorkbook, buildVariationsWorkbook, variationRows } from '../../fixtures/builders/variations.ts';

let semester: SheetGrid[];
let sinyal: SheetGrid[];

beforeAll(() => {
	semester = readWorkbook(buildSemesterWorkbook(), 's.xlsx').sheets;
	sinyal = readWorkbook(buildSinyalWorkbook(), 'k.xlsx').sheets;
});

const roleIndexes = (analysis: SheetAnalysis, role: string) => analysis.columns.filter((c) => c.role === role).map((c) => c.index);

describe('format Semester 1 - sheet A (header terpecah, bobot di header)', () => {
	test('baris header, kolom identitas, dan jumlah mahasiswa', () => {
		const a = analyzeSheet(semester[0]);
		expect(a).toMatchObject({ headerRow: 1, nimColumn: 1, nameColumn: 2, firstDataRow: 2, studentRowCount: 15 });
	});

	test('delapan komponen D:K dengan bobot dari header berjumlah 100', () => {
		const a = analyzeSheet(semester[0]);
		const comps = a.columns.filter((c) => c.role === 'component');
		expect(comps.map((c) => c.letter)).toEqual(['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']);
		expect(comps.map((c) => c.component!.weightPercent)).toEqual([5, 5, 5, 20, 10, 15, 20, 20]);
		expect(a.weightsTotalPercent).toBe(100);
		expect(new Set(comps.map((c) => c.component!.code)).size).toBe(8);
		expect(new Set(comps.map((c) => c.component!.name)).size).toBe(8);
		expect(comps[0].component!.code).toBe('UTS-1');
		expect(comps[7].component!.code).toBe('UAS-4');
	});

	test('CPMK-1..5 dan CPL 1 dikenali sebagai hasil Excel, bukan komponen mentah', () => {
		const a = analyzeSheet(semester[0]);
		expect(a.columns.filter((c) => c.role === 'cpmk').map((c) => c.outcomeCode)).toEqual(['CPMK-1', 'CPMK-2', 'CPMK-3', 'CPMK-4', 'CPMK-5']);
		expect(a.columns.filter((c) => c.role === 'cpl').map((c) => c.outcomeCode)).toEqual(['CPL-1']);
		expect(a.mainBlockEnd).toBe(16);
	});

	test('blok metadata di kanan tidak menjadi komponen maupun mahasiswa', () => {
		const a = analyzeSheet(semester[0]);
		expect(roleIndexes(a, 'component').every((i) => i < 11)).toBe(true);
		expect(a.columns.filter((c) => c.index >= 18 && c.role !== 'ignored').every((c) => c.role === 'metadata')).toBe(true);
		expect(a.metadataRegions.length).toBeGreaterThan(0);
		expect(a.metadataRegions[0].startCol).toBe(18);
		expect(a.metadataRegions.flatMap((r) => r.kinds)).toContain('threshold');
		expect(a.metadataRegions.flatMap((r) => r.kinds)).toContain('cpl_cpmk_matrix');
		expect(a.rows.filter((r) => r.kind === 'student').length).toBe(15);
		expect(a.issues.map((i) => i.code)).toContain('METADATA_IGNORED');
	});
});

describe('format Semester 1 - sheet B (kolom kosong sebelum CPMK, label berulang)', () => {
	test('tujuh komponen, kolom K kosong diabaikan, label duplikat di kanan menjadi metadata', () => {
		const a = analyzeSheet(semester[1]);
		const comps = a.columns.filter((c) => c.role === 'component');
		expect(comps.map((c) => c.letter)).toEqual(['D', 'E', 'F', 'G', 'H', 'I', 'J']);
		expect(a.weightsTotalPercent).toBe(100);
		expect(a.columns[10]).toMatchObject({ letter: 'K', role: 'ignored' });
		expect(a.columns.filter((c) => c.role === 'cpmk')).toHaveLength(5);
		expect(a.columns.filter((c) => c.index >= 18).some((c) => c.role === 'component')).toBe(false);
		expect(a.studentRowCount).toBe(14);
	});

	test('sidik jari struktur berbeda antar template dan sama untuk struktur identik', () => {
		const a = analyzeSheet(semester[0]);
		const b = analyzeSheet(semester[1]);
		expect(a.fingerprint).not.toBe(b.fingerprint);
		expect(analyzeSheet(semester[0]).fingerprint).toBe(a.fingerprint);
	});

	test('saran target offering diambil dari nama sheet sebagai petunjuk saja', () => {
		expect(analyzeSheet(semester[1]).offeringHint).toEqual({ courseNameHint: 'Kelas Uji B', sectionHint: 'T1', isPractical: false });
	});
});

describe('format Capaian CPMK Sinyal Sistem Kontrol', () => {
	test('komponen bertanda # dikenali dan kolom ghost tanpa header ditandai', () => {
		const a = analyzeSheet(sinyal[0]);
		const comps = a.columns.filter((c) => c.role === 'component');
		expect(comps.map((c) => c.component!.weightPercent)).toEqual([10, 20, 20, 25, 25]);
		expect(comps.map((c) => c.component!.name)).toEqual(['Keaktifan', 'UTS - Tugas', 'UAS - Tugas', 'UTS - Case Based - Studi Kasus', 'UAS - Case Based - Studi Kasus']);
		expect(comps.map((c) => c.component!.code)).toEqual(['KOMP-1', 'UTS-1', 'UAS-1', 'UTS-2', 'UAS-2']);
		const ghost = a.columns.find((c) => c.ghost);
		expect(ghost).toMatchObject({ letter: 'I', role: 'ignored' });
		expect(a.issues.map((i) => i.code)).toContain('UNLABELED_COLUMN_WITH_DATA');
	});

	test('CPL 3 dan CPL 5 dibaca sebagai hasil, bukan komponen', () => {
		const a = analyzeSheet(sinyal[0]);
		expect(a.columns.filter((c) => c.role === 'cpl').map((c) => c.outcomeCode)).toEqual(['CPL-3', 'CPL-5']);
		expect(a.columns.filter((c) => c.role === 'cpmk')).toHaveLength(5);
		expect(a.offeringHint.courseNameHint).toBe('CPMK_T1');
	});
});

describe('variasi baris', () => {
	test('baris ringkasan dikecualikan, baris bermasalah tetap menjadi kandidat mahasiswa untuk dilaporkan', () => {
		const { cases } = variationRows();
		const [grid] = readWorkbook(buildVariationsWorkbook(), 'v.xlsx').sheets;
		const a = analyzeSheet(grid);
		const byRow = new Map(a.rows.map((r) => [r.row, r]));
		expect(byRow.get(cases.summary_row)).toMatchObject({ kind: 'excluded', reason: 'SUMMARY_ROW' });
		for (const label of ['nim_blank', 'nim_text_invalid', 'name_blank', 'duplicate_nim', 'score_text'])
			expect(byRow.get(cases[label])!.kind).toBe('student');
		expect(a.studentRowCount).toBe(15);
		expect(a.weightsTotalPercent).toBe(100);
	});
});

describe('header tidak biasa', () => {
	test('header bertingkat: bobot di baris kedua digabung dan data dimulai setelahnya', () => {
		const [grid] = readWorkbook(buildMultiHeaderWorkbook(), 'm.xlsx').sheets;
		const a = analyzeSheet(grid);
		expect(a).toMatchObject({ headerRow: 4, headerSpan: 2, firstDataRow: 6, studentRowCount: 2 });
		expect(a.columns.filter((c) => c.role === 'component').map((c) => c.component!.weightPercent)).toEqual([40, 60]);
	});

	test('tanpa kolom NIM: tidak menebak, melaporkan HEADER_NOT_FOUND', () => {
		const [grid] = readWorkbook(buildNoStudentIdWorkbook(), 'n.xlsx').sheets;
		const a = analyzeSheet(grid);
		expect(a.headerRow).toBeNull();
		expect(a.issues.map((i) => i.code)).toEqual(['HEADER_NOT_FOUND']);
		expect(suggestMapping(a)).toBeNull();
	});

	test('baris header dapat dipaksa manual', () => {
		expect(analyzeSheet(semester[0], { headerRow: 1 }).headerRow).toBe(1);
		expect(analyzeSheet(semester[0], { headerRow: 5 }).headerRow).toBeNull();
	});
});

describe('suggestMapping', () => {
	test('mengubah analisis menjadi pemetaan yang dapat dikonfirmasi pengguna', () => {
		const mapping = suggestMapping(analyzeSheet(semester[0]))!;
		expect(mapping).toMatchObject({ headerRow: 1, nimColumn: 1, nameColumn: 2, firstDataRow: 2 });
		expect(mapping.components).toHaveLength(8);
		expect(mapping.cpmkColumns).toHaveLength(5);
		expect(mapping.cplColumns).toEqual([{ column: 16, code: 'CPL-1' }]);
	});
});
