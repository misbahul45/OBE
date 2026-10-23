import { and, eq, max, ne } from 'drizzle-orm';
import type { Database } from '#lib/shared/db/client.server.ts';
import { isForeignKeyViolation, isUniqueViolation } from '#lib/shared/db/errors.ts';
import { ConflictError, NotFoundError, ValidationError } from '#lib/shared/http/errors.ts';
import { parseOrThrow } from '#lib/shared/http/zod.ts';
import { recordAudit } from '#lib/features/audit/index.server.ts';
import { courseOfferings } from '#lib/features/academic/academic.schema.ts';
import { assessmentComponents, assessmentCpmkMappings, assessmentScores } from '#lib/features/assessment/assessment.schema.ts';
import {
	cplDefinitions,
	cplTargets,
	courseCplMappings,
	cpmkCplMappings,
	cpmkDefinitions,
	outcomePolicies
} from './curriculum.schema.ts';
import {
	assessmentCpmkMappingSchema,
	componentSchema,
	courseCplMappingSchema,
	cplSchema,
	cplTargetSchema,
	cpmkCplMappingSchema,
	cpmkSchema,
	policySchema,
	type CurriculumActor
} from './curriculum.validation.ts';

const audit = (actor: CurriculumActor) => ({ actorId: actor.id, actorRole: actor.role });

export async function createCpl(db: Database, actor: CurriculumActor, input: unknown) {
	const data = parseOrThrow(cplSchema, input);
	try {
		const [row] = await db.insert(cplDefinitions).values(data).returning();
		await recordAudit(db, { ...audit(actor), action: 'cpl.create', entityType: 'cpl', entityId: row.id, summary: `${row.code} dibuat`, after: row });
		return row;
	} catch (error) {
		if (isUniqueViolation(error)) throw new ValidationError({ code: [`${data.code} sudah ada`] });
		throw error;
	}
}

export async function updateCpl(db: Database, actor: CurriculumActor, cplId: string, input: unknown) {
	const data = parseOrThrow(cplSchema, input);
	const [before] = await db.select().from(cplDefinitions).where(eq(cplDefinitions.id, cplId)).limit(1);
	if (!before) throw new NotFoundError('CPL tidak ditemukan.');
	try {
		const [after] = await db.update(cplDefinitions).set(data).where(eq(cplDefinitions.id, cplId)).returning();
		await recordAudit(db, { ...audit(actor), action: 'cpl.update', entityType: 'cpl', entityId: cplId, summary: `${after.code} diperbarui`, before, after });
		return after;
	} catch (error) {
		if (isUniqueViolation(error)) throw new ValidationError({ code: [`${data.code} sudah ada`] });
		throw error;
	}
}

export async function createCpmk(db: Database, actor: CurriculumActor, input: unknown) {
	const data = parseOrThrow(cpmkSchema, input);
	try {
		const [row] = await db.insert(cpmkDefinitions).values(data).returning();
		await recordAudit(db, { ...audit(actor), action: 'cpmk.create', entityType: 'cpmk', entityId: row.id, summary: `${row.code} dibuat`, after: row });
		return row;
	} catch (error) {
		if (isUniqueViolation(error)) throw new ValidationError({ code: [`${data.code} sudah ada untuk mata kuliah ini`] });
		if (isForeignKeyViolation(error)) throw new ValidationError({ courseId: ['Mata kuliah tidak ditemukan'] });
		throw error;
	}
}

export async function setCourseCplMapping(db: Database, actor: CurriculumActor, input: unknown) {
	const data = parseOrThrow(courseCplMappingSchema, input);
	try {
		const [row] = await db
			.insert(courseCplMappings)
			.values(data)
			.onConflictDoUpdate({ target: [courseCplMappings.courseId, courseCplMappings.cplId], set: { contribution: data.contribution, approvalSource: data.approvalSource } })
			.returning();
		await recordAudit(db, { ...audit(actor), action: 'course_cpl_mapping.set', entityType: 'course_cpl_mapping', entityId: row.id, summary: 'Pemetaan mata kuliah ke CPL disimpan', after: row });
		return row;
	} catch (error) {
		if (isForeignKeyViolation(error)) throw new ValidationError({ cplId: ['Mata kuliah atau CPL tidak ditemukan'] });
		throw error;
	}
}

export async function removeCourseCplMapping(db: Database, actor: CurriculumActor, mappingId: string) {
	const [row] = await db.delete(courseCplMappings).where(eq(courseCplMappings.id, mappingId)).returning();
	if (!row) throw new NotFoundError('Pemetaan tidak ditemukan.');
	await recordAudit(db, { ...audit(actor), action: 'course_cpl_mapping.delete', entityType: 'course_cpl_mapping', entityId: mappingId, summary: 'Pemetaan mata kuliah ke CPL dihapus', before: row });
}

export async function setCpmkCplMapping(db: Database, actor: CurriculumActor, input: unknown) {
	const data = parseOrThrow(cpmkCplMappingSchema, input);
	try {
		const [row] = await db
			.insert(cpmkCplMappings)
			.values({ ...data, approvedBy: actor.id, approvedAt: new Date() })
			.onConflictDoUpdate({ target: [cpmkCplMappings.cpmkId, cpmkCplMappings.cplId], set: { weight: data.weight, approvedBy: actor.id, approvedAt: new Date() } })
			.returning();
		await recordAudit(db, { ...audit(actor), action: 'cpmk_cpl_mapping.set', entityType: 'cpmk_cpl_mapping', entityId: row.id, summary: 'Pemetaan CPMK ke CPL disahkan', after: row });
		return row;
	} catch (error) {
		if (isForeignKeyViolation(error)) throw new ValidationError({ cplId: ['CPMK atau CPL tidak ditemukan'] });
		throw error;
	}
}

export async function removeCpmkCplMapping(db: Database, actor: CurriculumActor, mappingId: string) {
	const [row] = await db.delete(cpmkCplMappings).where(eq(cpmkCplMappings.id, mappingId)).returning();
	if (!row) throw new NotFoundError('Pemetaan tidak ditemukan.');
	await recordAudit(db, { ...audit(actor), action: 'cpmk_cpl_mapping.delete', entityType: 'cpmk_cpl_mapping', entityId: mappingId, summary: 'Pemetaan CPMK ke CPL dihapus', before: row });
}

export async function upsertComponent(db: Database, actor: CurriculumActor, input: unknown) {
	const data = parseOrThrow(componentSchema, input);
	const [existing] = await db.select().from(assessmentComponents).where(and(eq(assessmentComponents.offeringId, data.offeringId), eq(assessmentComponents.code, data.code))).limit(1);
	try {
		if (existing) {
			const [after] = await db.update(assessmentComponents).set({ name: data.name, type: data.type, weightPercent: data.weightPercent, maxScore: data.maxScore, isRequired: data.isRequired, isActive: true }).where(eq(assessmentComponents.id, existing.id)).returning();
			await recordAudit(db, { ...audit(actor), action: 'assessment_component.update', entityType: 'assessment_component', entityId: existing.id, summary: `Komponen ${data.code} diperbarui`, before: existing, after });
			return after;
		}
		const [row] = await db.insert(assessmentComponents).values(data).returning();
		await recordAudit(db, { ...audit(actor), action: 'assessment_component.create', entityType: 'assessment_component', entityId: row.id, summary: `Komponen ${data.code} dibuat`, after: row });
		return row;
	} catch (error) {
		if (isForeignKeyViolation(error)) throw new ValidationError({ offeringId: ['Penawaran kelas tidak ditemukan'] });
		throw error;
	}
}

export async function removeComponent(db: Database, actor: CurriculumActor, componentId: string) {
	const [component] = await db.select().from(assessmentComponents).where(eq(assessmentComponents.id, componentId)).limit(1);
	if (!component) throw new NotFoundError('Komponen tidak ditemukan.');
	const [scored] = await db.select({ id: assessmentScores.id }).from(assessmentScores).where(eq(assessmentScores.componentId, componentId)).limit(1);
	if (scored) {
		await db.update(assessmentComponents).set({ isActive: false }).where(eq(assessmentComponents.id, componentId));
		await recordAudit(db, { ...audit(actor), action: 'assessment_component.deactivate', entityType: 'assessment_component', entityId: componentId, summary: `Komponen ${component.code} dinonaktifkan karena sudah memiliki nilai`, before: { isActive: true }, after: { isActive: false } });
		return { removed: false, deactivated: true };
	}
	await db.delete(assessmentComponents).where(eq(assessmentComponents.id, componentId));
	await recordAudit(db, { ...audit(actor), action: 'assessment_component.delete', entityType: 'assessment_component', entityId: componentId, summary: `Komponen ${component.code} dihapus`, before: component });
	return { removed: true, deactivated: false };
}

export async function setAssessmentCpmkMapping(db: Database, actor: CurriculumActor, input: unknown) {
	const data = parseOrThrow(assessmentCpmkMappingSchema, input);
	const [component] = await db
		.select({ courseId: courseOfferings.courseId })
		.from(assessmentComponents)
		.innerJoin(courseOfferings, eq(courseOfferings.id, assessmentComponents.offeringId))
		.where(eq(assessmentComponents.id, data.componentId))
		.limit(1);
	const [cpmk] = await db.select({ courseId: cpmkDefinitions.courseId }).from(cpmkDefinitions).where(eq(cpmkDefinitions.id, data.cpmkId)).limit(1);
	if (!component) throw new ValidationError({ componentId: ['Komponen tidak ditemukan'] });
	if (!cpmk) throw new ValidationError({ cpmkId: ['CPMK tidak ditemukan'] });
	if (component.courseId !== cpmk.courseId) throw new ValidationError({ cpmkId: ['CPMK bukan milik mata kuliah dari kelas ini'] });
	try {
		const [row] = await db
			.insert(assessmentCpmkMappings)
			.values({ ...data, approvedBy: actor.id })
			.onConflictDoUpdate({ target: [assessmentCpmkMappings.componentId, assessmentCpmkMappings.cpmkId], set: { coefficient: data.coefficient, approvedBy: actor.id } })
			.returning();
		await recordAudit(db, { ...audit(actor), action: 'assessment_cpmk_mapping.set', entityType: 'assessment_cpmk_mapping', entityId: row.id, summary: 'Pemetaan komponen ke CPMK disimpan', after: row });
		return row;
	} catch (error) {
		if (isForeignKeyViolation(error)) throw new ValidationError({ cpmkId: ['Komponen atau CPMK tidak ditemukan'] });
		throw error;
	}
}

export async function removeAssessmentCpmkMapping(db: Database, actor: CurriculumActor, mappingId: string) {
	const [row] = await db.delete(assessmentCpmkMappings).where(eq(assessmentCpmkMappings.id, mappingId)).returning();
	if (!row) throw new NotFoundError('Pemetaan tidak ditemukan.');
	await recordAudit(db, { ...audit(actor), action: 'assessment_cpmk_mapping.delete', entityType: 'assessment_cpmk_mapping', entityId: mappingId, summary: 'Pemetaan komponen ke CPMK dihapus', before: row });
}

export async function createDraftPolicy(db: Database, actor: CurriculumActor, input: unknown) {
	const data = parseOrThrow(policySchema, input);
	return db.transaction(async (tx) => {
		const [{ latest }] = await tx.select({ latest: max(outcomePolicies.version) }).from(outcomePolicies);
		const [row] = await tx.insert(outcomePolicies).values({ ...data, version: (latest ?? 0) + 1, status: 'draft' }).returning();
		await recordAudit(tx, { ...audit(actor), action: 'outcome_policy.create', entityType: 'outcome_policy', entityId: row.id, summary: `Kebijakan OBE versi ${row.version} (draft) dibuat`, after: row });
		return row;
	});
}

export async function cloneActivePolicyAsDraft(db: Database, actor: CurriculumActor) {
	return db.transaction(async (tx) => {
		const [active] = await tx.select().from(outcomePolicies).where(eq(outcomePolicies.status, 'active')).limit(1);
		if (!active) throw new NotFoundError('Belum ada kebijakan aktif untuk disalin.');
		const [{ latest }] = await tx.select({ latest: max(outcomePolicies.version) }).from(outcomePolicies);
		const { id: _id, createdAt: _c, updatedAt: _u, approvedBy: _a, approvedAt: _aa, ...settings } = active;
		const [draft] = await tx.insert(outcomePolicies).values({ ...settings, version: (latest ?? 0) + 1, status: 'draft', name: `${active.name} (salinan)` }).returning();
		const targets = await tx.select().from(cplTargets).where(eq(cplTargets.policyId, active.id));
		if (targets.length) await tx.insert(cplTargets).values(targets.map((t) => ({ policyId: draft.id, cplId: t.cplId, target: t.target })));
		await recordAudit(tx, { ...audit(actor), action: 'outcome_policy.clone', entityType: 'outcome_policy', entityId: draft.id, summary: `Kebijakan versi ${active.version} disalin menjadi draft versi ${draft.version}`, after: { from: active.id, targets: targets.length } });
		return draft;
	});
}

async function draftPolicy(db: Database, policyId: string) {
	const [policy] = await db.select().from(outcomePolicies).where(eq(outcomePolicies.id, policyId)).limit(1);
	if (!policy) throw new NotFoundError('Kebijakan tidak ditemukan.');
	if (policy.status !== 'draft') throw new ConflictError('Kebijakan aktif atau pensiun tidak dapat diubah; salin menjadi draft baru.');
	return policy;
}

export async function updateDraftPolicy(db: Database, actor: CurriculumActor, policyId: string, input: unknown) {
	const data = parseOrThrow(policySchema, input);
	const before = await draftPolicy(db, policyId);
	const [after] = await db.update(outcomePolicies).set(data).where(eq(outcomePolicies.id, policyId)).returning();
	await recordAudit(db, { ...audit(actor), action: 'outcome_policy.update', entityType: 'outcome_policy', entityId: policyId, summary: `Kebijakan versi ${after.version} diperbarui`, before, after });
	return after;
}

export async function setCplTarget(db: Database, actor: CurriculumActor, input: unknown) {
	const data = parseOrThrow(cplTargetSchema, input);
	await draftPolicy(db, data.policyId);
	try {
		const [row] = await db
			.insert(cplTargets)
			.values(data)
			.onConflictDoUpdate({ target: [cplTargets.policyId, cplTargets.cplId], set: { target: data.target } })
			.returning();
		await recordAudit(db, { ...audit(actor), action: 'cpl_target.set', entityType: 'cpl_target', entityId: row.id, summary: 'Target CPL disimpan', after: row });
		return row;
	} catch (error) {
		if (isForeignKeyViolation(error)) throw new ValidationError({ cplId: ['CPL tidak ditemukan'] });
		throw error;
	}
}

export async function activatePolicy(db: Database, actor: CurriculumActor, policyId: string) {
	return db.transaction(async (tx) => {
		const policy = await draftPolicy(tx as unknown as Database, policyId);
		const retired = await tx.update(outcomePolicies).set({ status: 'retired' }).where(and(eq(outcomePolicies.status, 'active'), ne(outcomePolicies.id, policyId))).returning({ id: outcomePolicies.id, version: outcomePolicies.version });
		const [activated] = await tx
			.update(outcomePolicies)
			.set({ status: 'active', approvedBy: actor.id, approvedAt: new Date(), effectiveFrom: new Date().toISOString().slice(0, 10) })
			.where(eq(outcomePolicies.id, policyId))
			.returning();
		await recordAudit(tx, {
			...audit(actor),
			action: 'outcome_policy.activate',
			entityType: 'outcome_policy',
			entityId: policyId,
			summary: `Kebijakan OBE versi ${policy.version} diaktifkan`,
			before: { retired: retired.map((r) => r.version) },
			after: { status: 'active', aggregationMethod: activated.aggregationMethod }
		});
		return activated;
	});
}
