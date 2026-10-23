import * as XLSX from 'xlsx';

export type CellSpec =
	| string
	| number
	| boolean
	| null
	| undefined
	| { v?: string | number | boolean; f?: string; t?: 'n' | 's' | 'b' | 'e'; z?: string; w?: string };

function toCell(spec: Exclude<CellSpec, null | undefined>): XLSX.CellObject {
	if (typeof spec === 'number') return { t: 'n', v: spec };
	if (typeof spec === 'string') return { t: 's', v: spec };
	if (typeof spec === 'boolean') return { t: 'b', v: spec };
	const type = spec.t ?? (typeof spec.v === 'string' ? 's' : typeof spec.v === 'boolean' ? 'b' : 'n');
	const cell: XLSX.CellObject = { t: type };
	if (spec.v !== undefined) cell.v = spec.v;
	if (spec.f !== undefined) cell.f = spec.f;
	if (spec.z !== undefined) cell.z = spec.z;
	if (spec.w !== undefined) cell.w = spec.w;
	return cell;
}

export function place(rows: CellSpec[][], row: number, col: number, block: CellSpec[][]): void {
	block.forEach((line, dr) => {
		rows[row + dr] ??= [];
		line.forEach((spec, dc) => {
			if (spec !== undefined) rows[row + dr][col + dc] = spec;
		});
	});
}

export function writeSheet(rows: CellSpec[][], options: { merges?: string[]; inflateRefTo?: string } = {}): XLSX.WorkSheet {
	const sheet: XLSX.WorkSheet = {};
	let maxRow = 0;
	let maxCol = 0;
	rows.forEach((row, r) =>
		row?.forEach((spec, c) => {
			if (spec === null || spec === undefined) return;
			sheet[XLSX.utils.encode_cell({ r, c })] = toCell(spec);
			maxRow = Math.max(maxRow, r);
			maxCol = Math.max(maxCol, c);
		})
	);
	sheet['!ref'] = options.inflateRefTo ?? XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxRow, c: maxCol } });
	if (options.merges) sheet['!merges'] = options.merges.map((range) => XLSX.utils.decode_range(range));
	return sheet;
}

export function workbookBuffer(sheets: { name: string; sheet: XLSX.WorkSheet; hidden?: boolean }[]): Buffer {
	const workbook = XLSX.utils.book_new();
	for (const { name, sheet } of sheets) XLSX.utils.book_append_sheet(workbook, sheet, name);
	workbook.Workbook = { Sheets: sheets.map((entry) => ({ name: entry.name, Hidden: entry.hidden ? 1 : 0 })) };
	return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
