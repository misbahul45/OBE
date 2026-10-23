import type { GridCell, SheetGrid } from '#lib/features/imports/imports.types.ts';

export const num = (value: number, format: string | null = null): GridCell => ({ kind: 'number', value, display: String(value), formula: null, cached: true, format });
export const str = (value: string): GridCell => ({ kind: 'string', value, display: value, formula: null, cached: true, format: null });
export const bool = (value: boolean): GridCell => ({ kind: 'boolean', value, display: String(value), formula: null, cached: true, format: null });
export const err = (display = '#DIV/0!'): GridCell => ({ kind: 'error', value: null, display, formula: null, cached: true, format: null });
export const date = (serial: number): GridCell => ({ kind: 'date', value: serial, display: String(serial), formula: null, cached: true, format: 'dd/mm/yyyy' });
export const formula = (source: string, cached: GridCell | null): GridCell =>
	cached
		? { ...cached, formula: source, cached: true }
		: { kind: 'number', value: null, display: '', formula: source, cached: false, format: null };

export type CellInput = GridCell | string | number | null | undefined;

function toCell(input: CellInput): GridCell | undefined {
	if (input === null || input === undefined) return undefined;
	if (typeof input === 'number') return num(input);
	if (typeof input === 'string') return str(input);
	return input;
}

export function gridOf(name: string, rows: CellInput[][]): SheetGrid {
	const converted = rows.map((row) => row.map(toCell));
	return {
		name,
		rowCount: converted.length,
		colCount: Math.max(0, ...converted.map((row) => row.length)),
		rows: converted,
		merges: []
	};
}
