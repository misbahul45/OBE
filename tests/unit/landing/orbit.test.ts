import { describe, expect, test } from 'bun:test';
import { landingCopy } from '#lib/features/landing/landing.copy.ts';
import { buildOrbit, hubRadius, nodeGapDegrees, nodeRadius, orbitCenter, orbitNodeIds, orbitRadius, orbitView } from '#lib/features/landing/landing.orbit.ts';

const layout = buildOrbit();
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const center = { x: orbitCenter, y: orbitCenter };

function arcEnds(path: string) {
	const [, x1, y1, , , , , , , x2, y2] = path.split(' ');
	return { start: { x: Number(x1), y: Number(y1) }, end: { x: Number(x2), y: Number(y2) } };
}

describe('geometri orbit', () => {
	test('empat simpul berjarak sama dari pusat dan terpisah 90 derajat searah jarum jam dari atas', () => {
		expect(layout.nodes.map((node) => node.id)).toEqual([...orbitNodeIds]);
		for (const node of layout.nodes) expect(Math.abs(distance(node, center) - orbitRadius)).toBeLessThan(0.02);
		expect(layout.nodes.map((node) => node.angle)).toEqual([-90, 0, 90, 180]);
		expect(layout.nodes[0]).toMatchObject({ x: 320, y: 110 });
		expect(layout.nodes[1]).toMatchObject({ x: 530, y: 320 });
	});

	test('simpul tidak saling tumpang tindih dan tidak menyentuh hub', () => {
		for (const a of layout.nodes) for (const b of layout.nodes) if (a.index < b.index) expect(distance(a, b)).toBeGreaterThan(nodeRadius * 2 + 20);
		expect(orbitRadius - nodeRadius).toBeGreaterThan(hubRadius + 20);
	});

	test('posisi persen selaras dengan koordinat viewBox dan berada di dalam kanvas', () => {
		for (const node of layout.nodes) {
			expect(node.leftPercent).toBeCloseTo((node.x / orbitView) * 100, 1);
			expect(node.topPercent).toBeCloseTo((node.y / orbitView) * 100, 1);
			expect(node.leftPercent - node.sizePercent / 2).toBeGreaterThan(0);
			expect(node.leftPercent + node.sizePercent / 2).toBeLessThan(100);
			expect(node.topPercent - node.sizePercent / 2).toBeGreaterThan(0);
			expect(node.topPercent + node.sizePercent / 2).toBeLessThan(100);
		}
		expect(layout.hubSizePercent).toBeCloseTo(((hubRadius * 2) / orbitView) * 100, 1);
	});
});

describe('busur dan arah', () => {
	test('empat busur membentuk rantai berurutan yang menutup, dengan busur terakhir sebagai umpan balik', () => {
		expect(layout.arcs.map((arc) => `${arc.from}>${arc.to}`)).toEqual(['mk>cpmk', 'cpmk>cpl', 'cpl>cqi', 'cqi>mk']);
		expect(layout.arcs.map((arc) => arc.feedback)).toEqual([false, false, false, true]);
	});

	test('ujung busur berada pada orbit dan di luar lingkaran simpul beserta jarak amannya', () => {
		for (const arc of layout.arcs) {
			const { start, end } = arcEnds(arc.path);
			expect(Math.abs(distance(start, center) - orbitRadius)).toBeLessThan(0.1);
			expect(Math.abs(distance(end, center) - orbitRadius)).toBeLessThan(0.1);
			const from = layout.nodes.find((node) => node.id === arc.from)!;
			const to = layout.nodes.find((node) => node.id === arc.to)!;
			expect(distance(start, from)).toBeGreaterThanOrEqual(nodeRadius + 11);
			expect(distance(end, to)).toBeGreaterThanOrEqual(nodeRadius + 11);
		}
		expect(nodeGapDegrees).toBeGreaterThan(15);
		expect(nodeGapDegrees).toBeLessThan(30);
	});

	test('panah berada di tengah busur, searah jarum jam, dan jauh dari semua simpul', () => {
		for (const arc of layout.arcs) {
			expect(Math.abs(distance(arc.arrow, center) - orbitRadius)).toBeLessThan(0.1);
			for (const node of layout.nodes) expect(distance(arc.arrow, node)).toBeGreaterThan(nodeRadius + 24);
		}
		expect(layout.arcs[0].arrow.rotate).toBeCloseTo(0 + 45, 0);
		expect(layout.arcs.map((arc) => arc.arrow.rotate)).toEqual([...layout.arcs.map((arc) => arc.arrow.rotate)].sort((a, b) => a - b));
	});

	test('label umpan balik berada di dalam orbit, tidak menimpa hub maupun simpul', () => {
		const label = { x: (layout.feedbackLabel.leftPercent / 100) * orbitView, y: (layout.feedbackLabel.topPercent / 100) * orbitView };
		expect(distance(label, center)).toBeGreaterThan(hubRadius + 40);
		expect(distance(label, center)).toBeLessThan(orbitRadius - 20);
		for (const node of layout.nodes) expect(distance(label, node)).toBeGreaterThan(nodeRadius + 20);
	});

	test('lintasan penuh untuk tracer dimulai dan berakhir di titik atas', () => {
		expect(layout.fullCircle.startsWith(`M ${orbitCenter} ${orbitCenter - orbitRadius}`)).toBe(true);
		expect(layout.fullCircle.endsWith(`${orbitCenter} ${orbitCenter - orbitRadius}`)).toBe(true);
	});
});

describe('isi simpul', () => {
	test('setiap simpul geometri punya penjelasan dan urutan sama dengan rantai tahap', () => {
		expect(landingCopy.loop.nodes.map((node) => node.id)).toEqual([...orbitNodeIds]);
		expect(landingCopy.loop.nodes.map((node) => node.label)).toEqual([...landingCopy.stages]);
		for (const node of landingCopy.loop.nodes) {
			expect(node.body.length).toBeGreaterThan(40);
			expect(node.flow.length).toBeGreaterThan(10);
			expect(node.fullName.length).toBeGreaterThan(0);
		}
	});

	test('istilah resmi sesuai terminologi program studi', () => {
		const names = Object.fromEntries(landingCopy.loop.nodes.map((node) => [node.id, node.fullName]));
		expect(names).toEqual({ mk: 'Mata Kuliah', cpmk: 'Capaian Pembelajaran Mata Kuliah', cpl: 'Capaian Pembelajaran Lulusan', cqi: 'Continuous Quality Improvement' });
		expect(landingCopy.loop.hub).toMatchObject({ label: 'OBE', name: 'Outcome-Based Education' });
	});
});
