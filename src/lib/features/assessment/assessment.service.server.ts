import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '#lib/shared/db/client.server.ts';
import { NotFoundError, ValidationError } from '#lib/shared/http/errors.ts';
import { parseOrThrow } from '#lib/shared/http/zod.ts';
import { assertOfferingAccess } from '#lib/features/academic/index.server.ts';
import { removeAssessmentCpmkMapping, removeComponent, setAssessmentCpmkMapping, upsertComponent } from '#lib/features/curriculum/index.server.ts';
import { recomputeOffering, type RecomputeResult } from '#lib/features/outcomes/index.server.ts';
import { assessmentComponents, assessmentCpmkMappings } from './assessment.schema.ts';

export type AssessmentActor = { id: string; role: string };

const uuid = z.string().uuid();
const offeringIdOf = z.object({ offeringId: uuid });

async function offeringOfComponent(db: Database, componentId: string): Promise<string> {
	if (!uuid.safeParse(componentId).success) throw new NotFoundError('Komponen tidak ditemukan.');
	const [row] = await db.select({ offeringId: assessmentComponents.offeringId }).from(assessmentComponents).where(eq(assessmentComponents.id, componentId)).limit(1);
	if (!row) throw new NotFoundError('Komponen tidak ditemukan.');
	return row.offeringId;
}

export async function saveComponent(db: Database, actor: AssessmentActor, input: unknown) {
	const { offeringId } = parseOrThrow(offeringIdOf, { offeringId: (input as { offeringId?: unknown } | null)?.offeringId });
	await assertOfferingAccess(db, actor, offeringId);
	const component = await upsertComponent(db, actor, input);
	const recompute = await recomputeOffering(db, actor, offeringId, 'component_changed');
	return { component, recompute };
}

export async function deleteComponent(db: Database, actor: AssessmentActor, componentId: string) {
	const offeringId = await offeringOfComponent(db, componentId);
	await assertOfferingAccess(db, actor, offeringId);
	const result = await removeComponent(db, actor, componentId);
	const recompute = await recomputeOffering(db, actor, offeringId, 'component_removed');
	return { ...result, recompute };
}

export type CpmkSelection = { cpmkId: string; coefficient: number };

export async function setComponentCpmk(db: Database, actor: AssessmentActor, componentId: string, selections: CpmkSelection[]): Promise<RecomputeResult> {
	const offeringId = await offeringOfComponent(db, componentId);
	await assertOfferingAccess(db, actor, offeringId);
	const ids = selections.map((s) => s.cpmkId);
	if (new Set(ids).size !== ids.length) throw new ValidationError({ cpmkId: ['CPMK yang sama dipilih lebih dari sekali'] });
	const existing = await db.select().from(assessmentCpmkMappings).where(eq(assessmentCpmkMappings.componentId, componentId));
	for (const selection of selections) await setAssessmentCpmkMapping(db, actor, { componentId, cpmkId: selection.cpmkId, coefficient: selection.coefficient });
	const stale = existing.filter((m) => !ids.includes(m.cpmkId));
	for (const mapping of stale) await removeAssessmentCpmkMapping(db, actor, mapping.id);
	return recomputeOffering(db, actor, offeringId, 'mapping_changed');
}

export async function recomputeForActor(db: Database, actor: AssessmentActor, offeringId: string): Promise<RecomputeResult> {
	await assertOfferingAccess(db, actor, offeringId);
	return recomputeOffering(db, actor, offeringId, 'manual');
}
