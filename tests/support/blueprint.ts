import type { SheetGrid } from '#lib/features/imports/imports.types.ts';
import { gridOf, type CellInput } from './grid.ts';

export type BlueprintStudent = { nim: number; name: string; uts: number; uas: number; cpmk1: number; cpmk2: number; cpl1: number };

export const blueprintStudents: BlueprintStudent[] = [
	{ nim: 99030000001, name: 'Mahasiswa Cetak Biru 001', uts: 80, uas: 70, cpmk1: 80, cpmk2: 70, cpl1: 74 },
	{ nim: 99030000002, name: 'Mahasiswa Cetak Biru 002', uts: 60, uas: 50, cpmk1: 60, cpmk2: 50, cpl1: 54 },
	{ nim: 99030000003, name: 'Mahasiswa Cetak Biru 003', uts: 90, uas: 100, cpmk1: 90, cpmk2: 100, cpl1: 96 }
];

export function blueprintSheet(name = 'Sheet Cetak Biru', students: BlueprintStudent[] = blueprintStudents, options: { matrixHeaders?: [string, string] } = {}): SheetGrid {
	const rows: CellInput[][] = Array.from({ length: Math.max(15, students.length + 1) }, () => Array.from({ length: 16 }, () => null));
	rows[0].splice(0, 8, 'NO', 'NIM', 'Nama', 'UTS (40 %)', 'UAS (60 %)', 'CPMK-1', 'CPMK-2', 'CPL 1');
	students.forEach((s, i) => rows[i + 1].splice(0, 8, i + 1, s.nim, s.name, s.uts, s.uas, s.cpmk1, s.cpmk2, s.cpl1));
	const [firstHeader, secondHeader] = options.matrixHeaders ?? ['UTS (40 %)', 'UAS (60 %)'];
	const block: [number, number, CellInput][] = [
		[0, 11, 'CPMK'], [0, 12, firstHeader], [0, 13, secondHeader],
		[1, 12, 0.4], [1, 13, 0.6],
		[2, 11, 'CPMK-1'], [2, 12, 1],
		[3, 11, 'CPMK-2'], [3, 13, 1],
		[5, 11, 'Threshold Nilai Mahasiswa'], [5, 12, 62], [5, 14, 'nilai BC'],
		[6, 11, 'Threshold Nilai Capaian (%)'], [6, 12, 75],
		[7, 11, 'Total Mahasiswa'], [7, 12, students.length],
		[8, 12, 'Jumlah Mahasiswa Tercapai'], [8, 13, 'Capaian (%)'], [8, 14, 'Hasil Akhir'],
		[9, 11, 'CPMK-1'], [9, 12, 2], [9, 13, 66.67], [9, 14, 'Tidak Tercapai'],
		[10, 11, 'CPMK-2'], [10, 12, 2], [10, 13, 66.67], [10, 14, 'Tidak Tercapai'],
		[12, 11, 'CPL \\ CPMK'], [12, 12, 'CPMK-1'], [12, 13, 'CPMK-2'], [12, 14, 'Total'],
		[13, 11, 'CPL-1'], [13, 12, 0.4], [13, 13, 0.6], [13, 14, 1]
	];
	for (const [row, col, value] of block) rows[row][col] = value;
	return gridOf(name, rows);
}
