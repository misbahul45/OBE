import { makeIssue, type ImportIssue } from './imports.issues.ts';
import { cellAt, columnLetter, type SheetGrid, type SheetMapping } from './imports.types.ts';
import { normalizeNim } from './nim.ts';
import { parseScoreCell } from './numbers.ts';
import { classifyDataRows } from './sheet-analysis.ts';
import { sumWeights, weightsMatchTotal } from './weights.ts';

export type ValidationOptions = {
	weightTolerancePercent?: number;
	scaleMax?: number;
	knownCpmkCodes?: ReadonlySet<string> | null;
	knownCplCodes?: ReadonlySet<string> | null;
};

export type RowStatus = 'valid' | 'warning' | 'error';

export type ParsedRow = {
	row: number;
	nim: string | null;
	nimSource: 'string' | 'number' | null;
	name: string | null;
	scores: Record<string, number | null>;
	references: { cpmk: Record<string, number | null>; cpl: Record<string, number | null> };
	blankComponents: string[];
	issues: ImportIssue[];
	status: RowStatus;
};

export type SheetValidation = {
	sheet: string;
	rows: ParsedRow[];
	excludedRows: { row: number; reason: string }[];
	issues: ImportIssue[];
	summary: { total: number; valid: number; warning: number; error: number; blankCells: number; zeroCells: number; numericNimRows: number };
	weights: { total: number | null; complete: boolean; ok: boolean };
	usableReferences: { cpmk: string[]; cpl: string[] };
};

const defaultTolerance = 0.5;

function cleanName(value: unknown): string | null {
	if (typeof value !== 'string' && typeof value !== 'number') return null;
	const text = String(value).replace(/[ ​]/g, ' ').replace(/\s+/g, ' ').trim();
	return text === '' ? null : text;
}

export function validateSheet(grid: SheetGrid, mapping: SheetMapping, options: ValidationOptions = {}): SheetValidation {
	const sheet = grid.name;
	const tolerance = options.weightTolerancePercent ?? defaultTolerance;
	const scaleMax = options.scaleMax ?? 100;
	const sheetIssues: ImportIssue[] = [];
	const userExcluded = new Set(mapping.excludedRows);

	const codeSeen = new Set<string>();
	for (const component of mapping.components) {
		if (codeSeen.has(component.code)) sheetIssues.push(makeIssue('COMPONENT_CODE_DUPLICATE', { sheet, column: columnLetter(component.column) }, component.code));
		codeSeen.add(component.code);
	}
	if (mapping.components.length === 0) sheetIssues.push(makeIssue('NO_COMPONENT_COLUMNS', { sheet }));

	const weightValues = mapping.components.map((c) => c.weightPercent);
	const sum = sumWeights(weightValues);
	let weightsOk = true;
	if (mapping.components.length > 0 && sum.complete && !weightsMatchTotal(sum.total, tolerance)) {
		weightsOk = false;
		sheetIssues.push(makeIssue('WEIGHT_TOTAL_MISMATCH', { sheet }, `Jumlah bobot ${sum.total}%.`));
	}
	for (const component of mapping.components)
		if (component.weightPercent === null) {
			weightsOk = false;
			sheetIssues.push(makeIssue('WEIGHT_MISSING', { sheet, column: columnLetter(component.column) }, component.code));
		}

	const usableCpmk = mapping.cpmkColumns.filter((c) => !options.knownCpmkCodes || options.knownCpmkCodes.has(c.code));
	const usableCpl = mapping.cplColumns.filter((c) => !options.knownCplCodes || options.knownCplCodes.has(c.code));
	for (const column of mapping.cpmkColumns)
		if (!usableCpmk.includes(column)) sheetIssues.push(makeIssue('CPMK_UNKNOWN', { sheet, column: columnLetter(column.column) }, column.code));
	for (const column of mapping.cplColumns)
		if (!usableCpl.includes(column)) sheetIssues.push(makeIssue('CPL_UNKNOWN', { sheet, column: columnLetter(column.column) }, column.code));

	const classified = classifyDataRows(grid, mapping.nimColumn, mapping.nameColumn, mapping.firstDataRow - 1);
	const excludedRows: { row: number; reason: string }[] = [];
	const rows: ParsedRow[] = [];
	const nimFirstRow = new Map<string, number>();
	const duplicateRows = new Map<string, number[]>();

	for (const info of classified) {
		const rowNumber = info.row + 1;
		if (info.kind === 'empty') continue;
		if (info.kind === 'excluded') {
			excludedRows.push({ row: rowNumber, reason: info.reason ?? 'EXCLUDED' });
			continue;
		}
		if (userExcluded.has(rowNumber)) {
			excludedRows.push({ row: rowNumber, reason: 'USER_EXCLUDED' });
			continue;
		}

		const issues: ImportIssue[] = [];
		const at = (column: number, field: string | null) => ({ sheet, row: rowNumber, column: columnLetter(column), field });

		const nimResult = normalizeNim(cellAt(grid, info.row, mapping.nimColumn));
		let nim: string | null = null;
		let nimSource: 'string' | 'number' | null = null;
		if (nimResult.ok) {
			nim = nimResult.nim;
			nimSource = nimResult.source;
			const seen = nimFirstRow.get(nim);
			if (seen === undefined) nimFirstRow.set(nim, rowNumber);
			else duplicateRows.set(nim, [...(duplicateRows.get(nim) ?? [seen]), rowNumber]);
		} else issues.push(makeIssue(nimResult.reason, at(mapping.nimColumn, 'nim')));

		const name = mapping.nameColumn === null ? null : cleanName(cellAt(grid, info.row, mapping.nameColumn)?.value);
		if (name === null) issues.push(makeIssue('NAME_EMPTY', at(mapping.nameColumn ?? mapping.nimColumn, 'name')));

		const scores: Record<string, number | null> = {};
		const blankComponents: string[] = [];
		for (const component of mapping.components) {
			const parsed = parseScoreCell(cellAt(grid, info.row, component.column));
			const location = at(component.column, component.code);
			if (parsed.kind === 'blank') {
				scores[component.code] = null;
				blankComponents.push(component.code);
			} else if (parsed.kind === 'no_cache') {
				scores[component.code] = null;
				blankComponents.push(component.code);
				issues.push(makeIssue('SCORE_FORMULA_NO_CACHE', location));
			} else if (parsed.kind === 'invalid') {
				scores[component.code] = null;
				issues.push(makeIssue(parsed.reason, location));
			} else if (parsed.value < 0 || parsed.value > component.maxScore) {
				scores[component.code] = null;
				issues.push(makeIssue('SCORE_OUT_OF_RANGE', location, `Nilai ${parsed.value}; rentang 0-${component.maxScore}.`));
			} else scores[component.code] = parsed.value;
		}

		const references = { cpmk: {} as Record<string, number | null>, cpl: {} as Record<string, number | null> };
		const readReferences = (columns: { column: number; code: string }[], target: Record<string, number | null>) => {
			for (const reference of columns) {
				const parsed = parseScoreCell(cellAt(grid, info.row, reference.column));
				const location = at(reference.column, reference.code);
				if (parsed.kind === 'value' && parsed.value >= 0 && parsed.value <= scaleMax) target[reference.code] = parsed.value;
				else if (parsed.kind === 'value') {
					target[reference.code] = null;
					issues.push(makeIssue('REFERENCE_OUT_OF_RANGE', location, `Nilai ${parsed.value}.`));
				} else if (parsed.kind === 'invalid') {
					target[reference.code] = null;
					issues.push(makeIssue('REFERENCE_NOT_NUMERIC', location));
				} else target[reference.code] = null;
			}
		};
		readReferences(usableCpmk, references.cpmk);
		readReferences(usableCpl, references.cpl);

		rows.push({ row: rowNumber, nim, nimSource, name, scores, references, blankComponents, issues, status: 'valid' });
	}

	for (const [nim, rowNumbers] of duplicateRows)
		for (const parsed of rows.filter((r) => r.nim === nim))
			parsed.issues.push(makeIssue('NIM_DUPLICATE_IN_SHEET', { sheet, row: parsed.row, column: columnLetter(mapping.nimColumn), field: 'nim' }, `Baris ${rowNumbers.join(', ')}.`));

	let blankCells = 0;
	let zeroCells = 0;
	let numericNimRows = 0;
	for (const parsed of rows) {
		parsed.status = parsed.issues.some((i) => i.severity === 'error') ? 'error' : parsed.issues.some((i) => i.severity === 'warning') ? 'warning' : 'valid';
		blankCells += parsed.blankComponents.length;
		zeroCells += Object.values(parsed.scores).filter((v) => v === 0).length;
		if (parsed.nimSource === 'number') numericNimRows++;
	}
	if (rows.length === 0) sheetIssues.push(makeIssue('NO_STUDENT_ROWS', { sheet }));
	if (numericNimRows > 0) sheetIssues.push(makeIssue('NIM_NUMERIC_SOURCE', { sheet, column: columnLetter(mapping.nimColumn) }, `${numericNimRows} baris.`));

	return {
		sheet,
		rows,
		excludedRows,
		issues: sheetIssues,
		summary: {
			total: rows.length,
			valid: rows.filter((r) => r.status === 'valid').length,
			warning: rows.filter((r) => r.status === 'warning').length,
			error: rows.filter((r) => r.status === 'error').length,
			blankCells,
			zeroCells,
			numericNimRows
		},
		weights: { total: mapping.components.length && sum.complete ? sum.total : null, complete: sum.complete, ok: weightsOk },
		usableReferences: { cpmk: usableCpmk.map((c) => c.code), cpl: usableCpl.map((c) => c.code) }
	};
}

export const allIssues = (validation: SheetValidation): ImportIssue[] => [...validation.issues, ...validation.rows.flatMap((r) => r.issues)];
