import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Database, DbExecutor } from '#lib/shared/db/client.server.ts';
import { NotFoundError } from '#lib/shared/http/errors.ts';
import { courseOfferings } from '#lib/features/academic/academic.schema.ts';
import { assessmentComponents, assessmentCpmkMappings, assessmentScores } from '#lib/features/assessment/assessment.schema.ts';
import { cplDefinitions, cpmkCplMappings, cpmkDefinitions, outcomePolicies } from '#lib/features/curriculum/curriculum.schema.ts';
import { enrollments } from '#lib/features/enrollments/enrollments.schema.ts';
import { cplResults, cpmkResults, outcomeCalculationRuns } from './outcomes.schema.ts';
import { computeCpl, computeCpmk, formulaVersion, type CalcComponent, type OutcomeValue } from './outcomes.calc.ts';

export type RecomputeResult = {
	runId: string | null;
	changed: boolean;
	enrollments: number;
	cpmk: { written: number; deleted: number };
	cpl: { written: number; deleted: number };
};

const sameValue = (a: number | null, b: number | null) => (a === null || b === null ? a === b : Math.abs(a - b) < 0.00005);

type Keyed = { enrollmentId: string; entityId: string; value: number | null; completeness: 'complete' | 'incomplete'; trace: OutcomeValue['trace']; missing: string[] };

export async function recomputeOffering(
	db: Database,
	actor: { id: string; role: string } | null,
	offeringId: string,
	trigger: string
): Promise<RecomputeResult> {
	const [offering] = await db.select({ id: courseOfferings.id, courseId: courseOfferings.courseId }).from(courseOfferings).where(eq(courseOfferings.id, offeringId)).limit(1);
	if (!offering) throw new NotFoundError('Penawaran kelas tidak ditemukan.');

	return db.transaction(async (tx) => {
		const [policy] = await tx.select().from(outcomePolicies).where(eq(outcomePolicies.status, 'active')).limit(1);
		const componentRows = await tx.select().from(assessmentComponents).where(and(eq(assessmentComponents.offeringId, offeringId), eq(assessmentComponents.isActive, true)));
		const calcComponents: CalcComponent[] = componentRows.map((c) => ({ id: c.id, code: c.code, weightPercent: c.weightPercent, maxScore: c.maxScore, isRequired: c.isRequired }));
		const cpmkRows = await tx.select().from(cpmkDefinitions).where(and(eq(cpmkDefinitions.courseId, offering.courseId), eq(cpmkDefinitions.isActive, true)));
		const cpmkIds = cpmkRows.map((c) => c.id);
		const componentMaps = componentRows.length && cpmkIds.length
			? await tx.select().from(assessmentCpmkMappings).where(and(inArray(assessmentCpmkMappings.componentId, componentRows.map((c) => c.id)), inArray(assessmentCpmkMappings.cpmkId, cpmkIds)))
			: [];
		const cplMaps = cpmkIds.length ? await tx.select().from(cpmkCplMappings).where(inArray(cpmkCplMappings.cpmkId, cpmkIds)) : [];
		const cplRows = cplMaps.length ? await tx.select().from(cplDefinitions).where(inArray(cplDefinitions.id, [...new Set(cplMaps.map((m) => m.cplId))])) : [];

		const enrollmentRows = await tx.select({ id: enrollments.id }).from(enrollments).where(eq(enrollments.offeringId, offeringId));
		const enrollmentIds = enrollmentRows.map((e) => e.id);
		const scoreRows = enrollmentIds.length && componentRows.length
			? await tx.select().from(assessmentScores).where(and(inArray(assessmentScores.enrollmentId, enrollmentIds), inArray(assessmentScores.componentId, componentRows.map((c) => c.id))))
			: [];
		const scoresByEnrollment = new Map<string, Record<string, number | null>>();
		for (const row of scoreRows) {
			const bucket = scoresByEnrollment.get(row.enrollmentId) ?? {};
			bucket[row.componentId] = row.score;
			scoresByEnrollment.set(row.enrollmentId, bucket);
		}

		const codeOfComponent = new Map(componentRows.map((c) => [c.id, c.code]));
		const cpmkMappings = cpmkRows
			.map((cpmk) => ({ cpmkId: cpmk.id, code: cpmk.code, components: componentMaps.filter((m) => m.cpmkId === cpmk.id).map((m) => ({ componentId: m.componentId, coefficient: m.coefficient })).sort((a, b) => (codeOfComponent.get(a.componentId) ?? '').localeCompare(codeOfComponent.get(b.componentId) ?? '')) }))
			.filter((m) => m.components.length > 0);
		const cplMappings = cplRows.map((cpl) => ({ cplId: cpl.id, code: cpl.code, cpk: cplMaps.filter((m) => m.cplId === cpl.id).map((m) => ({ cpmkId: m.cpmkId, weight: m.weight })) }));

		const computedCpmk: Keyed[] = [];
		const computedCpl: Keyed[] = [];
		for (const enrollmentId of enrollmentIds) {
			const scores = scoresByEnrollment.get(enrollmentId) ?? {};
			const byCpmk: Record<string, OutcomeValue> = {};
			for (const mapping of cpmkMappings) {
				const outcome = computeCpmk(mapping, calcComponents, scores);
				byCpmk[mapping.cpmkId] = outcome;
				if (outcome.status !== 'not_configured') computedCpmk.push({ enrollmentId, entityId: mapping.cpmkId, value: outcome.value, completeness: outcome.status === 'complete' ? 'complete' : 'incomplete', trace: outcome.trace, missing: [...outcome.missing, ...outcome.invalid] });
			}
			for (const mapping of cplMappings) {
				const outcome = computeCpl({ cplId: mapping.cplId, code: mapping.code, cpmk: mapping.cpk }, byCpmk);
				if (outcome.status !== 'not_configured') computedCpl.push({ enrollmentId, entityId: mapping.cplId, value: outcome.value, completeness: outcome.status === 'complete' ? 'complete' : 'incomplete', trace: outcome.trace, missing: outcome.missing });
			}
		}

		const existingCpmk = enrollmentIds.length ? await tx.select().from(cpmkResults).where(and(inArray(cpmkResults.enrollmentId, enrollmentIds), eq(cpmkResults.source, 'calculated'))) : [];
		const existingCpl = enrollmentIds.length ? await tx.select().from(cplResults).where(and(inArray(cplResults.enrollmentId, enrollmentIds), eq(cplResults.source, 'calculated'))) : [];
		const existingCpmkMap = new Map(existingCpmk.map((r) => [`${r.enrollmentId}:${r.cpmkId}`, r]));
		const existingCplMap = new Map(existingCpl.map((r) => [`${r.enrollmentId}:${r.cplId}`, r]));

		const changedCpmk = computedCpmk.filter((c) => {
			const prev = existingCpmkMap.get(`${c.enrollmentId}:${c.entityId}`);
			return !prev || !sameValue(prev.value, c.value) || prev.completeness !== c.completeness || prev.formulaVersion !== formulaVersion || prev.policyId !== (policy?.id ?? null);
		});
		const changedCpl = computedCpl.filter((c) => {
			const prev = existingCplMap.get(`${c.enrollmentId}:${c.entityId}`);
			return !prev || !sameValue(prev.value, c.value) || prev.completeness !== c.completeness || prev.formulaVersion !== formulaVersion || prev.policyId !== (policy?.id ?? null);
		});
		const keepCpmk = new Set(computedCpmk.map((c) => `${c.enrollmentId}:${c.entityId}`));
		const keepCpl = new Set(computedCpl.map((c) => `${c.enrollmentId}:${c.entityId}`));
		const staleCpmk = existingCpmk.filter((r) => !keepCpmk.has(`${r.enrollmentId}:${r.cpmkId}`));
		const staleCpl = existingCpl.filter((r) => !keepCpl.has(`${r.enrollmentId}:${r.cplId}`));

		const changed = changedCpmk.length + changedCpl.length + staleCpmk.length + staleCpl.length > 0;
		const result: RecomputeResult = { runId: null, changed, enrollments: enrollmentIds.length, cpmk: { written: changedCpmk.length, deleted: staleCpmk.length }, cpl: { written: changedCpl.length, deleted: staleCpl.length } };
		if (!changed) return result;

		const [run] = await tx
			.insert(outcomeCalculationRuns)
			.values({
				policyId: policy?.id ?? null,
				offeringId,
				trigger,
				formulaVersion,
				enrollmentsProcessed: enrollmentIds.length,
				actorId: actor?.id ?? null,
				summary: { cpmkWritten: changedCpmk.length, cpmkDeleted: staleCpmk.length, cplWritten: changedCpl.length, cplDeleted: staleCpl.length },
				finishedAt: new Date()
			})
			.returning({ id: outcomeCalculationRuns.id });
		result.runId = run.id;

		const stamp = { source: 'calculated' as const, formulaVersion, policyId: policy?.id ?? null, runId: run.id, computedAt: new Date() };
		for (const c of changedCpmk)
			await tx
				.insert(cpmkResults)
				.values({ enrollmentId: c.enrollmentId, cpmkId: c.entityId, value: c.value, completeness: c.completeness, inputs: { trace: c.trace, missing: c.missing }, ...stamp })
				.onConflictDoUpdate({ target: [cpmkResults.enrollmentId, cpmkResults.cpmkId, cpmkResults.source], set: { value: c.value, completeness: c.completeness, inputs: { trace: c.trace, missing: c.missing }, formulaVersion: stamp.formulaVersion, policyId: stamp.policyId, runId: stamp.runId, computedAt: stamp.computedAt } });
		for (const c of changedCpl)
			await tx
				.insert(cplResults)
				.values({ enrollmentId: c.enrollmentId, cplId: c.entityId, value: c.value, completeness: c.completeness, inputs: { trace: c.trace, missing: c.missing }, ...stamp })
				.onConflictDoUpdate({ target: [cplResults.enrollmentId, cplResults.cplId, cplResults.source], set: { value: c.value, completeness: c.completeness, inputs: { trace: c.trace, missing: c.missing }, formulaVersion: stamp.formulaVersion, policyId: stamp.policyId, runId: stamp.runId, computedAt: stamp.computedAt } });
		if (staleCpmk.length) await tx.delete(cpmkResults).where(inArray(cpmkResults.id, staleCpmk.map((r) => r.id)));
		if (staleCpl.length) await tx.delete(cplResults).where(inArray(cplResults.id, staleCpl.map((r) => r.id)));
		return result;
	});
}

export async function recomputeOfferings(db: Database, actor: { id: string; role: string } | null, offeringIds: string[], trigger: string) {
	const results: Record<string, RecomputeResult> = {};
	for (const id of new Set(offeringIds)) results[id] = await recomputeOffering(db, actor, id, trigger);
	return results;
}

export async function listReferenceDiscrepancies(db: DbExecutor, offeringId: string, tolerance = 0.5) {
	const rows = (await db.execute(sql`
		select 'cpmk' as kind, d.code as code, e.id as "enrollmentId", calc.value as calculated, ref.value as reference
		from cpmk_results calc
		join cpmk_results ref on ref.enrollment_id = calc.enrollment_id and ref.cpmk_id = calc.cpmk_id and ref.source = 'imported_reference'
		join enrollments e on e.id = calc.enrollment_id
		join cpmk_definitions d on d.id = calc.cpmk_id
		where calc.source = 'calculated' and e.offering_id = ${offeringId}::uuid and calc.value is not null and ref.value is not null
			and abs(calc.value - ref.value) > ${tolerance}
		union all
		select 'cpl', d.code, e.id, calc.value, ref.value
		from cpl_results calc
		join cpl_results ref on ref.enrollment_id = calc.enrollment_id and ref.cpl_id = calc.cpl_id and ref.source = 'imported_reference'
		join enrollments e on e.id = calc.enrollment_id
		join cpl_definitions d on d.id = calc.cpl_id
		where calc.source = 'calculated' and e.offering_id = ${offeringId}::uuid and calc.value is not null and ref.value is not null
			and abs(calc.value - ref.value) > ${tolerance}
		order by 1, 2`)) as unknown as { kind: 'cpmk' | 'cpl'; code: string; enrollmentId: string; calculated: number; reference: number }[];
	return rows.map((r) => ({ ...r, calculated: Number(r.calculated), reference: Number(r.reference), delta: Math.round((Number(r.calculated) - Number(r.reference)) * 10000) / 10000 }));
}
