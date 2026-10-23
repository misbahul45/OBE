import { describe, expect, test } from 'bun:test';
import { buildFormations, dotGridSize, dotStageCount, seededRandom } from '#lib/features/landing/landing.dots.ts';

describe('seededRandom', () => {
	test('deterministik untuk seed yang sama dan berada pada [0, 1)', () => {
		const a = seededRandom(7);
		const b = seededRandom(7);
		const first = Array.from({ length: 50 }, () => a());
		expect(first).toEqual(Array.from({ length: 50 }, () => b()));
		for (const value of first) {
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThan(1);
		}
	});
});

describe('dotGridSize', () => {
	test('dibatasi agar kerapatan titik wajar pada layar sangat kecil maupun sangat besar', () => {
		expect(dotGridSize(100, 100)).toEqual({ columns: 18, rows: 18 });
		expect(dotGridSize(20000, 20000)).toEqual({ columns: 96, rows: 96 });
		expect(dotGridSize(1440, 900, 24)).toEqual({ columns: 60, rows: 38 });
	});
});

describe('buildFormations', () => {
	const formations = buildFormations(40, 25);

	test('empat formasi dengan jumlah titik yang sama', () => {
		expect(dotStageCount).toBe(4);
		expect(formations.count).toBe(1000);
		expect(formations.stages).toHaveLength(4);
		for (const stage of formations.stages) expect(stage.length).toBe(formations.count * 3);
		expect(formations.seeds.length).toBe(formations.count);
	});

	test('formasi awal adalah grid datar yang mengisi [-1, 1] pada bidang z = 0', () => {
		const grid = formations.stages[0];
		const xs = Array.from({ length: formations.count }, (_, i) => grid[i * 3]);
		const ys = Array.from({ length: formations.count }, (_, i) => grid[i * 3 + 1]);
		expect(Math.min(...xs)).toBeCloseTo(-1, 5);
		expect(Math.max(...xs)).toBeCloseTo(1, 5);
		expect(Math.min(...ys)).toBeCloseTo(-1, 5);
		expect(Math.max(...ys)).toBeCloseTo(1, 5);
		for (let i = 0; i < formations.count; i++) expect(grid[i * 3 + 2]).toBe(0);
	});

	test('formasi gelung (CQI) berupa cincin di sekitar radius 0,62', () => {
		const loop = formations.stages[3];
		const radii = Array.from({ length: formations.count }, (_, i) => Math.hypot(loop[i * 3], loop[i * 3 + 1]));
		const mean = radii.reduce((sum, r) => sum + r, 0) / radii.length;
		expect(mean).toBeGreaterThan(0.58);
		expect(mean).toBeLessThan(0.66);
	});

	test('hasil identik untuk seed sama dan berbeda untuk seed lain, tanpa NaN', () => {
		const same = buildFormations(40, 25);
		const other = buildFormations(40, 25, 99);
		expect(Array.from(same.stages[1])).toEqual(Array.from(formations.stages[1]));
		expect(Array.from(other.stages[1])).not.toEqual(Array.from(formations.stages[1]));
		for (const stage of formations.stages) for (const value of stage) expect(Number.isFinite(value)).toBe(true);
	});
});
