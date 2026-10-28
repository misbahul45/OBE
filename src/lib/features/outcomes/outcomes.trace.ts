import type { ObeBlueprint } from '#lib/features/imports/obe-blueprint.types.ts';
import type { ComponentStat, OfferingTrace, OutcomeStat, TraceLink, TraceNode } from './outcomes.types.ts';

type TraceInput = {
	blueprint: ObeBlueprint;
	components: ComponentStat[];
	cpmk: OutcomeStat[];
	cpl: OutcomeStat[];
	source: { fileName: string; sheetName: string };
};

const reachedOf = (stat: OutcomeStat | undefined): boolean | null => stat?.meetsClassRatio ?? null;

export function buildTrace({ blueprint, components, cpmk, cpl, source }: TraceInput): OfferingTrace | null {
	const componentByCode = new Map(components.map((c) => [c.code, c]));
	const cpmkByCode = new Map(cpmk.map((c) => [c.code, c]));
	const cplByCode = new Map(cpl.map((c) => [c.code, c]));

	const links: TraceLink[] = [];
	for (const row of blueprint.cpmk)
		for (const part of row.components) {
			const component = componentByCode.get(part.componentCode);
			if (!component) continue;
			const share = component.weightPercent && component.weightPercent > 0 ? component.weightPercent : 1;
			links.push({ from: `k:${part.componentCode}`, to: `m:${row.code}`, weight: part.coefficient * share, display: part.coefficient });
		}
	for (const row of blueprint.cpl)
		for (const link of row.links) links.push({ from: `m:${link.cpmk}`, to: `l:${row.code}`, weight: link.weight, display: link.weight });
	if (links.length === 0) return null;

	const used = new Set(links.flatMap((l) => [l.from, l.to]));
	const nodes: TraceNode[] = [];
	for (const component of components)
		if (used.has(`k:${component.code}`)) nodes.push({ id: `k:${component.code}`, column: 0, code: component.code, label: component.name, value: component.mean, ratio: null, reached: null });
	for (const code of [...new Set(links.filter((l) => l.to.startsWith('m:')).map((l) => l.to.slice(2)).concat(links.filter((l) => l.from.startsWith('m:')).map((l) => l.from.slice(2))))].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))) {
		const stat = cpmkByCode.get(code);
		nodes.push({ id: `m:${code}`, column: 1, code, label: stat?.title ?? code, value: stat?.mean ?? null, ratio: stat?.distribution.ratioAchieved ?? null, reached: reachedOf(stat) });
	}
	for (const code of [...new Set(links.filter((l) => l.to.startsWith('l:')).map((l) => l.to.slice(2)))].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))) {
		const stat = cplByCode.get(code);
		nodes.push({ id: `l:${code}`, column: 2, code, label: stat?.title ?? code, value: stat?.mean ?? null, ratio: stat?.distribution.ratioAchieved ?? null, reached: reachedOf(stat) });
	}
	return { nodes, links, source };
}
