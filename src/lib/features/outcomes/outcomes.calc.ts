export const formulaVersion = 'v1';

export type CalcComponent = { id: string; code: string; weightPercent: number | null; maxScore: number; isRequired: boolean };
export type ScoreByComponent = Record<string, number | null | undefined>;
export type CpmkMappingInput = { cpmkId: string; code: string; components: { componentId: string; coefficient: number }[] };
export type CplMappingInput = { cplId: string; code: string; cpmk: { cpmkId: string; weight: number }[] };

export type NotConfiguredReason = 'NO_COMPONENT_MAPPING' | 'WEIGHT_MISSING' | 'ZERO_TOTAL_WEIGHT' | 'NO_CPMK_MAPPING' | 'COMPONENT_NOT_FOUND';

export type OutcomeStatus = 'complete' | 'incomplete' | 'not_configured';

export type OutcomeValue = {
	status: OutcomeStatus;
	value: number | null;
	reason?: NotConfiguredReason;
	missing: string[];
	invalid: string[];
	coverage: number;
	trace: { code: string; score: number | null; normalized: number | null; weightPercent: number | null; coefficient: number }[];
};

const round4 = (value: number) => Math.round(value * 10000) / 10000;

export function normalizeScore(score: number, maxScore: number): number {
	return round4((score / maxScore) * 100);
}

function emptyOutcome(status: OutcomeStatus, extra: Partial<OutcomeValue> = {}): OutcomeValue {
	return { status, value: null, missing: [], invalid: [], coverage: 0, trace: [], ...extra };
}

export function computeCpmk(mapping: CpmkMappingInput, components: CalcComponent[], scores: ScoreByComponent): OutcomeValue {
	if (mapping.components.length === 0) return emptyOutcome('not_configured', { reason: 'NO_COMPONENT_MAPPING' });
	const byId = new Map(components.map((c) => [c.id, c]));
	const parts = mapping.components.map((m) => ({ ...m, component: byId.get(m.componentId) }));
	if (parts.some((p) => !p.component)) return emptyOutcome('not_configured', { reason: 'COMPONENT_NOT_FOUND' });
	if (parts.some((p) => p.component!.weightPercent === null)) return emptyOutcome('not_configured', { reason: 'WEIGHT_MISSING' });

	const missing: string[] = [];
	const invalid: string[] = [];
	const trace: OutcomeValue['trace'] = [];
	let numerator = 0;
	let denominator = 0;
	let counted = 0;
	for (const part of parts) {
		const component = part.component!;
		const raw = scores[component.id];
		const weight = component.weightPercent!;
		if (raw === null || raw === undefined) {
			trace.push({ code: component.code, score: null, normalized: null, weightPercent: weight, coefficient: part.coefficient });
			if (component.isRequired) missing.push(component.code);
			continue;
		}
		if (!Number.isFinite(raw) || raw < 0 || raw > component.maxScore) {
			invalid.push(component.code);
			trace.push({ code: component.code, score: raw, normalized: null, weightPercent: weight, coefficient: part.coefficient });
			continue;
		}
		const normalized = normalizeScore(raw, component.maxScore);
		trace.push({ code: component.code, score: raw, normalized, weightPercent: weight, coefficient: part.coefficient });
		numerator += part.coefficient * weight * normalized;
		denominator += part.coefficient * weight;
		counted++;
	}
	const coverage = parts.length ? round4(counted / parts.length) : 0;
	if (missing.length || invalid.length) return { status: 'incomplete', value: null, missing, invalid, coverage, trace };
	const fullWeight = parts.reduce((sum, p) => sum + p.coefficient * p.component!.weightPercent!, 0);
	if (fullWeight <= 0) return emptyOutcome('not_configured', { reason: 'ZERO_TOTAL_WEIGHT', trace });
	if (denominator <= 0) return { status: 'incomplete', value: null, missing: parts.filter((p) => scores[p.componentId] == null).map((p) => p.component!.code), invalid, coverage, trace };
	return { status: 'complete', value: round4(numerator / denominator), missing: [], invalid: [], coverage, trace };
}

export function computeCpl(mapping: CplMappingInput, cpmkResults: Record<string, OutcomeValue | undefined>): OutcomeValue {
	if (mapping.cpmk.length === 0) return emptyOutcome('not_configured', { reason: 'NO_CPMK_MAPPING' });
	let numerator = 0;
	let denominator = 0;
	let counted = 0;
	const missing: string[] = [];
	const trace: OutcomeValue['trace'] = [];
	for (const link of mapping.cpmk) {
		const result = cpmkResults[link.cpmkId];
		const code = `cpmk:${link.cpmkId}`;
		if (!result || result.status === 'not_configured') return emptyOutcome('not_configured', { reason: 'NO_COMPONENT_MAPPING', trace });
		trace.push({ code, score: result.value, normalized: result.value, weightPercent: null, coefficient: link.weight });
		if (result.status !== 'complete' || result.value === null) {
			missing.push(code);
			continue;
		}
		numerator += link.weight * result.value;
		denominator += link.weight;
		counted++;
	}
	const coverage = round4(counted / mapping.cpmk.length);
	if (missing.length) return { status: 'incomplete', value: null, missing, invalid: [], coverage, trace };
	return { status: 'complete', value: round4(numerator / denominator), missing: [], invalid: [], coverage, trace };
}

export type FinalScore = { status: OutcomeStatus; value: number | null; reason?: 'WEIGHT_MISSING' | 'WEIGHT_TOTAL_MISMATCH'; missing: string[] };

export function computeFinalScore(components: CalcComponent[], scores: ScoreByComponent, tolerancePercent = 0.5): FinalScore {
	if (components.length === 0) return { status: 'not_configured', value: null, missing: [] };
	if (components.some((c) => c.weightPercent === null)) return { status: 'not_configured', value: null, reason: 'WEIGHT_MISSING', missing: [] };
	const total = components.reduce((sum, c) => sum + c.weightPercent!, 0);
	if (Math.abs(total - 100) > tolerancePercent) return { status: 'not_configured', value: null, reason: 'WEIGHT_TOTAL_MISMATCH', missing: [] };
	const missing = components.filter((c) => c.isRequired && (scores[c.id] === null || scores[c.id] === undefined)).map((c) => c.code);
	if (missing.length) return { status: 'incomplete', value: null, missing };
	let sum = 0;
	for (const c of components) {
		const raw = scores[c.id];
		if (raw === null || raw === undefined) continue;
		if (!Number.isFinite(raw) || raw < 0 || raw > c.maxScore) return { status: 'incomplete', value: null, missing: [c.code] };
		sum += c.weightPercent! * normalizeScore(raw, c.maxScore);
	}
	return { status: 'complete', value: round4(sum / total), missing: [] };
}

export type Achievement = 'tercapai' | 'belum_tercapai' | 'belum_cukup_data' | 'target_belum_dikonfigurasi';

export function classifyAchievement(value: number | null, target: number | null | undefined): Achievement {
	if (value === null) return 'belum_cukup_data';
	if (target === null || target === undefined) return 'target_belum_dikonfigurasi';
	return value >= target ? 'tercapai' : 'belum_tercapai';
}

export type Distribution = { achieved: number; notAchieved: number; insufficient: number; unconfigured: number; total: number; ratioAchieved: number | null };

export function achievementDistribution(values: (number | null)[], target: number | null | undefined): Distribution {
	const result: Distribution = { achieved: 0, notAchieved: 0, insufficient: 0, unconfigured: 0, total: values.length, ratioAchieved: null };
	for (const value of values) {
		const kind = classifyAchievement(value, target);
		if (kind === 'tercapai') result.achieved++;
		else if (kind === 'belum_tercapai') result.notAchieved++;
		else if (kind === 'belum_cukup_data') result.insufficient++;
		else result.unconfigured++;
	}
	const assessed = result.achieved + result.notAchieved;
	result.ratioAchieved = assessed > 0 ? round4((result.achieved / assessed) * 100) : null;
	return result;
}

export type AggregationMethod = 'not_configured' | 'simple_mean' | 'credit_weighted_mean';
export type CourseCplEntry = { value: number | null; credits: number };
export type CplAggregate = { status: 'complete' | 'insufficient' | 'not_configured'; value: number | null; entries: number; used: number; coverage: number };

export function aggregateCpl(entries: CourseCplEntry[], method: AggregationMethod): CplAggregate {
	if (method === 'not_configured') return { status: 'not_configured', value: null, entries: entries.length, used: 0, coverage: 0 };
	const usable = entries.filter((e) => e.value !== null);
	const coverage = entries.length ? round4(usable.length / entries.length) : 0;
	if (usable.length === 0) return { status: 'insufficient', value: null, entries: entries.length, used: 0, coverage };
	if (method === 'simple_mean') return { status: 'complete', value: round4(usable.reduce((sum, e) => sum + e.value!, 0) / usable.length), entries: entries.length, used: usable.length, coverage };
	const credits = usable.reduce((sum, e) => sum + e.credits, 0);
	if (credits <= 0) return { status: 'insufficient', value: null, entries: entries.length, used: usable.length, coverage };
	return { status: 'complete', value: round4(usable.reduce((sum, e) => sum + e.value! * e.credits, 0) / credits), entries: entries.length, used: usable.length, coverage };
}

export type ReferenceComparison = { differs: boolean; delta: number | null };

export function compareWithReference(calculated: number | null, reference: number | null, tolerance = 0.5): ReferenceComparison {
	if (calculated === null || reference === null) return { differs: false, delta: null };
	const delta = round4(calculated - reference);
	return { differs: Math.abs(delta) > tolerance, delta };
}
