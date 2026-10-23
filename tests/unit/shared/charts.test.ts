import { describe, expect, test } from 'bun:test';
import { binLabel, describeBars, describeBins, formatValue, heatBand, heatBands, linearScale, niceMax, ticks } from '#lib/shared/charts/chart-math.ts';
import { contrastRatio } from '#lib/shared/format/contrast.ts';

describe('formatValue', () => {
	test('memakai koma desimal Indonesia dan tanda hubung untuk nilai kosong', () => {
		expect(formatValue(74.6667)).toBe('74,7');
		expect(formatValue(74.6667, 2)).toBe('74,67');
		expect(formatValue(70)).toBe('70');
		expect(formatValue(0)).toBe('0');
		expect(formatValue(null)).toBe('—');
		expect(formatValue(undefined)).toBe('—');
		expect(formatValue(Number.NaN)).toBe('—');
	});

	test('nilai nol tidak dianggap kosong', () => {
		expect(formatValue(0)).not.toBe(formatValue(null));
	});
});

describe('niceMax dan ticks', () => {
	test('membulatkan batas atas ke angka yang rapi', () => {
		expect(niceMax([3, 7])).toBe(10);
		expect(niceMax([12])).toBe(20);
		expect(niceMax([23])).toBe(25);
		expect(niceMax([61])).toBe(100);
		expect(niceMax([0, null, undefined])).toBe(1);
		expect(niceMax([5], 100)).toBe(100);
	});

	test('menghasilkan tanda sumbu dari nol hingga batas', () => {
		expect(ticks(100, 5)).toEqual([0, 20, 40, 60, 80, 100]);
		expect(ticks(10, 5)).toEqual([0, 2, 4, 6, 8, 10]);
		expect(ticks(0)).toEqual([0]);
		const t = ticks(25, 5);
		expect(t[0]).toBe(0);
		expect(t.at(-1)).toBeGreaterThanOrEqual(25 - 1e-6);
	});
});

describe('linearScale', () => {
	test('memetakan domain ke rentang termasuk rentang terbalik untuk sumbu Y', () => {
		const x = linearScale([0, 100], [10, 110]);
		expect([x(0), x(50), x(100)]).toEqual([10, 60, 110]);
		const y = linearScale([0, 10], [200, 0]);
		expect([y(0), y(10), y(2.5)]).toEqual([200, 0, 150]);
	});

	test('domain tanpa lebar tidak membagi dengan nol', () => {
		expect(linearScale([5, 5], [0, 100])(5)).toBe(0);
	});
});

describe('heatBand', () => {
	test('memilih pita berdasarkan batas bawah inklusif', () => {
		expect(heatBand(0)?.min).toBe(0);
		expect(heatBand(49.99)?.min).toBe(0);
		expect(heatBand(50)?.min).toBe(50);
		expect(heatBand(69.99)?.min).toBe(60);
		expect(heatBand(70)?.min).toBe(70);
		expect(heatBand(100)?.min).toBe(80);
		expect(heatBand(null)).toBeNull();
		expect(heatBand(Number.NaN)).toBeNull();
	});

	test('setiap pita memenuhi kontras teks WCAG AA (4,5:1)', () => {
		for (const band of heatBands) expect(contrastRatio(band.foreground, band.background)).toBeGreaterThanOrEqual(4.5);
	});

	test('pita berurutan makin gelap agar skala dapat dibaca', () => {
		const luminance = (hex: string) => contrastRatio(hex, '#000000');
		const lums = heatBands.map((b) => luminance(b.background));
		for (let i = 1; i < lums.length; i++) expect(lums[i]).toBeLessThan(lums[i - 1]);
	});
});

describe('ringkasan teks untuk pembaca layar', () => {
	test('describeBars menyebut nilai tertinggi, terendah, target, dan item tanpa nilai', () => {
		const text = describeBars([{ label: 'CPMK-1', value: 80 }, { label: 'CPMK-2', value: 60 }, { label: 'CPMK-3', value: null }], 70, '%');
		expect(text).toContain('3 item');
		expect(text).toContain('Tertinggi CPMK-1 80%');
		expect(text).toContain('Terendah CPMK-2 60%');
		expect(text).toContain('1 dari 2 mencapai target 70%');
		expect(text).toContain('1 item belum memiliki nilai');
	});

	test('describeBars menangani kosong dan semua nilai kosong', () => {
		expect(describeBars([])).toBe('Tidak ada data.');
		expect(describeBars([{ label: 'A', value: null }])).toContain('tanpa nilai');
	});

	test('describeBins menyebut rentang terbanyak dan total', () => {
		const bins = [{ from: 0, to: 9.99, count: 0 }, { from: 70, to: 79.99, count: 5 }, { from: 90, to: 100, count: 2 }];
		expect(describeBins(bins)).toBe('7 data dalam 3 rentang. Terbanyak pada rentang 70–79 dengan 5 data.');
		expect(describeBins([{ from: 0, to: 9.99, count: 0 }])).toBe('Tidak ada data.');
		expect(binLabel({ from: 90, to: 100, count: 0 })).toBe('90–100');
	});
});
