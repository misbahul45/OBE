import type { GridCell } from './imports.types.ts';

export type ScoreParse =
	| { kind: 'value'; value: number }
	| { kind: 'blank' }
	| { kind: 'invalid'; reason: 'SCORE_NOT_NUMERIC' | 'SCORE_DATE_FORMAT' | 'SCORE_FORMULA_ERROR' }
	| { kind: 'no_cache' };

const plainNumber = /^[+-]?(\d+([.,]\d+)?|[.,]\d+)$/;

export function parseDecimalText(text: string): number | null {
	const trimmed = text.replace(/[ ​]/g, '').trim();
	if (!plainNumber.test(trimmed)) return null;
	const value = Number(trimmed.replace(',', '.'));
	return Number.isFinite(value) ? value : null;
}

export function parseScoreCell(cell: GridCell | undefined | null): ScoreParse {
	if (!cell) return { kind: 'blank' };
	if (cell.formula !== null && !cell.cached) return { kind: 'no_cache' };
	if (cell.kind === 'error') return { kind: 'invalid', reason: 'SCORE_FORMULA_ERROR' };
	if (cell.kind === 'date') return { kind: 'invalid', reason: 'SCORE_DATE_FORMAT' };
	if (cell.kind === 'boolean') return { kind: 'invalid', reason: 'SCORE_NOT_NUMERIC' };
	if (cell.value === null) return { kind: 'blank' };
	if (cell.kind === 'number' && typeof cell.value === 'number') {
		return Number.isFinite(cell.value) ? { kind: 'value', value: cell.value } : { kind: 'invalid', reason: 'SCORE_NOT_NUMERIC' };
	}
	if (typeof cell.value === 'string') {
		if (cell.value.replace(/[ ​]/g, '').trim() === '') return { kind: 'blank' };
		const parsed = parseDecimalText(cell.value);
		return parsed === null ? { kind: 'invalid', reason: 'SCORE_NOT_NUMERIC' } : { kind: 'value', value: parsed };
	}
	return { kind: 'invalid', reason: 'SCORE_NOT_NUMERIC' };
}

export const roundScore = (value: number, digits = 4) => Math.round(value * 10 ** digits) / 10 ** digits;

export function isDateFormat(format: string | null | undefined): boolean {
	if (!format) return false;
	const stripped = format
		.replace(/"[^"]*"/g, '')
		.replace(/\\./g, '')
		.replace(/\[[^\]]*\]/g, '')
		.replace(/general/gi, '');
	return /[ymdhs]/i.test(stripped);
}
