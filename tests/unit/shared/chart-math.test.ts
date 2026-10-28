import { describe, expect, test } from 'bun:test';
import { chooseBasis, sumDistributions, achievementDistribution } from '#lib/features/outcomes/outcomes.calc.ts';
import { describeRadar, describeShares, layoutFlow, polar, type FlowLink, type FlowNode, type ShareItem } from '#lib/shared/charts/chart-math.ts';
import { markBinding } from '#lib/shared/charts/chart-marks.ts';

const node = (id: string, column: 0 | 1 | 2): FlowNode => ({ id, column, code: id, label: id, value: null, ratio: null, reached: null });

describe('layoutFlow', () => {
	const nodes = [node('a', 0), node('b', 0), node('m', 1), node('l', 2)];
	const links: FlowLink[] = [{ from: 'a', to: 'm', weight: 30, display: 1 }, { from: 'b', to: 'm', weight: 10, display: 1 }, { from: 'm', to: 'l', weight: 1, display: 1 }];

	test('simpul tidak saling menimpa dalam satu kolom dan berada dalam tinggi kanvas', () => {
		const layout = layoutFlow(nodes, links, 600, 200, 14, 10);
		const column0 = layout.nodes.filter((n) => n.column === 0).sort((x, y) => x.y - y.y);
		expect(column0[0].y + column0[0].height).toBeLessThanOrEqual(column0[1].y);
		for (const n of layout.nodes) {
			expect(n.y).toBeGreaterThanOrEqual(0);
			expect(n.y + n.height).toBeLessThanOrEqual(200.0001);
		}
	});

	test('tinggi simpul sebanding dengan arus dan satu jalur dibuat untuk setiap tautan', () => {
		const layout = layoutFlow(nodes, links, 600, 200, 14, 10);
		const a = layout.nodes.find((n) => n.id === 'a')!;
		const b = layout.nodes.find((n) => n.id === 'b')!;
		expect(a.height).toBeGreaterThan(b.height);
		expect(layout.paths).toHaveLength(3);
		expect(layout.paths.every((p) => p.d.startsWith('M') && p.d.endsWith('Z'))).toBe(true);
	});

	test('tautan ke simpul yang tidak ada diabaikan', () => {
		const layout = layoutFlow(nodes, [...links, { from: 'a', to: 'hilang', weight: 5, display: 1 }], 600, 200, 14, 10);
		expect(layout.paths).toHaveLength(3);
	});
});

describe('polar', () => {
	test('sumbu pertama menghadap ke atas dan sumbu kedua searah jarum jam', () => {
		const top = polar(100, 100, 50, 0, 4);
		const right = polar(100, 100, 50, 1, 4);
		expect(top.x).toBeCloseTo(100);
		expect(top.y).toBeCloseTo(50);
		expect(right.x).toBeCloseTo(150);
		expect(right.y).toBeCloseTo(100);
	});
});

describe('ringkasan tekstual grafik', () => {
	const items: ShareItem[] = [
		{ label: 'CPMK-1', achieved: 5, notAchieved: 5, insufficient: 0, ratio: 50, meets: false },
		{ label: 'CPMK-2', achieved: 9, notAchieved: 1, insufficient: 0, ratio: 90, meets: true }
	];

	test('describeShares menyebut jumlah yang memenuhi rasio dan rasio terendah', () => {
		const text = describeShares(items);
		expect(text).toContain('1 dari 2 memenuhi rasio kelas');
		expect(text).toContain('CPMK-1');
		expect(describeShares([])).toBe('Tidak ada data.');
	});

	test('describeRadar menyebut sumbu tertinggi dan terendah', () => {
		const text = describeRadar([{ label: 'CPL-1', value: 90, target: 62 }, { label: 'CPL-2', value: 50, target: 62 }, { label: 'CPL-3', value: null, target: null }]);
		expect(text).toContain('Tertinggi CPL-1');
		expect(text).toContain('Terendah CPL-2');
		expect(describeRadar([{ label: 'X', value: null, target: null }])).toBe('Tidak ada nilai yang dapat digambar.');
	});
});

describe('markBinding', () => {
	test('menyalakan dan mematikan pilihan lewat penunjuk, fokus, dan papan ketik', () => {
		const state: { current: string | null } = { current: null };
		const binding = markBinding<string>((key) => (state.current = key), 'CPL-1');
		binding.onpointerenter();
		expect(state.current).toBe('CPL-1');
		binding.onpointerleave();
		expect(state.current).toBeNull();
		binding.onfocus();
		expect(state.current).toBe('CPL-1');
		binding.onblur();
		expect(state.current).toBeNull();
		const prevented = { value: false };
		binding.onkeydown({ key: 'Enter', preventDefault: () => (prevented.value = true) } as unknown as KeyboardEvent);
		expect(state.current).toBe('CPL-1');
		expect(prevented.value).toBe(true);
		binding.onblur();
		binding.onkeydown({ key: 'a', preventDefault: () => undefined } as unknown as KeyboardEvent);
		expect(state.current).toBeNull();
		expect(binding.role).toBe('button');
	});
});

describe('chooseBasis dan sumDistributions', () => {
	const row = (value: number | null, completeness = 'complete') => ({ enrollmentId: 'e', value, completeness });

	test('hasil hitung dipilih bila ada yang lengkap, kolom Excel bila tidak, dan null bila tidak ada keduanya', () => {
		expect(chooseBasis([row(80)], [row(70)]).basis).toBe('calculated');
		expect(chooseBasis([row(null, 'incomplete')], [row(70)]).basis).toBe('imported_reference');
		expect(chooseBasis([], [row(70)]).basis).toBe('imported_reference');
		expect(chooseBasis([], []).basis).toBeNull();
		expect(chooseBasis([], [row(null)]).basis).toBeNull();
	});

	test('sumDistributions menjumlahkan cacah dan menghitung ulang rasio dari total, bukan merata-ratakan rasio', () => {
		const a = achievementDistribution([80, 80, 80, 80], 62);
		const b = achievementDistribution([10, 80], 62);
		const total = sumDistributions([a, b]);
		expect(total).toMatchObject({ achieved: 5, notAchieved: 1, total: 6 });
		expect(total.ratioAchieved).toBeCloseTo(83.3333, 3);
	});
});
