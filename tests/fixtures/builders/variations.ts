import { place, workbookBuffer, writeSheet, type CellSpec } from './sheet-writer.ts';

export const variationHeader: CellSpec[] = ['NO', 'NIM', 'Nama', 'UTS (50 %)', 'UAS (50 %)', 'CPMK-1', 'CPL 1'];

export type VariationCase = { row: number; label: string };

export function variationRows(): { rows: CellSpec[][]; cases: Record<string, number> } {
	const rows: CellSpec[][] = [variationHeader];
	const cases: Record<string, number> = {};
	const add = (label: string, line: CellSpec[]) => {
		rows.push(line);
		cases[label] = rows.length;
	};
	add('leading_zero_string', [1, '0099000001', 'Mahasiswa Uji 101', 80, 90, 85, 85]);
	add('zero_and_blank', [2, 99000000002, 'Mahasiswa Uji 102', 0, undefined, 0, 0]);
	add('comma_decimal', [3, 99000000003, 'Mahasiswa Uji 103', '85,5', 70, 77.75, 77.75]);
	add('out_of_range', [4, 99000000004, 'Mahasiswa Uji 104', 150, -5, 10, 10]);
	add('duplicate_nim', [5, 99000000004, 'Mahasiswa Uji 105', 70, 70, 70, 70]);
	add('nim_blank', [6, undefined, 'Mahasiswa Uji 106', 70, 70, 70, 70]);
	add('nim_text_invalid', [7, 'ABC123', 'Mahasiswa Uji 107', 70, 70, 70, 70]);
	add('name_blank', [8, 99000000008, undefined, 70, 70, 70, 70]);
	add('score_text', [9, 99000000009, 'Mahasiswa Uji 109', 'abc', 70, 70, 70]);
	add('score_date', [10, 99000000010, 'Mahasiswa Uji 110', { v: 45000, t: 'n', z: 'dd/mm/yyyy' }, 70, 70, 70]);
	add('summary_row', [undefined, 'Rata-rata', undefined, 75, 80, 77, 77]);
	add('formula_no_cache', [12, 99000000012, 'Mahasiswa Uji 112', { f: 'AVERAGE(D2:D5)' }, 70, 70, 70]);
	add('scientific_full', [13, '9.9000000013E+10', 'Mahasiswa Uji 113', 70, 70, 70, 70]);
	add('scientific_ambiguous', [14, '9.90E+10', 'Mahasiswa Uji 114', 70, 70, 70, 70]);
	add('formula_error', [15, 99000000015, 'Mahasiswa Uji 115', 70, { t: 'e', v: 7, w: '#DIV/0!' }, 70, 70]);
	add('reference_out_of_range', [16, 99000000016, 'Mahasiswa Uji 116', 70, 70, 250, 85]);
	return { rows, cases };
}

export function buildVariationsWorkbook(): Buffer {
	const { rows } = variationRows();
	place(rows, 20, 9, [['Threshold', 62]]);
	return workbookBuffer([{ name: 'Variasi Uji', sheet: writeSheet(rows) }]);
}

export function buildNoStudentIdWorkbook(): Buffer {
	const rows: CellSpec[][] = [
		['Kode', 'Nilai', 'Keterangan'],
		['A1', 80, 'bukan data mahasiswa'],
		['A2', 70, 'tanpa kolom NIM']
	];
	return workbookBuffer([{ name: 'Tanpa NIM', sheet: writeSheet(rows) }]);
}

export function buildMultiHeaderWorkbook(): Buffer {
	const rows: CellSpec[][] = [
		['Rekap nilai kelas uji', undefined, undefined],
		['Semester ganjil', undefined, undefined],
		[],
		['No', 'NIM', 'Nama', 'UTS', 'UAS'],
		[undefined, undefined, undefined, '(40 %)', '(60 %)'],
		[1, 99000000401, 'Mahasiswa Uji 401', 80, 90],
		[2, 99000000402, 'Mahasiswa Uji 402', 70, 75]
	];
	return workbookBuffer([{ name: 'Header Bertingkat', sheet: writeSheet(rows) }]);
}

export function buildHiddenSheetWorkbook(): Buffer {
	const visible: CellSpec[][] = [['No', 'NIM', 'Nama', 'UTS (100 %)'], [1, 99000000501, 'Mahasiswa Uji 501', 80]];
	const hidden: CellSpec[][] = [['No', 'NIM', 'Nama', 'UTS (100 %)'], [1, 99000000502, 'Mahasiswa Uji 502', 70]];
	return workbookBuffer([
		{ name: 'Terlihat', sheet: writeSheet(visible) },
		{ name: 'Tersembunyi', sheet: writeSheet(hidden), hidden: true }
	]);
}

export function buildCorruptWorkbook(): Buffer {
	const header = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
	return Buffer.concat([header, Buffer.from('ini-bukan-isi-zip-yang-valid'.repeat(40))]);
}

export type FakeZipEntry = { name: string; compressed: number; uncompressed: number };

export function fakeZip(entries: FakeZipEntry[]): Buffer {
	const parts: Buffer[] = [Buffer.from([0x50, 0x4b, 0x03, 0x04])];
	let directorySize = 0;
	for (const entry of entries) {
		const name = Buffer.from(entry.name);
		const record = Buffer.alloc(46 + name.length);
		record.writeUInt32LE(0x02014b50, 0);
		record.writeUInt32LE(entry.compressed, 20);
		record.writeUInt32LE(entry.uncompressed, 24);
		record.writeUInt16LE(name.length, 28);
		name.copy(record, 46);
		parts.push(record);
		directorySize += record.length;
	}
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0);
	end.writeUInt16LE(entries.length, 8);
	end.writeUInt16LE(entries.length, 10);
	end.writeUInt32LE(directorySize, 12);
	end.writeUInt32LE(4, 16);
	parts.push(end);
	return Buffer.concat(parts);
}

export const buildZipBombLike = () => fakeZip([{ name: 'xl/worksheets/sheet1.xml', compressed: 1024, uncompressed: 3_000_000_000 }]);

export const buildHighRatioZip = () => fakeZip([{ name: 'xl/sharedStrings.xml', compressed: 2000, uncompressed: 5_000_000 }]);

export const buildMacroLikeWorkbook = () =>
	fakeZip([
		{ name: '[Content_Types].xml', compressed: 100, uncompressed: 200 },
		{ name: 'xl/workbook.xml', compressed: 100, uncompressed: 200 },
		{ name: 'xl/vbaProject.bin', compressed: 100, uncompressed: 200 }
	]);

export const buildPathTraversalZip = () => fakeZip([{ name: '../../etc/passwd', compressed: 10, uncompressed: 10 }]);

export const buildTooManyEntriesZip = (count: number) =>
	fakeZip(Array.from({ length: count }, (_, i) => ({ name: `xl/media/image${i}.png`, compressed: 10, uncompressed: 10 })));
