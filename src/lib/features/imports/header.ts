import type { ComponentType } from './imports.types.ts';
import { extractHeaderWeight } from './weights.ts';

const brokenWords: [RegExp, string][] = [
	[/midter\s+m/gi, 'Midterm'],
	[/finalter\s+m/gi, 'Finalterm'],
	[/kom\s+ponen/gi, 'Komponen'],
	[/komp\s+onen/gi, 'Komponen'],
	[/proble\s+m/gi, 'Problem'],
	[/proje\s+ct/gi, 'Project']
];

export function normalizeHeader(raw: string): string {
	const lines = raw.replace(/\r/g, '').split('\n');
	let joined = lines[0] ?? '';
	for (let i = 1; i < lines.length; i++) {
		const next = lines[i];
		const continuesWord = /[A-Za-z]$/.test(joined) && /^ [a-z]/.test(next);
		joined += continuesWord ? next.slice(1) : ` ${next}`;
	}
	let text = joined.replace(/[ ​]/g, ' ').replace(/\s+/g, ' ').trim();
	for (const [pattern, replacement] of brokenWords) text = text.replace(pattern, replacement);
	return text;
}

export function matchKey(text: string): string {
	return normalizeHeader(text)
		.toLowerCase()
		.replace(/[^a-z0-9 ]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

const nimKeys = /^(nim|n i m|npm|n p m|nomor induk( mahasiswa)?|no induk|student id|id mahasiswa)$/;
const nameKeys = /^(na+ma|nama lengkap|nama mahasiswa|name|student name|mahasiswa)$/;
const numberKeys = /^(no|nomor|number|urut|no urut)$/;

export const isNimHeader = (text: string) => nimKeys.test(matchKey(text));
export const isNameHeader = (text: string) => nameKeys.test(matchKey(text));
export const isNumberHeader = (text: string) => numberKeys.test(matchKey(text));

export type OutcomeHeader = { kind: 'cpmk' | 'cpl'; code: string };

export function parseOutcomeHeader(text: string): OutcomeHeader | null {
	const match = /^(cpmk|cpl)\s*[-_. ]?\s*0*([0-9]+)$/i.exec(normalizeHeader(text));
	if (!match) return null;
	return { kind: match[1].toLowerCase() as 'cpmk' | 'cpl', code: `${match[1].toUpperCase()}-${Number(match[2])}` };
}

export type ComponentHeader = {
	phase: 'UTS' | 'UAS' | null;
	label: string;
	name: string;
	type: ComponentType;
	weightPercent: number | null;
};

const typeRules: [RegExp, ComponentType][] = [
	[/\b(praktikum|laporan praktikum|lab)\b/i, 'praktikum'],
	[/\b(kehadiran|presensi|absensi|absen)\b/i, 'kehadiran'],
	[/\b(soft ?skill)\b/i, 'softskill'],
	[/\b(kuis|quiz)\b/i, 'kuis'],
	[/\b(project|proyek|pjbl|poster|roadmap|case|problem)\b/i, 'proyek'],
	[/\b(tugas|task|assignment|pr)\b/i, 'tugas'],
	[/\b(uts|midterm)\b/i, 'uts'],
	[/\b(uas|finalterm|final)\b/i, 'uas']
];

export function inferComponentType(text: string): ComponentType {
	for (const [pattern, type] of typeRules) if (pattern.test(text)) return type;
	return 'lainnya';
}

export function parseComponentHeader(raw: string): ComponentHeader {
	const normalized = normalizeHeader(raw);
	const { percent, withoutWeight } = extractHeaderWeight(normalized);
	const segments = withoutWeight
		.split('#')
		.map((segment) => segment.replace(/\s+/g, ' ').trim())
		.filter(Boolean);
	const phaseMatch = segments.length > 0 ? /^(UTS|UAS)\b/i.exec(segments[0]) : null;
	const phase = phaseMatch ? (phaseMatch[1].toUpperCase() as 'UTS' | 'UAS') : null;
	const detail = (phase ? segments.slice(1) : segments).filter((segment) => !/^komponen lain$/i.test(segment));
	const label = detail.join(' - ');
	const name = label || (segments[0] ?? normalized) || 'Komponen';
	const type = inferComponentType(label || segments.join(' ') || normalized);
	return { phase, label, name: phase && label ? `${phase} - ${label}` : name, type: label ? type : (phase ? (phase.toLowerCase() as ComponentType) : type), weightPercent: percent };
}

export function baseCodeFor(header: ComponentHeader): string {
	if (header.phase) return header.phase;
	return header.type === 'lainnya' ? 'KOMP' : header.type.toUpperCase();
}
