export const maxSearchTokens = 6;

export function searchTokens(query: string | null | undefined): string[] {
	const tokens = (query ?? '')
		.toLowerCase()
		.split(/\s+/)
		.filter((token) => token !== '');
	return [...new Set(tokens)].slice(0, maxSearchTokens);
}

export type TextPart = { text: string; match: boolean };

export function highlightParts(text: string, tokens: string[]): TextPart[] {
	const lower = text.toLowerCase();
	if (tokens.length === 0 || text === '' || lower.length !== text.length) return [{ text, match: false }];
	const marked = Array.from({ length: text.length }, () => false);
	for (const token of tokens) {
		let at = lower.indexOf(token);
		while (at !== -1) {
			for (let i = at; i < at + token.length; i++) marked[i] = true;
			at = lower.indexOf(token, at + token.length);
		}
	}
	const parts: TextPart[] = [];
	for (let i = 0; i < text.length; i++) {
		const last = parts.at(-1);
		if (last && last.match === marked[i]) last.text += text[i];
		else parts.push({ text: text[i], match: marked[i] });
	}
	return parts;
}

export const studentSorts = ['nama', 'nim', 'angkatan', 'matkul'] as const;
export type StudentSort = (typeof studentSorts)[number];
export type SortDirection = 'naik' | 'turun';
export const studentPageSizes = [10, 20, 50, 100] as const;
export const defaultStudentPageSize = 20;

export const parseSort = (value: string | null | undefined): StudentSort | undefined => studentSorts.find((s) => s === value);
export const parseDirection = (value: string | null | undefined): SortDirection | undefined => (value === 'naik' || value === 'turun' ? value : undefined);
export const parsePageSize = (value: string | null | undefined): number => studentPageSizes.find((s) => String(s) === value) ?? defaultStudentPageSize;
