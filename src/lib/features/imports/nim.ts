import type { GridCell } from './imports.types.ts';

export type NimResult =
	| { ok: true; nim: string; source: 'string' | 'number' }
	| { ok: false; reason: 'NIM_EMPTY' | 'NIM_INVALID_FORMAT' | 'NIM_SCIENTIFIC_AMBIGUOUS' };

const nimPattern = /^[0-9]{6,15}$/;
const invisible = /[ ​-‍﻿]/g;
const scientific = /^([0-9]+)(?:\.([0-9]+))?[eE]\+?([0-9]+)$/;

export const isValidNim = (value: string) => nimPattern.test(value);

function fromScientific(text: string): NimResult {
	const match = scientific.exec(text);
	if (!match) return { ok: false, reason: 'NIM_INVALID_FORMAT' };
	const [, whole, fraction = '', exponentText] = match;
	const scale = Number(exponentText) - fraction.length;
	if (scale < 0) return { ok: false, reason: 'NIM_INVALID_FORMAT' };
	if (scale > 0) return { ok: false, reason: 'NIM_SCIENTIFIC_AMBIGUOUS' };
	const digits = whole + fraction;
	return nimPattern.test(digits) ? { ok: true, nim: digits, source: 'string' } : { ok: false, reason: 'NIM_INVALID_FORMAT' };
}

export function normalizeNimText(raw: string): NimResult {
	let text = raw.replace(invisible, '').trim();
	if (text.startsWith("'")) text = text.slice(1).trim();
	if (text === '') return { ok: false, reason: 'NIM_EMPTY' };
	if (scientific.test(text)) return fromScientific(text);
	if (/^[0-9]+\.0+$/.test(text)) text = text.replace(/\.0+$/, '');
	return nimPattern.test(text) ? { ok: true, nim: text, source: 'string' } : { ok: false, reason: 'NIM_INVALID_FORMAT' };
}

export function normalizeNimNumber(value: number): NimResult {
	if (!Number.isFinite(value) || value < 0) return { ok: false, reason: 'NIM_INVALID_FORMAT' };
	if (!Number.isInteger(value) || !Number.isSafeInteger(value)) return { ok: false, reason: 'NIM_INVALID_FORMAT' };
	const digits = value.toFixed(0);
	return nimPattern.test(digits) ? { ok: true, nim: digits, source: 'number' } : { ok: false, reason: 'NIM_INVALID_FORMAT' };
}

export function normalizeNim(cell: GridCell | undefined | null): NimResult {
	if (!cell || cell.value === null || cell.value === '') return { ok: false, reason: 'NIM_EMPTY' };
	if (cell.kind === 'number' && typeof cell.value === 'number') return normalizeNimNumber(cell.value);
	if (cell.kind === 'string' && typeof cell.value === 'string') return normalizeNimText(cell.value);
	return { ok: false, reason: 'NIM_INVALID_FORMAT' };
}
