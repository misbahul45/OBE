import { describe, expect, test } from 'bun:test';
import { buildTrace } from '#lib/features/outcomes/outcomes.trace.ts';
import type { ComponentStat, OutcomeStat } from '#lib/features/outcomes/outcomes.types.ts';
import { achievementDistribution } from '#lib/features/outcomes/outcomes.calc.ts';
import { sampleBlueprint } from '../../support/imports.ts';

const component = (code: string, weightPercent: number | null, mean: number | null): ComponentStat => ({ id: code, code, name: `Komponen ${code}`, type: 'uts', weightPercent, maxScore: 100, scored: 3, blank: 0, mean, min: null, max: null, cpmkCodes: [] });

const outcome = (code: string, values: (number | null)[], meets: boolean | null): OutcomeStat => ({
	id: code,
	code,
	title: `Judul ${code}`,
	complete: values.filter((v) => v !== null).length,
	incomplete: 0,
	mean: 70,
	target: 62,
	distribution: achievementDistribution(values, 62),
	meetsClassRatio: meets,
	basis: 'imported_reference',
	targetSource: 'excel',
	classRatio: 75,
	reference: null
});

const source = { fileName: 'uji.xlsx', sheetName: 'Sheet Uji' };

describe('penyusunan jejak komponen, CPMK, dan CPL', () => {
	const input = {
		blueprint: sampleBlueprint(),
		components: [component('UTS-1', 40, 70), component('UAS-1', 60, 80), component('TIDAK-DIPAKAI', 0, 50)],
		cpmk: [outcome('CPMK-1', [80, 60, 90], false), outcome('CPMK-2', [70, 70, 100], true)],
		cpl: [outcome('CPL-1', [75, 55, 95], null)],
		source
	};

	test('membuat tiga kolom simpul dan hanya komponen yang terhubung', () => {
		const trace = buildTrace(input)!;
		expect(trace.nodes.filter((n) => n.column === 0).map((n) => n.code)).toEqual(['UTS-1', 'UAS-1']);
		expect(trace.nodes.filter((n) => n.column === 1).map((n) => n.code)).toEqual(['CPMK-1', 'CPMK-2']);
		expect(trace.nodes.filter((n) => n.column === 2).map((n) => n.code)).toEqual(['CPL-1']);
		expect(trace.source).toEqual(source);
	});

	test('lebar tautan komponen mengalikan koefisien dengan bobot, sedangkan tampilan memakai koefisien asli', () => {
		const trace = buildTrace(input)!;
		const link = trace.links.find((l) => l.from === 'k:UTS-1' && l.to === 'm:CPMK-1')!;
		expect(link).toMatchObject({ weight: 40, display: 1 });
		expect(trace.links.find((l) => l.from === 'm:CPMK-2' && l.to === 'l:CPL-1')).toMatchObject({ weight: 0.6, display: 0.6 });
	});

	test('status simpul mengikuti ketercapaian rasio kelas dan null berarti belum dinilai', () => {
		const trace = buildTrace(input)!;
		const byId = Object.fromEntries(trace.nodes.map((n) => [n.id, n]));
		expect(byId['m:CPMK-1'].reached).toBe(false);
		expect(byId['m:CPMK-2'].reached).toBe(true);
		expect(byId['l:CPL-1'].reached).toBeNull();
		expect(byId['k:UTS-1'].reached).toBeNull();
	});

	test('komponen tanpa bobot memakai lebar 1 dan blueprint tanpa tautan terpetakan menghasilkan null', () => {
		const noWeight = buildTrace({ ...input, components: [component('UTS-1', null, null), component('UAS-1', null, null)] })!;
		expect(noWeight.links.find((l) => l.from === 'k:UTS-1')!.weight).toBe(1);
		expect(buildTrace({ ...input, components: [] , blueprint: sampleBlueprint({ cpl: [] }) })).toBeNull();
	});

	test('tautan ganda untuk pasangan yang sama digabung agar kunci tampilan tidak pernah kembar', () => {
		const duplicated = sampleBlueprint({
			cpmk: [{ code: 'CPMK-1', components: [{ componentCode: 'UTS-1', coefficient: 1 }, { componentCode: 'UTS-1', coefficient: 2 }] }],
			cpl: [{ code: 'CPL-1', links: [{ cpmk: 'CPMK-1', weight: 0.4 }, { cpmk: 'CPMK-1', weight: 0.2 }] }]
		});
		const trace = buildTrace({ ...input, blueprint: duplicated })!;
		const keys = trace.links.map((l) => `${l.from}>${l.to}`);
		expect(new Set(keys).size).toBe(keys.length);
		expect(trace.links.find((l) => l.from === 'k:UTS-1')).toMatchObject({ weight: 120, display: 2 });
		expect(trace.links.find((l) => l.to === 'l:CPL-1')!.weight).toBeCloseTo(0.6);
		const ids = trace.nodes.map((n) => n.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});
