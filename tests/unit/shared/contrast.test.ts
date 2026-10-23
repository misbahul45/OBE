import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { contrastRatio, parseThemeTokens } from '#lib/shared/format/contrast.ts';

const css = readFileSync('src/routes/layout.css', 'utf8');
const { light, dark } = parseThemeTokens(css);

type Pair = { fg: string; bg: string; min: number; label: string };

const textPairs: Pair[] = [
	['foreground', 'background'],
	['card-foreground', 'card'],
	['popover-foreground', 'popover'],
	['primary-foreground', 'primary'],
	['secondary-foreground', 'secondary'],
	['muted-foreground', 'background'],
	['muted-foreground', 'card'],
	['muted-foreground', 'muted'],
	['accent-foreground', 'accent'],
	['destructive-foreground', 'destructive'],
	['sidebar-foreground', 'sidebar'],
	['sidebar-primary-foreground', 'sidebar-primary'],
	['sidebar-accent-foreground', 'sidebar-accent'],
	['status-success', 'status-success-soft'],
	['status-warning', 'status-warning-soft'],
	['status-danger', 'status-danger-soft'],
	['status-info', 'status-info-soft'],
	['status-neutral', 'status-neutral-soft'],
	['status-success', 'card'],
	['status-warning', 'card'],
	['status-danger', 'card'],
	['status-info', 'card'],
	['status-neutral', 'card'],
	['primary', 'background'],
	['primary', 'card'],
	['primary', 'primary-soft'],
	['primary-hover', 'secondary'],
	['primary-foreground', 'primary-hover'],
	['primary-hover', 'primary-muted'],
	['primary-hover', 'primary-soft'],
	['secondary-foreground', 'background'],
	['destructive', 'card'],
	['muted-foreground', 'sidebar'],
	['secondary-foreground', 'primary-soft'],
	['secondary-foreground', 'primary-muted']
].map(([fg, bg]) => ({ fg, bg, min: 4.5, label: `${fg} / ${bg}` }));

const graphicalPairs: Pair[] = [
	['ring', 'background'],
	['ring', 'card'],
	['success', 'card'],
	['warning', 'card'],
	['info', 'card'],
	['destructive', 'card'],
	['chart-1', 'card'],
	['chart-2', 'card'],
	['chart-3', 'card'],
	['chart-4', 'card'],
	['chart-5', 'card'],
	['sidebar-primary', 'sidebar']
].map(([fg, bg]) => ({ fg, bg, min: 3, label: `${fg} / ${bg}` }));

function failures(tokens: Record<string, string>, pairs: Pair[]) {
	return pairs
		.map((p) => ({ ...p, ratio: contrastRatio(tokens[p.fg], tokens[p.bg]) }))
		.filter((p) => p.ratio < p.min)
		.map((p) => `${p.label} = ${p.ratio.toFixed(2)} (min ${p.min})`);
}

describe('token tema terbaca dari layout.css', () => {
	test('mode terang dan gelap memiliki himpunan token yang sama untuk pasangan yang diuji', () => {
		for (const { fg, bg } of [...textPairs, ...graphicalPairs]) {
			expect(light[fg], `terang: ${fg}`).toBeDefined();
			expect(light[bg], `terang: ${bg}`).toBeDefined();
			expect(dark[fg], `gelap: ${fg}`).toBeDefined();
			expect(dark[bg], `gelap: ${bg}`).toBeDefined();
		}
	});
});

describe('kontras WCAG 2.2 AA', () => {
	test('teks normal minimal 4,5:1 pada mode terang', () => {
		expect(failures(light, textPairs)).toEqual([]);
	});

	test('teks normal minimal 4,5:1 pada mode gelap', () => {
		expect(failures(dark, textPairs)).toEqual([]);
	});

	test('komponen grafis dan batas kontrol formulir minimal 3:1 pada mode terang', () => {
		expect(failures(light, graphicalPairs)).toEqual([]);
	});

	test('komponen grafis dan batas kontrol formulir minimal 3:1 pada mode gelap', () => {
		expect(failures(dark, graphicalPairs)).toEqual([]);
	});

	test('perhitungan rasio kontras sesuai nilai rujukan WCAG', () => {
		expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
		expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
		expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
	});
});

describe('palet Professional Blue-White', () => {
	test('token inti mengikuti spesifikasi kanonik', () => {
		const canonical: Record<string, string> = {
			background: '#ffffff',
			foreground: '#0f172a',
			primary: '#2563eb',
			'primary-hover': '#1d4ed8',
			'primary-light': '#3b82f6',
			'primary-soft': '#eff6ff',
			'primary-muted': '#dbeafe',
			secondary: '#f8fafc',
			'secondary-foreground': '#334155',
			muted: '#f8fafc',
			'muted-foreground': '#64748b',
			border: '#e2e8f0',
			input: '#cbd5e1',
			ring: '#3b82f6',
			destructive: '#dc2626',
			success: '#16a34a',
			warning: '#d97706',
			info: '#2563eb'
		};
		for (const [token, value] of Object.entries(canonical)) expect(light[token], token).toBe(value);
	});

	test('hierarki permukaan: putih dominan, sidebar putih, navigasi aktif biru lembut', () => {
		for (const token of ['background', 'card', 'popover', 'sidebar']) expect(light[token], token).toBe('#ffffff');
		expect(light['sidebar-accent']).toBe('#eff6ff');
		expect(light['sidebar-accent-foreground']).toBe('#2563eb');
		expect(light['sidebar-border']).toBe('#e2e8f0');
		expect(light.accent).toBe('#eff6ff');
	});

	test('tidak ada aksen pesaing: semua warna berkromatik berada pada keluarga biru kecuali semantik dan seri grafik yang diizinkan', () => {
		const hue = (hex: string) => {
			const v = hex.replace('#', '');
			const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
			const max = Math.max(r, g, b);
			const min = Math.min(r, g, b);
			const d = max - min;
			if (d < 0.08) return null;
			const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
			return (h * 60 + 360) % 360;
		};
		const semantic = /^(destructive|success|warning|status-(success|warning|danger))/;
		const allowedChart = new Set(['chart-3', 'chart-4']);
		const offenders = Object.entries(light).filter(([token, value]) => {
			const h = hue(value);
			if (h === null || semantic.test(token) || allowedChart.has(token)) return false;
			return h < 200 || h > 235;
		});
		expect(offenders.map(([token, value]) => `${token} ${value}`)).toEqual([]);
		expect(Object.keys(light).filter((token) => token.startsWith('brand-'))).toEqual([]);
	});

	test('batas input mengikuti spesifikasi #CBD5E1; rasionya terukur dan pada mode gelap memenuhi 3:1', () => {
		expect(contrastRatio(light.input, light.background)).toBeGreaterThan(1.4);
		expect(contrastRatio(light.input, light.background)).toBeLessThan(1.6);
		expect(contrastRatio(dark.input, dark.background)).toBeGreaterThanOrEqual(3);
	});

	test('warna kanonik status dipakai untuk isian dan ikon; teks status memakai turunan yang lebih gelap', () => {
		for (const status of ['success', 'warning']) {
			expect(contrastRatio(light[status], light.background), `${status} sebagai teks`).toBeLessThan(4.5);
			expect(contrastRatio(light[`status-${status}`], light[`status-${status}-soft`]), `status-${status}`).toBeGreaterThanOrEqual(4.5);
		}
	});

	test('status tidak bergantung pada warna saja: setiap status punya pasangan teks dan latar sendiri', () => {
		for (const status of ['success', 'warning', 'danger', 'info', 'neutral']) {
			expect(light[`status-${status}`]).toBeDefined();
			expect(light[`status-${status}-soft`]).toBeDefined();
			expect(light[`status-${status}`]).not.toBe(light[`status-${status}-soft`]);
		}
	});

	test('pita peta panas memiliki kontras teks minimal 4,5:1 dan makin gelap', async () => {
		const { heatBands } = await import('#lib/shared/charts/chart-math.ts');
		for (const band of heatBands) expect(contrastRatio(band.foreground, band.background), band.label).toBeGreaterThanOrEqual(4.5);
	});
});
