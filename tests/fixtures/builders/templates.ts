import { createRandom, syntheticName, syntheticNim } from './prng.ts';
import { place, workbookBuffer, writeSheet, type CellSpec } from './sheet-writer.ts';

const round2 = (value: number) => Math.round(value * 100) / 100;

function weightedMean(scores: number[], weights: number[]): number {
	let numerator = 0;
	let denominator = 0;
	scores.forEach((score, i) => {
		numerator += score * weights[i];
		denominator += weights[i];
	});
	return round2(numerator / denominator);
}

export type TemplateStudent = { nim: string; name: string; scores: number[] };

export function syntheticStudents(count: number, seed: number, componentCount: number, firstSerial = 1): TemplateStudent[] {
	const random = createRandom(seed);
	return Array.from({ length: count }, (_, i) => ({
		nim: syntheticNim(firstSerial + i),
		name: syntheticName(firstSerial + i),
		scores: Array.from({ length: componentCount }, () => round2(60 + random() * 40))
	}));
}

const semesterHeaderBroken = (phase: 'UTS' | 'UAS', label: string | null, weight: number) =>
	phase === 'UTS'
		? `UTS (Mi\n dterm) #\n${label ? ` ${label}\n` : '  \n'}  \n  \n (${weight} %)`
		: `UAS (Fi\n nalterm) #\n${label ? ` ${label}\n` : '  \n'}  \n  \n (${weight} %)`;

export const semesterSheetAComponents = [
	{ header: semesterHeaderBroken('UTS', null, 5), weight: 5 },
	{ header: semesterHeaderBroken('UTS', null, 5), weight: 5 },
	{ header: semesterHeaderBroken('UTS', null, 5), weight: 5 },
	{ header: semesterHeaderBroken('UTS', null, 20), weight: 20 },
	{ header: 'UAS (Fi\n nalterm) # Komp onen Lain # P enulisan Biografi Tokoh Lokal (10 %)', weight: 10 },
	{ header: semesterHeaderBroken('UAS', 'Project Based', 15), weight: 15 },
	{ header: semesterHeaderBroken('UAS', 'Project Based', 20), weight: 20 },
	{ header: semesterHeaderBroken('UAS', 'Project Based', 20), weight: 20 }
];

export function buildSemesterSheetA(studentCount = 15) {
	const components = semesterSheetAComponents;
	const students = syntheticStudents(studentCount, 101, components.length);
	const weights = components.map((c) => c.weight);
	const rows: CellSpec[][] = [];
	place(rows, 0, 0, [['NO', 'NIM', 'Nama', ...components.map((c) => c.header), 'CPMK-1', 'CPMK-2', 'CPMK-3', 'CPMK-4', 'CPMK-5', 'CPL 1']]);
	students.forEach((student, i) => {
		const mean = weightedMean(student.scores, weights);
		const cached = { v: mean, t: 'n' as const };
		place(rows, i + 1, 0, [
			[
				i + 1,
				Number(student.nim),
				student.name,
				...student.scores,
				...[1, 2, 3, 4, 5].map((n) => ({ ...cached, f: `IFERROR(SUMPRODUCT($D${i + 2}:$K${i + 2},$T$2:$AA$2,INDEX($T$3:$AA$7,MATCH(${'LMNOP'[n - 1]}$1,$S$3:$S$7,0),0))/SUMPRODUCT($T$2:$AA$2,INDEX($T$3:$AA$7,MATCH(${'LMNOP'[n - 1]}$1,$S$3:$S$7,0),0)),"")` })),
				{ ...cached, f: `((L${i + 2}*$T$22)+(M${i + 2}*$U$22)+(N${i + 2}*$V$22)+(O${i + 2}*$W$22)+(P${i + 2}*$X$22))/$Y$22` }
			]
		]);
	});
	place(rows, 0, 18, [['CPMK', 'Poster Diri (25 %)', 'Roadmap \n (25 %)', 'PjBL (30 %)', 'Recognisi Magang UKM (15 %)', 'Kehadiran (5 %)', 'Softskill']]);
	place(rows, 1, 19, [[0.25, 0.25, 0.3, 0.15, 0.05, 0, 'Harap diisi']]);
	for (let k = 1; k <= 5; k++) place(rows, k + 1, 18, [[`CPMK-${k}`, 1, 1, 1, 1, 1]]);
	place(rows, 8, 18, [['Threshold Nilai Mahasiswa', 62, undefined, 'nilai BC']]);
	place(rows, 9, 18, [['Threshold Nilai Capaian %', 75, undefined, 'jumlah mhs min BC', undefined, 0.25, 0.25, 0.3, 0.15, 0.05]]);
	place(rows, 10, 18, [['Total Mahasiswa', students.length]]);
	place(rows, 12, 19, [['Jumlah Mahasiswa Tercapai', 'Capaian (%)', 'Hasil Akhir']]);
	for (let k = 1; k <= 5; k++) place(rows, 12 + k, 18, [[`CPMK-${k}`, students.length - 2, 80.5, 'Tercapai']]);
	place(rows, 20, 18, [['CPL \\ CPMK', 'CPMK-1', 'CPMK-2', 'CPMK-3', 'CPMK-4', 'CPMK-5', 'Total']]);
	place(rows, 21, 18, [['CPL 1', 0.2, 0.2, 0.2, 0.2, 0.2, 1]]);
	return { students, rows, merges: ['Z2:Z7'], weights };
}

export const semesterSheetBComponents = [
	{ header: 'UTS \n(Midterm) # \n(10 %)', weight: 10 },
	{ header: 'UTS \n(Midterm) # \n(10 %)', weight: 10 },
	{ header: 'UTS \n(Midterm) # \n(5 %)', weight: 5 },
	{ header: 'UTS \n(Midterm) # \n(20 %)', weight: 20 },
	{ header: 'UAS \n(15 %)', weight: 15 },
	{ header: 'UAS \n(20 %)', weight: 20 },
	{ header: 'UAS \n(20 %)', weight: 20 }
];

export function buildSemesterSheetB(studentCount = 14) {
	const components = semesterSheetBComponents;
	const students = syntheticStudents(studentCount, 202, components.length, 101);
	const weights = components.map((c) => c.weight);
	const rows: CellSpec[][] = [];
	place(rows, 0, 0, [['NO', 'NIM', 'Nama', ...components.map((c) => c.header), undefined, 'CPMK-1', 'CPMK-2', 'CPMK-3', 'CPMK-4', 'CPMK-5', 'CPL 1']]);
	students.forEach((student, i) => {
		const mean = weightedMean(student.scores, weights);
		place(rows, i + 1, 0, [
			[i + 1, Number(student.nim), student.name, ...student.scores, undefined, ...[1, 2, 3, 4, 5].map(() => ({ v: mean, t: 'n' as const, f: `IFERROR(SUMPRODUCT($D${i + 2}:$K${i + 2},$T$2:$AA$2),"")` })), { v: mean, t: 'n', f: `(L${i + 2}*$T$22)/$Y$22` }]
		]);
	});
	place(rows, 0, 18, [['CPMK', ...components.map((c) => c.header)]]);
	place(rows, 1, 19, [[...weights.map((w) => w / 100), 'Harap diisi']]);
	for (let k = 1; k <= 5; k++) place(rows, k + 1, 18, [[`CPMK-${k}`, ...components.map((_, j) => (k > 3 && j > 3 ? 1 : 1))]]);
	place(rows, 8, 18, [['Threshold Nilai Mahasiswa', 62]]);
	place(rows, 9, 18, [['Threshold Nilai Capaian %', 75]]);
	return { students, rows, merges: ['AA2:AA7'], weights };
}

export function buildSemesterWorkbook(): Buffer {
	const a = buildSemesterSheetA();
	const b = buildSemesterSheetB();
	return workbookBuffer([
		{ name: 'Mata Kuliah Uji A', sheet: writeSheet(a.rows, { merges: a.merges, inflateRefTo: 'A1:AE1000' }) },
		{ name: 'Kelas Uji B T1', sheet: writeSheet(b.rows, { merges: b.merges, inflateRefTo: 'A1:AG1000' }) }
	]);
}

export function buildAutoMapWorkbook(): Buffer {
	const a = buildSemesterSheetA();
	return workbookBuffer([{ name: 'Mata Kuliah Uji C T2', sheet: writeSheet(a.rows, { merges: a.merges, inflateRefTo: 'A1:AE1000' }) }]);
}

export function buildSemesterWorkbookChanged(): Buffer {
	const a = buildSemesterSheetA();
	const b = buildSemesterSheetB();
	let changed = 0;
	for (const row of a.rows) {
		const cell = row?.[4];
		if (changed < 3 && typeof cell === 'number' && cell > 50 && cell < 90) {
			row[4] = round2(cell + 7);
			changed++;
		}
	}
	return workbookBuffer([
		{ name: 'Mata Kuliah Uji A', sheet: writeSheet(a.rows, { merges: a.merges, inflateRefTo: 'A1:AE1000' }) },
		{ name: 'Kelas Uji B T1', sheet: writeSheet(b.rows, { merges: b.merges, inflateRefTo: 'A1:AG1000' }) }
	]);
}

export const sinyalComponents = [
	{ header: '# Komponen Lain # Keaktifan (10%)', weight: 10 },
	{ header: 'UTS (Midterm) # Komponen Lain # Tugas (20%)', weight: 20 },
	{ header: 'UAS (Finalterm) # Komponen Lain # Tugas (20%)', weight: 20 },
	{ header: 'UTS (Midterm) # Case Based # Studi Kasus (25%)', weight: 25 },
	{ header: 'UAS (Finalterm) # Case Based # Studi Kasus (25%)', weight: 25 }
];

export function buildSinyalSheet(studentCount = 12) {
	const students = syntheticStudents(studentCount, 303, sinyalComponents.length, 201);
	const weights = sinyalComponents.map((c) => c.weight);
	const rows: CellSpec[][] = [];
	place(rows, 0, 0, [['No', 'NIM', 'Nama', ...sinyalComponents.map((c) => c.header), undefined, undefined, ...['CPMK-1', 'CPMK-2', 'CPMK-3', 'CPMK-4', 'CPMK-5'], 'CPL 3', 'CPL 5']]);
	students.forEach((student, i) => {
		const mean = weightedMean(student.scores, weights);
		const formulaCell = { v: mean, t: 'n' as const, f: `SUMPRODUCT($D${i + 2}:$H${i + 2},$S$2:$W$2)` };
		place(rows, i + 1, 0, [[i + 1, Number(student.nim), student.name, ...student.scores, 0, undefined, formulaCell, formulaCell, formulaCell, formulaCell, formulaCell, formulaCell, formulaCell]]);
	});
	place(rows, 0, 18, [['CPMK', ...sinyalComponents.map((c) => c.header)]]);
	place(rows, 1, 18, [[undefined, ...weights.map((w) => w / 100)]]);
	for (let k = 1; k <= 5; k++) place(rows, k + 1, 18, [[`CPMK-${k}`, 1, 1, 1, 1, 1]]);
	place(rows, 8, 18, [['Threshold Nilai Mahasiswa', 62]]);
	return { students, rows };
}

export function buildSinyalWorkbook(): Buffer {
	const sheet = buildSinyalSheet();
	return workbookBuffer([{ name: 'CPMK_T1', sheet: writeSheet(sheet.rows) }]);
}
