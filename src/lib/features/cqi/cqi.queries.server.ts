import { and, asc, count, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import type { DbExecutor } from '#lib/shared/db/client.server.ts';
import { NotFoundError } from '#lib/shared/http/errors.ts';
import { accessibleOfferingIds } from '#lib/features/academic/index.server.ts';
import { courseOfferings, courses, semesters } from '#lib/features/academic/academic.schema.ts';
import { user } from '#lib/features/auth/auth.schema.ts';
import { appRoles } from '#lib/features/auth/index.ts';
import { cplDefinitions, cpmkDefinitions } from '#lib/features/curriculum/curriculum.schema.ts';
import { cqiActions, cqiEvaluations, cqiEvidence, cqiFindings } from './cqi.schema.ts';
import { allowedTransitions, transitionBlockers, type CqiActionStatus, type CqiStatus } from './cqi.workflow.ts';
import type { CqiActor } from './cqi.service.server.ts';

const findingIdRef = sql.raw('"cqi_findings"."id"');
const findingOfferingRef = sql.raw('"cqi_findings"."offering_id"');

const like = (value: string) => `%${value.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export const todayIso = (now = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(now);

async function visibility(db: DbExecutor, actor: CqiActor): Promise<SQL | undefined> {
	if (actor.role === appRoles.superAdmin) return undefined;
	const offerings = await accessibleOfferingIds(db, actor);
	const own = sql`exists (select 1 from ${cqiActions} a where a.finding_id = ${findingIdRef} and a.pic_user_id = ${actor.id})`;
	return offerings === 'all' || offerings.length === 0 ? own : or(inArray(cqiFindings.offeringId, offerings), own);
}

export type FindingFilters = { status?: CqiStatus; priority?: string; search?: string; page?: number; pageSize?: number };

export async function listFindings(db: DbExecutor, actor: CqiActor, filters: FindingFilters = {}, now = new Date()) {
	const pageSize = Math.min(100, Math.max(1, Math.trunc(filters.pageSize ?? 20)));
	const page = Math.max(1, Math.trunc(filters.page ?? 1));
	const today = todayIso(now);
	const scope = await visibility(db, actor);
	const where = and(
		scope,
		filters.status ? eq(cqiFindings.status, filters.status) : undefined,
		filters.priority ? eq(cqiFindings.priority, filters.priority as 'low') : undefined,
		filters.search ? or(ilike(cqiFindings.title, like(filters.search)), ilike(cqiFindings.code, like(filters.search))) : undefined
	);
	const [{ total }] = await db.select({ total: count() }).from(cqiFindings).where(where);
	const rows = await db
		.select({
			id: cqiFindings.id,
			code: cqiFindings.code,
			title: cqiFindings.title,
			priority: cqiFindings.priority,
			status: cqiFindings.status,
			createdAt: cqiFindings.createdAt,
			offeringLabel: sql<string | null>`(select c.code || ' · Kelas ' || o.section from ${courseOfferings} o join ${courses} c on c.id = o.course_id where o.id = ${findingOfferingRef})`,
			actionTotal: sql<number>`(select count(*)::int from ${cqiActions} a where a.finding_id = ${findingIdRef} and a.status <> 'cancelled')`,
			actionDone: sql<number>`(select count(*)::int from ${cqiActions} a where a.finding_id = ${findingIdRef} and a.status = 'done')`,
			actionOverdue: sql<number>`(select count(*)::int from ${cqiActions} a where a.finding_id = ${findingIdRef} and a.status in ('planned','in_progress') and a.due_date < ${today}::date)`
		})
		.from(cqiFindings)
		.where(where)
		.orderBy(sql`case ${cqiFindings.priority} when 'critical' then 0 when 'high' then 1 when 'medium' then 2 else 3 end`, desc(cqiFindings.createdAt))
		.limit(pageSize)
		.offset((page - 1) * pageSize);
	return { rows: rows.map((r) => ({ ...r, actionTotal: Number(r.actionTotal), actionDone: Number(r.actionDone), actionOverdue: Number(r.actionOverdue) })), total: Number(total), page, pageSize, pageCount: Math.max(1, Math.ceil(Number(total) / pageSize)) };
}

export async function getFindingDetail(db: DbExecutor, actor: CqiActor, findingId: string, now = new Date()) {
	if (!/^[0-9a-f-]{36}$/i.test(findingId)) throw new NotFoundError('Temuan tidak ditemukan.');
	const scope = await visibility(db, actor);
	const [finding] = await db.select().from(cqiFindings).where(and(eq(cqiFindings.id, findingId), scope)).limit(1);
	if (!finding) throw new NotFoundError('Temuan tidak ditemukan.');
	const today = todayIso(now);

	const [offering] = finding.offeringId
		? await db.select({ courseCode: courses.code, courseName: courses.name, section: courseOfferings.section }).from(courseOfferings).innerJoin(courses, eq(courses.id, courseOfferings.courseId)).where(eq(courseOfferings.id, finding.offeringId)).limit(1)
		: [];
	const [semester] = finding.semesterId ? await db.select({ name: semesters.name }).from(semesters).where(eq(semesters.id, finding.semesterId)).limit(1) : [];
	const [cpl] = finding.cplId ? await db.select({ code: cplDefinitions.code, title: cplDefinitions.title }).from(cplDefinitions).where(eq(cplDefinitions.id, finding.cplId)).limit(1) : [];
	const [cpmk] = finding.cpmkId ? await db.select({ code: cpmkDefinitions.code }).from(cpmkDefinitions).where(eq(cpmkDefinitions.id, finding.cpmkId)).limit(1) : [];

	const actionRows = await db
		.select({ action: cqiActions, picName: user.name })
		.from(cqiActions)
		.innerJoin(user, eq(user.id, cqiActions.picUserId))
		.where(eq(cqiActions.findingId, findingId))
		.orderBy(asc(cqiActions.dueDate), asc(cqiActions.createdAt));
	const evidenceRows = await db.select({ evidence: cqiEvidence, addedByName: user.name }).from(cqiEvidence).innerJoin(user, eq(user.id, cqiEvidence.addedBy)).where(eq(cqiEvidence.findingId, findingId)).orderBy(desc(cqiEvidence.createdAt));
	const evaluationRows = await db.select({ evaluation: cqiEvaluations, evaluatedByName: user.name }).from(cqiEvaluations).innerJoin(user, eq(user.id, cqiEvaluations.evaluatedBy)).where(eq(cqiEvaluations.findingId, findingId)).orderBy(desc(cqiEvaluations.evaluatedAt));

	const isAdmin = actor.role === appRoles.superAdmin;
	const context = { rootCause: finding.rootCause, actions: actionRows.map((a) => ({ status: a.action.status as CqiActionStatus })), evidenceCount: evidenceRows.length, evaluationCount: evaluationRows.length };
	return {
		finding,
		links: { offering: offering ? `${offering.courseCode} · ${offering.courseName} (Kelas ${offering.section})` : null, semester: semester?.name ?? null, cpl: cpl ? `${cpl.code} · ${cpl.title}` : null, cpmk: cpmk?.code ?? null },
		actions: actionRows.map(({ action, picName }) => ({
			...action,
			picName,
			overdue: (action.status === 'planned' || action.status === 'in_progress') && action.dueDate < today,
			canUpdate: isAdmin || action.picUserId === actor.id
		})),
		evidence: evidenceRows.map(({ evidence, addedByName }) => ({ ...evidence, addedByName })),
		evaluations: evaluationRows.map(({ evaluation, evaluatedByName }) => ({ ...evaluation, evaluatedByName })),
		transitions: isAdmin ? allowedTransitions(finding.status).map((to) => ({ to, blockers: transitionBlockers(finding.status, to, context) })) : [],
		canEdit: isAdmin,
		canAddEvidence: isAdmin || actionRows.some((a) => a.action.picUserId === actor.id)
	};
}

export async function listPicOptions(db: DbExecutor) {
	return db.select({ id: user.id, name: user.name, role: user.role }).from(user).where(and(eq(user.banned, false), inArray(user.role, [appRoles.lecturer, appRoles.superAdmin]))).orderBy(asc(user.name));
}
