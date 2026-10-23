import { parseDecimalText } from './numbers.ts';

export type WeightForm = 'percent_sign' | 'fraction' | 'percent_number';

export type WeightParse =
	| { ok: true; percent: number; form: WeightForm; ambiguous: boolean }
	| { ok: false; reason: 'EMPTY' | 'UNPARSEABLE' | 'OUT_OF_RANGE' };

export function parseWeight(raw: string | number | null | undefined): WeightParse {
	if (raw === null || raw === undefined) return { ok: false, reason: 'EMPTY' };
	if (typeof raw === 'string') {
		const text = raw.replace(/[ ​]/g, '').trim();
		if (text === '') return { ok: false, reason: 'EMPTY' };
		const percent = /^([+-]?[0-9]+(?:[.,][0-9]+)?)\s*%$/.exec(text);
		if (percent) {
			const value = parseDecimalText(percent[1]);
			if (value === null || value < 0 || value > 100) return { ok: false, reason: 'OUT_OF_RANGE' };
			return { ok: true, percent: value, form: 'percent_sign', ambiguous: false };
		}
		const numeric = parseDecimalText(text);
		return numeric === null ? { ok: false, reason: 'UNPARSEABLE' } : parseWeight(numeric);
	}
	if (!Number.isFinite(raw) || raw < 0) return { ok: false, reason: 'OUT_OF_RANGE' };
	if (raw > 100) return { ok: false, reason: 'OUT_OF_RANGE' };
	if (raw === 0) return { ok: true, percent: 0, form: 'fraction', ambiguous: false };
	if (raw <= 1) return { ok: true, percent: roundPercent(raw * 100), form: 'fraction', ambiguous: raw === 1 };
	return { ok: true, percent: raw, form: 'percent_number', ambiguous: false };
}

const roundPercent = (value: number) => Math.round(value * 10000) / 10000;

const headerWeight = /\(?\s*([0-9]+(?:[.,][0-9]+)?)\s*%\s*\)?/g;

export function extractHeaderWeight(header: string): { percent: number | null; withoutWeight: string } {
	const matches = [...header.matchAll(headerWeight)];
	const last = matches.at(-1);
	if (!last) return { percent: null, withoutWeight: header.trim() };
	const percent = parseDecimalText(last[1]);
	const withoutWeight = (header.slice(0, last.index) + header.slice(last.index! + last[0].length)).replace(/\s+/g, ' ').trim();
	return { percent: percent !== null && percent >= 0 && percent <= 100 ? percent : null, withoutWeight };
}

export function sumWeights(values: (number | null)[]): { total: number; complete: boolean } {
	let total = 0;
	let complete = true;
	for (const value of values) {
		if (value === null) complete = false;
		else total += value;
	}
	return { total: roundPercent(total), complete };
}

export const weightsMatchTotal = (total: number, tolerancePercent: number, target = 100) => Math.abs(total - target) <= tolerancePercent;
