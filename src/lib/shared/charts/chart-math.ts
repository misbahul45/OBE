const numberFormat = new Map<number, Intl.NumberFormat>();

function formatterFor(digits: number): Intl.NumberFormat {
	let formatter = numberFormat.get(digits);
	if (!formatter) {
		formatter = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: digits });
		numberFormat.set(digits, formatter);
	}
	return formatter;
}

export function formatValue(value: number | null | undefined, digits = 1): string {
	return value === null || value === undefined || !Number.isFinite(value) ? '—' : formatterFor(digits).format(value);
}

export function niceMax(values: (number | null | undefined)[], floor = 0): number {
	const finite = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
	const peak = Math.max(floor, ...finite, 0);
	if (peak <= 0) return 1;
	const magnitude = 10 ** Math.floor(Math.log10(peak));
	const steps = [1, 2, 2.5, 5, 10];
	const scaled = peak / magnitude;
	return (steps.find((step) => scaled <= step) ?? 10) * magnitude;
}

export function ticks(max: number, desired = 5): number[] {
	if (max <= 0) return [0];
	const raw = max / desired;
	const magnitude = 10 ** Math.floor(Math.log10(raw));
	const step = ([1, 2, 5, 10].find((s) => raw <= s * magnitude) ?? 10) * magnitude;
	const out: number[] = [];
	for (let value = 0; value <= max + step / 1000; value += step) out.push(Math.round(value * 1e6) / 1e6);
	return out;
}

export function linearScale(domain: [number, number], range: [number, number]): (value: number) => number {
	const [d0, d1] = domain;
	const [r0, r1] = range;
	const span = d1 - d0;
	return (value) => (span === 0 ? r0 : r0 + ((value - d0) / span) * (r1 - r0));
}

export type HeatBand = { min: number; background: string; foreground: string; label: string };

export const heatBands: HeatBand[] = [
	{ min: 0, background: '#eff6ff', foreground: '#0f172a', label: 'di bawah 50' },
	{ min: 50, background: '#dbeafe', foreground: '#0f172a', label: '50 sampai 59' },
	{ min: 60, background: '#93c5fd', foreground: '#0f172a', label: '60 sampai 69' },
	{ min: 70, background: '#2563eb', foreground: '#ffffff', label: '70 sampai 79' },
	{ min: 80, background: '#1e3a8a', foreground: '#ffffff', label: '80 ke atas' }
];

export function heatBand(value: number | null | undefined): HeatBand | null {
	if (value === null || value === undefined || !Number.isFinite(value)) return null;
	let chosen = heatBands[0];
	for (const band of heatBands) if (value >= band.min) chosen = band;
	return chosen;
}

export type BarItem = { label: string; value: number | null; note?: string };

export function describeBars(items: BarItem[], target?: number | null, unit = ''): string {
	const present = items.filter((i) => i.value !== null);
	if (items.length === 0) return 'Tidak ada data.';
	if (present.length === 0) return `${items.length} item tanpa nilai yang dapat ditampilkan.`;
	const sorted = [...present].sort((a, b) => (b.value as number) - (a.value as number));
	const top = sorted[0];
	const low = sorted[sorted.length - 1];
	const parts = [`${items.length} item.`, `Tertinggi ${top.label} ${formatValue(top.value)}${unit}.`, `Terendah ${low.label} ${formatValue(low.value)}${unit}.`];
	if (target !== null && target !== undefined) {
		const reached = present.filter((i) => (i.value as number) >= target).length;
		parts.push(`${reached} dari ${present.length} mencapai target ${formatValue(target)}${unit}.`);
	}
	const missing = items.length - present.length;
	if (missing > 0) parts.push(`${missing} item belum memiliki nilai.`);
	return parts.join(' ');
}

export type Bin = { from: number; to: number; count: number };

export function binLabel(bin: Bin): string {
	return `${Math.floor(bin.from)}–${Math.floor(bin.to)}`;
}

export function describeBins(bins: Bin[]): string {
	const total = bins.reduce((sum, b) => sum + b.count, 0);
	if (total === 0) return 'Tidak ada data.';
	const peak = bins.reduce((best, b) => (b.count > best.count ? b : best), bins[0]);
	return `${total} data dalam ${bins.length} rentang. Terbanyak pada rentang ${binLabel(peak)} dengan ${peak.count} data.`;
}
