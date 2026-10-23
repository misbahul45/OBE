import { asc, desc, eq, inArray } from 'drizzle-orm';
import type { DbExecutor } from '#lib/shared/db/client.server.ts';
import { courses } from '#lib/features/academic/academic.schema.ts';
import { assessmentComponents, assessmentCpmkMappings } from '#lib/features/assessment/assessment.schema.ts';
import { cplDefinitions, cplTargets, courseCplMappings, cpmkCplMappings, cpmkDefinitions, outcomePolicies } from './curriculum.schema.ts';
import { componentWeightSummary } from './curriculum.validation.ts';

export const listCpl = (db: DbExecutor) => db.select().from(cplDefinitions).orderBy(asc(cplDefinitions.sortOrder), asc(cplDefinitions.code));

export const listCpmkByCourse = (db: DbExecutor, courseId: string) => db.select().from(cpmkDefinitions).where(eq(cpmkDefinitions.courseId, courseId)).orderBy(asc(cpmkDefinitions.code));

export async function listCourseCplMappings(db: DbExecutor, courseId: string) {
	return db
		.select({ id: courseCplMappings.id, cplId: cplDefinitions.id, cplCode: cplDefinitions.code, cplTitle: cplDefinitions.title, contribution: courseCplMappings.contribution, approvalSource: courseCplMappings.approvalSource })
		.from(courseCplMappings)
		.innerJoin(cplDefinitions, eq(cplDefinitions.id, courseCplMappings.cplId))
		.where(eq(courseCplMappings.courseId, courseId))
		.orderBy(asc(cplDefinitions.sortOrder));
}

export async function listCpmkCplMappings(db: DbExecutor, courseId: string) {
	return db
		.select({ id: cpmkCplMappings.id, cpmkId: cpmkDefinitions.id, cpmkCode: cpmkDefinitions.code, cplId: cplDefinitions.id, cplCode: cplDefinitions.code, weight: cpmkCplMappings.weight, approvedAt: cpmkCplMappings.approvedAt })
		.from(cpmkCplMappings)
		.innerJoin(cpmkDefinitions, eq(cpmkDefinitions.id, cpmkCplMappings.cpmkId))
		.innerJoin(cplDefinitions, eq(cplDefinitions.id, cpmkCplMappings.cplId))
		.where(eq(cpmkDefinitions.courseId, courseId))
		.orderBy(asc(cpmkDefinitions.code), asc(cplDefinitions.sortOrder));
}

export async function listComponents(db: DbExecutor, offeringId: string, tolerancePercent = 0.5) {
	const rows = await db.select().from(assessmentComponents).where(eq(assessmentComponents.offeringId, offeringId)).orderBy(asc(assessmentComponents.sortOrder), asc(assessmentComponents.code));
	const ids = rows.map((r) => r.id);
	const maps = ids.length
		? await db
				.select({ id: assessmentCpmkMappings.id, componentId: assessmentCpmkMappings.componentId, cpmkId: cpmkDefinitions.id, cpmkCode: cpmkDefinitions.code, coefficient: assessmentCpmkMappings.coefficient })
				.from(assessmentCpmkMappings)
				.innerJoin(cpmkDefinitions, eq(cpmkDefinitions.id, assessmentCpmkMappings.cpmkId))
				.where(inArray(assessmentCpmkMappings.componentId, ids))
		: [];
	return { components: rows.map((row) => ({ ...row, cpmkMappings: maps.filter((m) => m.componentId === row.id) })), weights: componentWeightSummary(rows, tolerancePercent) };
}

export async function getActivePolicy(db: DbExecutor) {
	const [policy] = await db.select().from(outcomePolicies).where(eq(outcomePolicies.status, 'active')).limit(1);
	if (!policy) return null;
	const targets = await db.select().from(cplTargets).where(eq(cplTargets.policyId, policy.id));
	return { ...policy, targets: Object.fromEntries(targets.map((t) => [t.cplId, t.target])) as Record<string, number> };
}

export async function listPolicies(db: DbExecutor) {
	const rows = await db.select().from(outcomePolicies).orderBy(desc(outcomePolicies.version));
	const targets = rows.length ? await db.select().from(cplTargets).where(inArray(cplTargets.policyId, rows.map((r) => r.id))) : [];
	return rows.map((row) => ({ ...row, targets: targets.filter((t) => t.policyId === row.id) }));
}

export async function listCoursesWithCpmkCounts(db: DbExecutor) {
	const list = await db.select({ id: courses.id, code: courses.code, name: courses.name }).from(courses).orderBy(asc(courses.code));
	const cpmk = await db.select({ courseId: cpmkDefinitions.courseId }).from(cpmkDefinitions);
	return list.map((course) => ({ ...course, cpmkCount: cpmk.filter((c) => c.courseId === course.id).length }));
}
