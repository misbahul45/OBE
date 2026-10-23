import * as XLSX from 'xlsx';
import type { GridCell, MergeRange, SheetGrid } from './imports.types.ts';
import { isDateFormat } from './numbers.ts';
import { inspectZip, ZipInspectionError } from './zip-inspection.ts';

export const importLimits = {
	maxFileBytes: 10 * 1024 * 1024,
	maxSheets: 60,
	maxRowsPerSheet: 5000,
	maxColsPerSheet: 200,
	maxZipEntries: 500,
	maxUncompressedBytes: 120 * 1024 * 1024,
	maxCompressionRatio: 200
};

export type ImportLimits = typeof importLimits;

export type WorkbookErrorCode =
	| 'EMPTY_FILE'
	| 'FILE_TOO_LARGE'
	| 'UNSUPPORTED_TYPE'
	| 'CORRUPT_FILE'
	| 'ZIP_BOMB'
	| 'MACRO_NOT_SUPPORTED'
	| 'TOO_MANY_SHEETS'
	| 'SHEET_TOO_LARGE'
	| 'NO_VISIBLE_SHEETS';

export class WorkbookReadError extends Error {
	constructor(
		readonly code: WorkbookErrorCode,
		message: string
	) {
		super(message);
		this.name = 'WorkbookReadError';
	}
}

export type ReadWorkbook = {
	kind: 'xlsx' | 'csv';
	sheets: SheetGrid[];
	skipped: { name: string; reason: string }[];
};

const zipMagic = [0x50, 0x4b, 0x03, 0x04];
const oleMagic = [0xd0, 0xcf, 0x11, 0xe0];

const startsWith = (bytes: Uint8Array, magic: number[]) => magic.every((value, index) => bytes[index] === value);

export function fileExtension(fileName: string): string {
	const match = /\.([A-Za-z0-9]+)$/.exec(fileName.trim());
	return match ? `.${match[1].toLowerCase()}` : '';
}

function convertCell(cell: XLSX.CellObject): GridCell | null {
	const formula = typeof cell.f === 'string' && cell.f !== '' ? cell.f : null;
	const format = typeof cell.z === 'string' ? cell.z : null;
	const display = typeof cell.w === 'string' ? cell.w : cell.v !== undefined && cell.v !== null ? String(cell.v) : '';
	if (formula !== null && (cell.v === undefined || cell.t === 'z')) return { kind: 'number', value: null, display: '', formula, cached: false, format };
	switch (cell.t) {
		case 'n':
			if (typeof cell.v !== 'number') return null;
			return { kind: isDateFormat(format) ? 'date' : 'number', value: cell.v, display, formula, cached: true, format };
		case 's':
			return { kind: 'string', value: String(cell.v ?? ''), display, formula, cached: true, format };
		case 'b':
			return { kind: 'boolean', value: Boolean(cell.v), display, formula, cached: true, format };
		case 'e':
			return { kind: 'error', value: null, display: display || '#ERROR', formula, cached: true, format };
		case 'd':
			return { kind: 'date', value: cell.v instanceof Date ? cell.v.toISOString() : String(cell.v), display, formula, cached: true, format };
		default:
			return null;
	}
}

function toGrid(name: string, sheet: XLSX.WorkSheet, limits: ImportLimits): SheetGrid {
	const found: { row: number; col: number; cell: GridCell }[] = [];
	let maxRow = -1;
	let maxCol = -1;
	for (const key of Object.keys(sheet)) {
		if (key.startsWith('!')) continue;
		const converted = convertCell(sheet[key] as XLSX.CellObject);
		if (!converted) continue;
		const address = XLSX.utils.decode_cell(key);
		found.push({ row: address.r, col: address.c, cell: converted });
		if (address.r > maxRow) maxRow = address.r;
		if (address.c > maxCol) maxCol = address.c;
	}
	if (maxRow + 1 > limits.maxRowsPerSheet || maxCol + 1 > limits.maxColsPerSheet)
		throw new WorkbookReadError('SHEET_TOO_LARGE', `Sheet "${name}" melebihi batas ${limits.maxRowsPerSheet} baris atau ${limits.maxColsPerSheet} kolom`);
	const rows: (GridCell | undefined)[][] = Array.from({ length: maxRow + 1 }, () => []);
	for (const { row, col, cell } of found) rows[row][col] = cell;
	const merges: MergeRange[] = (sheet['!merges'] ?? []).map((range) => ({ startRow: range.s.r, startCol: range.s.c, endRow: range.e.r, endCol: range.e.c }));
	return { name, rowCount: maxRow + 1, colCount: maxCol + 1, rows, merges };
}

function detectDelimiter(text: string): string {
	const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
	const counts: [string, number][] = [
		[',', firstLine.split(',').length],
		[';', firstLine.split(';').length],
		['\t', firstLine.split('\t').length]
	];
	return counts.sort((a, b) => b[1] - a[1])[0][0];
}

function readSpreadsheetBytes(bytes: Uint8Array, limits: ImportLimits): XLSX.WorkBook {
	if (!startsWith(bytes, zipMagic)) throw new WorkbookReadError('CORRUPT_FILE', 'Isi berkas bukan workbook .xlsx yang valid');
	try {
		const inspection = inspectZip(bytes, { maxEntries: limits.maxZipEntries, maxUncompressedBytes: limits.maxUncompressedBytes, maxCompressionRatio: limits.maxCompressionRatio });
		if (inspection.names.some((entry) => /vbaproject\.bin$/i.test(entry))) throw new WorkbookReadError('MACRO_NOT_SUPPORTED', 'Workbook berisi makro; simpan sebagai .xlsx tanpa makro');
	} catch (error) {
		if (error instanceof WorkbookReadError) throw error;
		if (error instanceof ZipInspectionError) {
			const code = error.problem === 'CORRUPT' || error.problem === 'ZIP64_UNSUPPORTED' ? 'CORRUPT_FILE' : 'ZIP_BOMB';
			throw new WorkbookReadError(code, code === 'ZIP_BOMB' ? 'Berkas ditolak karena ukuran dekompresi atau struktur arsip tidak aman' : 'Berkas rusak atau bukan workbook .xlsx yang valid');
		}
		throw error;
	}
	try {
		return XLSX.read(bytes, { type: 'array', cellFormula: true, cellNF: true, cellDates: false, cellStyles: false, bookVBA: false });
	} catch {
		throw new WorkbookReadError('CORRUPT_FILE', 'Berkas rusak dan tidak dapat dibaca');
	}
}

function readCsvBytes(bytes: Uint8Array): XLSX.WorkBook {
	if (bytes.subarray(0, 4096).includes(0)) throw new WorkbookReadError('CORRUPT_FILE', 'Berkas CSV mengandung data biner');
	const text = new TextDecoder('utf-8').decode(bytes).replace(/^﻿/, '');
	try {
		return XLSX.read(text, { type: 'string', raw: true, FS: detectDelimiter(text) });
	} catch {
		throw new WorkbookReadError('CORRUPT_FILE', 'Berkas CSV tidak dapat dibaca');
	}
}

export function readWorkbook(bytes: Uint8Array, fileName: string, limits: ImportLimits = importLimits): ReadWorkbook {
	if (bytes.byteLength === 0) throw new WorkbookReadError('EMPTY_FILE', 'Berkas kosong');
	if (bytes.byteLength > limits.maxFileBytes) throw new WorkbookReadError('FILE_TOO_LARGE', `Ukuran berkas melebihi ${Math.round(limits.maxFileBytes / 1024 / 1024)} MB`);
	const extension = fileExtension(fileName);
	if (extension === '.xls' || startsWith(bytes, oleMagic)) throw new WorkbookReadError('UNSUPPORTED_TYPE', 'Format .xls tidak didukung; simpan ulang sebagai .xlsx');
	if (extension !== '.xlsx' && extension !== '.csv') throw new WorkbookReadError('UNSUPPORTED_TYPE', 'Hanya berkas .xlsx dan .csv yang diterima');

	const workbook = extension === '.xlsx' ? readSpreadsheetBytes(bytes, limits) : readCsvBytes(bytes);
	if (workbook.SheetNames.length > limits.maxSheets) throw new WorkbookReadError('TOO_MANY_SHEETS', `Workbook memuat ${workbook.SheetNames.length} sheet (maksimal ${limits.maxSheets})`);

	const sheets: SheetGrid[] = [];
	const skipped: { name: string; reason: string }[] = [];
	workbook.SheetNames.forEach((name, index) => {
		const hidden = workbook.Workbook?.Sheets?.[index]?.Hidden;
		if (hidden) {
			skipped.push({ name, reason: 'Sheet tersembunyi' });
			return;
		}
		const sheet = workbook.Sheets[name];
		if (!sheet) return;
		const grid = toGrid(name === 'Sheet1' && extension === '.csv' ? 'CSV' : name, sheet, limits);
		if (grid.rowCount === 0) {
			skipped.push({ name, reason: 'Sheet kosong' });
			return;
		}
		sheets.push(grid);
	});
	if (sheets.length === 0) throw new WorkbookReadError('NO_VISIBLE_SHEETS', 'Tidak ada sheet berisi data yang dapat dibaca');
	return { kind: extension === '.xlsx' ? 'xlsx' : 'csv', sheets, skipped };
}
