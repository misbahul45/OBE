import { hashText } from '#lib/shared/format/hash.ts';
import { baseCodeFor, isNameHeader, isNimHeader, isNumberHeader, normalizeHeader, parseComponentHeader, parseOutcomeHeader } from './header.ts';
import { makeIssue, type ImportIssue } from './imports.issues.ts';
import {
	cellAt,
	columnLetter,
	type ColumnInfo,
	type ColumnRole,
	type GridCell,
	type MetadataKind,
	type MetadataRegion,
	type RowClassification,
	type SheetAnalysis,
	type SheetGrid,
	type SheetMapping
} from './imports.types.ts';
import { normalizeNim } from './nim.ts';
import { hintOfferingFromSheetName } from './offering-hint.ts';
import { sumWeights } from './weights.ts';

export type AnalyzeOptions = { headerRow?: number };

const maxHeaderSearchRows = 40;
const maxHeaderSearchCols = 40;
const minOutcomeFill = 0.3;
const minDenseFill = 0.5;
const ghostWindow = 2;
const summaryLabel = /^(total|jumlah|rata[- ]?rata|rerata|mean|average|min|max|maks|minimum|maksimum|keterangan|catatan|threshold|simpan|median|std)/i;

function blank(cell: GridCell | undefined): boolean {
	if (!cell || cell.value === null) return !cell || cell.formula === null;
	return typeof cell.value === 'string' && cell.value.replace(/[ ​]/g, '').trim() === '';
}

function textOf(cell: GridCell | undefined): string {
	if (!cell || cell.value === null) return '';
	if (typeof cell.value === 'string') return cell.value;
	return String(cell.value);
}

function resolveCell(grid: SheetGrid, row: number, col: number): GridCell | undefined {
	const direct = cellAt(grid, row, col);
	if (direct) return direct;
	for (const merge of grid.merges)
		if (row >= merge.startRow && row <= merge.endRow && col >= merge.startCol && col <= merge.endCol) return cellAt(grid, merge.startRow, merge.startCol);
	return undefined;
}

type HeaderLocation = { row: number; nimCol: number; nameCol: number | null };

function findHeader(grid: SheetGrid, forcedRow?: number): HeaderLocation | null {
	const rows = forcedRow ? [forcedRow - 1] : Array.from({ length: Math.min(grid.rowCount, maxHeaderSearchRows) }, (_, i) => i);
	for (const row of rows) {
		let nimCol = -1;
		const limit = Math.min(grid.colCount, maxHeaderSearchCols);
		for (let col = 0; col < limit; col++) {
			if (isNimHeader(textOf(resolveCell(grid, row, col)))) {
				nimCol = col;
				break;
			}
		}
		if (nimCol < 0) continue;
		let nameCol: number | null = null;
		for (let col = 0; col < limit; col++)
			if (col !== nimCol && isNameHeader(textOf(resolveCell(grid, row, col)))) {
				nameCol = col;
				break;
			}
		return { row, nimCol, nameCol };
	}
	return null;
}

function headerSpanOf(grid: SheetGrid, header: HeaderLocation): number {
	let span = 1;
	for (let k = 1; k <= 2; k++) {
		const row = header.row + k;
		if (row >= grid.rowCount) break;
		if (normalizeNim(cellAt(grid, row, header.nimCol)).ok) break;
		if (!blank(cellAt(grid, row, header.nimCol)) && typeof cellAt(grid, row, header.nimCol)?.value === 'number') break;
		let strings = 0;
		let numbers = 0;
		for (let col = header.nimCol + 1; col < Math.min(grid.colCount, header.nimCol + 30); col++) {
			const cell = cellAt(grid, row, col);
			if (!cell || blank(cell)) continue;
			if (cell.kind === 'string') strings++;
			else if (cell.kind === 'number') numbers++;
		}
		if (strings >= 2 && numbers === 0) span++;
		else break;
	}
	return span;
}

function headerTextAt(grid: SheetGrid, header: HeaderLocation, span: number, col: number): string {
	const parts: string[] = [];
	for (let k = 0; k < span; k++) {
		const text = normalizeHeader(textOf(resolveCell(grid, header.row + k, col)));
		if (text && !parts.includes(text)) parts.push(text);
	}
	return parts.join(' # ');
}

function rowHasNumbers(grid: SheetGrid, row: number, fromCol: number, toCol: number): boolean {
	for (let col = fromCol; col <= Math.min(toCol, grid.colCount - 1); col++) {
		const cell = cellAt(grid, row, col);
		if (cell && cell.kind === 'number' && cell.value !== null) return true;
	}
	return false;
}

function classifyRows(grid: SheetGrid, header: HeaderLocation, dataStart: number): RowClassification[] {
	const out: RowClassification[] = [];
	for (let row = dataStart; row < grid.rowCount; row++) {
		const nimCell = cellAt(grid, row, header.nimCol);
		const nameCell = header.nameCol === null ? undefined : cellAt(grid, row, header.nameCol);
		const nimBlank = blank(nimCell);
		const nameBlank = blank(nameCell);
		const lead = [0, header.nimCol, header.nameCol ?? header.nimCol].map((col) => textOf(cellAt(grid, row, col)).trim()).find((t) => t !== '') ?? '';
		if (lead !== '' && summaryLabel.test(lead) && normalizeNim(nimCell).ok === false) {
			out.push({ row, kind: 'excluded', reason: 'SUMMARY_ROW' });
			continue;
		}
		if (nimBlank && nameBlank) {
			out.push({ row, kind: 'empty' });
			continue;
		}
		if (normalizeNim(nimCell).ok) {
			out.push({ row, kind: 'student' });
			continue;
		}
		if (!nameBlank || rowHasNumbers(grid, row, header.nimCol + 1, header.nimCol + 25)) {
			out.push({ row, kind: 'student' });
			continue;
		}
		out.push({ row, kind: 'excluded', reason: 'NON_STUDENT_TEXT' });
	}
	return out;
}

type ColumnDraft = {
	index: number;
	header: string;
	nonBlank: number;
	fill: number;
};

function draftColumns(grid: SheetGrid, header: HeaderLocation, span: number, referenceRows: number[]): ColumnDraft[] {
	const drafts: ColumnDraft[] = [];
	for (let col = 0; col < grid.colCount; col++) {
		let nonBlank = 0;
		for (const row of referenceRows) if (!blank(cellAt(grid, row, col))) nonBlank++;
		drafts.push({ index: col, header: headerTextAt(grid, header, span, col), nonBlank, fill: referenceRows.length ? nonBlank / referenceRows.length : 0 });
	}
	return drafts;
}

function findMainBlockEnd(drafts: ColumnDraft[], identityEnd: number): number | null {
	let lastOutcome = -1;
	for (const draft of drafts) {
		if (draft.index <= identityEnd) continue;
		if (parseOutcomeHeader(draft.header) && draft.fill >= minOutcomeFill) lastOutcome = draft.index;
	}
	if (lastOutcome >= 0) return lastOutcome;
	let last = -1;
	let gap = 0;
	for (const draft of drafts) {
		if (draft.index <= identityEnd) continue;
		const qualifies = draft.header !== '' || draft.fill >= minDenseFill;
		if (qualifies) {
			if (draft.header !== '' || draft.fill >= minDenseFill) last = draft.index;
			gap = 0;
		} else {
			gap++;
			if (gap > ghostWindow) break;
		}
	}
	return last >= 0 ? last : null;
}

function uniqueName(name: string, seen: Map<string, number>): string {
	const count = (seen.get(name) ?? 0) + 1;
	seen.set(name, count);
	return count === 1 ? name : `${name} ${count}`;
}

function detectMetadata(grid: SheetGrid, fromCol: number): MetadataRegion[] {
	if (fromCol >= grid.colCount) return [];
	const activeCols = new Set<number>();
	for (let row = 0; row < grid.rowCount; row++)
		for (let col = fromCol; col < grid.colCount; col++) if (!blank(cellAt(grid, row, col))) activeCols.add(col);
	const sorted = [...activeCols].sort((a, b) => a - b);
	const groups: number[][] = [];
	for (const col of sorted) {
		const current = groups.at(-1);
		if (current && col - current.at(-1)! <= 1) current.push(col);
		else groups.push([col]);
	}
	return groups.map((cols) => {
		const startCol = cols[0];
		const endCol = cols.at(-1)!;
		let startRow = Infinity;
		let endRow = -1;
		const labels: string[] = [];
		const allText: string[] = [];
		for (let row = 0; row < grid.rowCount; row++)
			for (let col = startCol; col <= endCol; col++) {
				const cell = cellAt(grid, row, col);
				if (blank(cell)) continue;
				startRow = Math.min(startRow, row);
				endRow = Math.max(endRow, row);
				if (cell!.kind !== 'string') continue;
				const label = normalizeHeader(textOf(cell)).slice(0, 60);
				if (!label) continue;
				allText.push(label.toLowerCase());
				if (labels.length < 10 && !labels.includes(label)) labels.push(label);
			}
		const joined = allText.join(' | ');
		const kinds: MetadataKind[] = [];
		if (/cpl\s*\\\s*cpmk/.test(joined)) kinds.push('cpl_cpmk_matrix');
		if (/threshold/.test(joined)) kinds.push('threshold');
		if (/jumlah mahasiswa|total mahasiswa|capaian/.test(joined)) kinds.push('achievement_summary');
		if (/^cpmk\b/.test(labels[0]?.toLowerCase() ?? '') || /\| cpmk-?\d/.test(joined)) kinds.push('cpmk_component_matrix');
		if (kinds.length === 0) kinds.push('unknown');
		return {
			kinds,
			startRow: startRow + 1,
			endRow: endRow + 1,
			startCol,
			endCol,
			range: `${columnLetter(startCol)}${startRow + 1}:${columnLetter(endCol)}${endRow + 1}`,
			labels
		};
	});
}

export function analyzeSheet(grid: SheetGrid, options: AnalyzeOptions = {}): SheetAnalysis {
	const offeringHint = hintOfferingFromSheetName(grid.name);
	const empty = (issues: ImportIssue[]): SheetAnalysis => ({
		sheetName: grid.name,
		headerRow: null,
		headerSpan: 1,
		nimColumn: null,
		nameColumn: null,
		firstDataRow: null,
		rows: [],
		studentRowCount: 0,
		columns: [],
		mainBlockEnd: null,
		metadataRegions: [],
		weightsTotalPercent: null,
		offeringHint,
		fingerprint: hashText(`${grid.name}:no-header`),
		issues
	});

	const header = findHeader(grid, options.headerRow);
	if (!header) return empty([makeIssue('HEADER_NOT_FOUND', { sheet: grid.name })]);

	const issues: ImportIssue[] = [];
	if (header.nameCol === null) issues.push(makeIssue('NAME_COLUMN_NOT_FOUND', { sheet: grid.name }));
	const span = headerSpanOf(grid, header);
	const dataStart = header.row + span;
	const rows = classifyRows(grid, header, dataStart);
	const studentRows = rows.filter((r) => r.kind === 'student').map((r) => r.row);
	const validNimRows = studentRows.filter((row) => normalizeNim(cellAt(grid, row, header.nimCol)).ok);
	const referenceRows = validNimRows.length ? validNimRows : studentRows;
	if (studentRows.length === 0) issues.push(makeIssue('NO_STUDENT_ROWS', { sheet: grid.name }));

	const identityEnd = Math.max(header.nimCol, header.nameCol ?? header.nimCol);
	const drafts = draftColumns(grid, header, span, referenceRows);
	const mainBlockEnd = findMainBlockEnd(drafts, identityEnd);

	const columns: ColumnInfo[] = [];
	const codeCounters = new Map<string, number>();
	const nameCounters = new Map<string, number>();
	const classifiedRows = new Map(rows.map((r) => [r.row, r]));

	for (const draft of drafts) {
		const letter = columnLetter(draft.index);
		const base = { index: draft.index, letter, header: draft.header, fill: Number(draft.fill.toFixed(3)), ghost: false };
		const put = (role: ColumnRole, confidence: ColumnInfo['confidence'], reason: string, extra: Partial<ColumnInfo> = {}) =>
			columns.push({ ...base, role, confidence, reason, ...extra });

		if (draft.index === header.nimCol) {
			put('nim', 'high', 'Header dikenali sebagai NIM');
			continue;
		}
		if (draft.index === header.nameCol) {
			put('name', 'high', 'Header dikenali sebagai nama');
			continue;
		}
		if (draft.index < identityEnd && isNumberHeader(draft.header)) {
			put('no', 'high', 'Kolom nomor urut');
			continue;
		}
		const insideMain = mainBlockEnd !== null && draft.index > identityEnd && draft.index <= mainBlockEnd;
		const outcome = parseOutcomeHeader(draft.header);
		if (outcome && (insideMain || draft.fill >= minOutcomeFill)) {
			put(outcome.kind, draft.fill >= minOutcomeFill ? 'high' : 'medium', `Header ${outcome.code} dengan data ${Math.round(draft.fill * 100)}%`, { outcomeCode: outcome.code });
			continue;
		}
		if (insideMain && draft.header !== '' && !outcome) {
			const parsed = parseComponentHeader(draft.header);
			const baseCode = baseCodeFor(parsed);
			const ordinal = (codeCounters.get(baseCode) ?? 0) + 1;
			codeCounters.set(baseCode, ordinal);
			const hasWeight = parsed.weightPercent !== null;
			const confidence = hasWeight ? (draft.fill >= minDenseFill ? 'high' : 'medium') : draft.fill > 0 ? 'medium' : 'low';
			const reason = hasWeight ? (draft.fill > 0 ? 'Header memuat bobot persen dan nilai terisi' : 'Header memuat bobot persen; nilai belum terisi') : 'Kolom di blok nilai tanpa bobot pada header';
			put('component', confidence, reason, {
				component: { code: `${baseCode}-${ordinal}`, name: uniqueName(parsed.name, nameCounters), type: parsed.type, weightPercent: parsed.weightPercent, maxScore: 100 }
			});
			continue;
		}
		const nearMain = mainBlockEnd !== null && draft.index > identityEnd && draft.index <= mainBlockEnd + ghostWindow;
		if (draft.header === '' && draft.nonBlank > 0 && nearMain && draft.fill >= minOutcomeFill) {
			put('ignored', 'medium', `Kolom tanpa header berisi data (${draft.nonBlank} sel)`, { ghost: true });
			issues.push(makeIssue('UNLABELED_COLUMN_WITH_DATA', { sheet: grid.name, column: letter }, `Kolom ${letter} berisi ${draft.nonBlank} sel.`));
			continue;
		}
		if (draft.header !== '' || draft.nonBlank > 0) put('metadata', 'medium', 'Di luar blok nilai mahasiswa');
		else put('ignored', 'high', 'Kolom kosong');
	}

	const components = columns.filter((c) => c.role === 'component' && c.component);
	if (components.length === 0) issues.push(makeIssue('NO_COMPONENT_COLUMNS', { sheet: grid.name }));
	for (const column of components)
		if (column.component!.weightPercent === null) issues.push(makeIssue('WEIGHT_MISSING', { sheet: grid.name, column: column.letter }));
	const weights = sumWeights(components.map((c) => c.component!.weightPercent));
	const weightsTotalPercent = components.length && weights.complete ? weights.total : null;

	const componentIndexes = components.map((c) => c.index);
	const hasRawInput = (row: number) =>
		componentIndexes.some((col) => {
			const cell = cellAt(grid, row, col);
			return !!cell && cell.formula === null && cell.kind === 'number' && cell.value !== null;
		});
	const lastStudentRow = studentRows.length ? Math.max(...studentRows) : -1;
	for (const info of rows) {
		if (info.kind !== 'empty' || !hasRawInput(info.row)) continue;
		if (info.row > lastStudentRow) {
			classifiedRows.set(info.row, { row: info.row, kind: 'excluded', reason: 'FOOTER_ROW' });
			continue;
		}
		classifiedRows.set(info.row, { row: info.row, kind: 'excluded', reason: 'ROW_WITHOUT_IDENTITY' });
		issues.push(makeIssue('ROW_WITHOUT_IDENTITY', { sheet: grid.name, row: info.row + 1 }));
	}

	const metadataRegions = mainBlockEnd === null ? [] : detectMetadata(grid, mainBlockEnd + 1);
	if (metadataRegions.length) issues.push(makeIssue('METADATA_IGNORED', { sheet: grid.name }, metadataRegions.map((r) => r.range).join(', ')));

	const finalRows = [...classifiedRows.values()].sort((a, b) => a.row - b.row);
	const fingerprintParts = columns
		.filter((c) => c.role !== 'ignored' && c.role !== 'metadata')
		.map((c) => `${c.index - identityEnd}:${c.role}:${c.outcomeCode ?? c.component?.name ?? ''}:${c.component?.weightPercent ?? ''}`);

	return {
		sheetName: grid.name,
		headerRow: header.row + 1,
		headerSpan: span,
		nimColumn: header.nimCol,
		nameColumn: header.nameCol,
		firstDataRow: dataStart + 1,
		rows: finalRows.map((r) => ({ ...r, row: r.row + 1 })),
		studentRowCount: finalRows.filter((r) => r.kind === 'student').length,
		columns,
		mainBlockEnd,
		metadataRegions,
		weightsTotalPercent,
		offeringHint,
		fingerprint: hashText(fingerprintParts.join('|')),
		issues
	};
}

export function suggestMapping(analysis: SheetAnalysis): SheetMapping | null {
	if (analysis.headerRow === null || analysis.nimColumn === null || analysis.firstDataRow === null) return null;
	const usable = (c: ColumnInfo) => c.confidence !== 'low';
	return {
		headerRow: analysis.headerRow,
		nimColumn: analysis.nimColumn,
		nameColumn: analysis.nameColumn,
		firstDataRow: analysis.firstDataRow,
		components: analysis.columns
			.filter((c) => c.role === 'component' && c.component && usable(c))
			.map((c) => ({ column: c.index, ...c.component! })),
		cpmkColumns: analysis.columns.filter((c) => c.role === 'cpmk' && c.outcomeCode).map((c) => ({ column: c.index, code: c.outcomeCode! })),
		cplColumns: analysis.columns.filter((c) => c.role === 'cpl' && c.outcomeCode).map((c) => ({ column: c.index, code: c.outcomeCode! })),
		excludedRows: analysis.rows.filter((r) => r.kind === 'excluded').map((r) => r.row)
	};
}

export const classifyDataRows = (grid: SheetGrid, nimCol: number, nameCol: number | null, dataStart: number): RowClassification[] =>
	classifyRows(grid, { row: dataStart - 1, nimCol, nameCol }, dataStart);
