import { eq, like, max } from 'drizzle-orm';
import type { Database } from '#lib/shared/db/client.server.ts';
import { isForeignKeyViolation, isUniqueViolation } from '#lib/shared/db/errors.ts';
import { ConflictError, NotFoundError, ValidationError } from '#lib/shared/http/errors.ts';
import { parseOrThrow } from '#lib/shared/http/zod.ts';
import { courseOfferings } from '#lib/features/academic/academic.schema.ts';
import { recordAudit } from '#lib/features/audit/index.server.ts';
import { user } from '#lib/features/auth/auth.schema.ts';
import { appRoles } from '#lib/features/auth/index.ts';
import { cqiActions, cqiEvaluations, cqiEvidence, cqiFindings } from './cqi.schema.ts';
import { actionSchema, actionStatusSchema, evaluationSchema, evidenceSchema, findingSchema, findingUpdateSchema, statusSchema } from './cqi.validation.ts';
import { canActionTransition, isFinal, statusLabels, transitionBlockers, actionStatusLabels, type CqiActionStatus, type CqiStatus } from './cqi.workflow.ts';

export type CqiActor = { id: string; role: string };

const audit = (actor: CqiActor) => ({ actorId: actor.id, actorRole: actor.role });
const isAdmin = (actor: CqiActor) => actor.role === appRoles.superAdmin;

function assertAdmin(actor: CqiActor) {
	if (!isAdmin(actor)) throw new NotFoundError();
}

async function loadFinding(db: Database, findingId: string) {
	if (!/^[0-9a-f-]{36}$/i.test(findingId)) throw new NotFoundError('Temuan tidak ditemukan.');
	const [finding] = await db.select().from(cqiFindings).where(eq(cqiFindings.id, findingId)).limit(1);
	if (!finding) throw new NotFoundError('Temuan tidak ditemukan.');
	return finding;
}

function assertOpen(status: CqiStatus) {
	if (isFinal(status)) throw new ConflictError(`Temuan berstatus "${statusLabels[status]}" dan tidak dapat diubah lagi.`);
}

async function nextCode(db: Database, now: Date): Promise<string> {
	const prefix = `CQI-${now.getFullYear()}-`;
	const [{ latest }] = await db.select({ latest: max(cqiFindings.code) }).from(cqiFindings).where(like(cqiFindings.code, `${prefix}%`));
	const serial = latest ? Number(latest.slice(prefix.length)) + 1 : 1;
	return `${prefix}${String(serial).padStart(3, '0')}`;
}

export async function createFinding(db: Database, actor: CqiActor, input: unknown, now = new Date()) {
	assertAdmin(actor);
	const data = parseOrThrow(findingSchema, input);
	let semesterId = data.semesterId;
	if (data.offeringId && !semesterId) {
		const [offering] = await db.select({ semesterId: courseOfferings.semesterId }).from(courseOfferings).where(eq(courseOfferings.id, data.offeringId)).limit(1);
		semesterId = offering?.semesterId ?? null;
	}
	for (let attempt = 0; attempt < 4; attempt++) {
		try {
			const [row] = await db
				.insert(cqiFindings)
				.values({ ...data, semesterId, code: await nextCode(db, now), createdBy: actor.id })
				.returning();
			await recordAudit(db, { ...audit(actor), action: 'cqi.finding.create', entityType: 'cqi_finding', entityId: row.id, summary: `Temuan CQI ${row.code} dibuat`, after: { code: row.code, priority: row.priority, offeringId: row.offeringId, cplId: row.cplId, cpmkId: row.cpmkId } });
			return row;
		} catch (error) {
			if (isUniqueViolation(error)) continue;
			if (isForeignKeyViolation(error)) throw new ValidationError({ offeringId: ['Kelas, CPL, CPMK, atau semester yang dipilih tidak ditemukan'] });
			throw error;
		}
	}
	throw new ConflictError('Gagal membuat kode temuan unik. Coba lagi.');
}

export async function updateFinding(db: Database, actor: CqiActor, findingId: string, input: unknown) {
	assertAdmin(actor);
	const data = parseOrThrow(findingUpdateSchema, input);
	const before = await loadFinding(db, findingId);
	assertOpen(before.status);
	const [after] = await db.update(cqiFindings).set(data).where(eq(cqiFindings.id, findingId)).returning();
	await recordAudit(db, { ...audit(actor), action: 'cqi.finding.update', entityType: 'cqi_finding', entityId: findingId, summary: `Temuan ${after.code} diperbarui`, before: { priority: before.priority, rootCause: before.rootCause ? '(terisi)' : null }, after: { priority: after.priority, rootCause: after.rootCause ? '(terisi)' : null } });
	return after;
}

async function transitionTo(db: Database, actor: CqiActor, findingId: string, to: CqiStatus) {
	return db.transaction(async (tx) => {
		const executor = tx as unknown as Database;
		const [finding] = await executor.select().from(cqiFindings).where(eq(cqiFindings.id, findingId)).for('update').limit(1);
		if (!finding) throw new NotFoundError('Temuan tidak ditemukan.');
		const actions = await executor.select({ status: cqiActions.status }).from(cqiActions).where(eq(cqiActions.findingId, findingId));
		const evidence = await executor.select({ id: cqiEvidence.id }).from(cqiEvidence).where(eq(cqiEvidence.findingId, findingId));
		const evaluations = await executor.select({ id: cqiEvaluations.id }).from(cqiEvaluations).where(eq(cqiEvaluations.findingId, findingId));
		const blockers = transitionBlockers(finding.status, to, { rootCause: finding.rootCause, actions, evidenceCount: evidence.length, evaluationCount: evaluations.length });
		if (blockers.length) throw new ValidationError({ status: blockers }, blockers[0]);
		const [after] = await executor
			.update(cqiFindings)
			.set({ status: to, closedAt: isFinal(to) ? new Date() : null })
			.where(eq(cqiFindings.id, findingId))
			.returning();
		await recordAudit(executor, { ...audit(actor), action: 'cqi.finding.transition', entityType: 'cqi_finding', entityId: findingId, summary: `Temuan ${after.code}: ${statusLabels[finding.status]} -> ${statusLabels[to]}`, before: { status: finding.status }, after: { status: to } });
		return after;
	});
}

export async function addAction(db: Database, actor: CqiActor, findingId: string, input: unknown) {
	assertAdmin(actor);
	const data = parseOrThrow(actionSchema, input);
	const finding = await loadFinding(db, findingId);
	assertOpen(finding.status);
	const [pic] = await db.select({ id: user.id, banned: user.banned }).from(user).where(eq(user.id, data.picUserId)).limit(1);
	if (!pic || pic.banned) throw new ValidationError({ picUserId: ['Penanggung jawab tidak ditemukan atau tidak aktif'] });
	const [row] = await db.insert(cqiActions).values({ ...data, findingId }).returning();
	await recordAudit(db, { ...audit(actor), action: 'cqi.action.create', entityType: 'cqi_action', entityId: row.id, summary: `Tindakan ditambahkan pada ${finding.code}`, after: { findingId, dueDate: row.dueDate, picUserId: row.picUserId } });
	return row;
}

export async function updateActionStatus(db: Database, actor: CqiActor, actionId: string, nextStatus: unknown) {
	const to: CqiActionStatus = actionStatusSchema.parse(nextStatus);
	if (!/^[0-9a-f-]{36}$/i.test(actionId)) throw new NotFoundError('Tindakan tidak ditemukan.');
	const [action] = await db.select().from(cqiActions).where(eq(cqiActions.id, actionId)).limit(1);
	if (!action || (!isAdmin(actor) && action.picUserId !== actor.id)) throw new NotFoundError('Tindakan tidak ditemukan.');
	const finding = await loadFinding(db, action.findingId);
	assertOpen(finding.status);
	if (!canActionTransition(action.status, to)) throw new ValidationError({ status: [`Tindakan "${actionStatusLabels[action.status]}" tidak dapat diubah menjadi "${actionStatusLabels[to]}".`] });
	const [after] = await db.update(cqiActions).set({ status: to, completedAt: to === 'done' ? new Date() : null }).where(eq(cqiActions.id, actionId)).returning();
	await recordAudit(db, { ...audit(actor), action: 'cqi.action.status', entityType: 'cqi_action', entityId: actionId, summary: `Tindakan pada ${finding.code}: ${actionStatusLabels[action.status]} -> ${actionStatusLabels[to]}`, before: { status: action.status }, after: { status: to } });
	return after;
}

export async function addEvidence(db: Database, actor: CqiActor, findingId: string, input: unknown) {
	const data = parseOrThrow(evidenceSchema, input);
	const finding = await loadFinding(db, findingId);
	const actions = await db.select({ id: cqiActions.id, picUserId: cqiActions.picUserId }).from(cqiActions).where(eq(cqiActions.findingId, findingId));
	if (!isAdmin(actor) && !actions.some((a) => a.picUserId === actor.id)) throw new NotFoundError('Temuan tidak ditemukan.');
	assertOpen(finding.status);
	if (data.actionId && !actions.some((a) => a.id === data.actionId)) throw new ValidationError({ actionId: ['Tindakan bukan bagian dari temuan ini'] });
	const [row] = await db.insert(cqiEvidence).values({ ...data, findingId, addedBy: actor.id }).returning();
	await recordAudit(db, { ...audit(actor), action: 'cqi.evidence.add', entityType: 'cqi_evidence', entityId: row.id, summary: `Bukti ditambahkan pada ${finding.code}`, after: { findingId, hasUrl: row.url !== null } });
	return row;
}

export async function addEvaluation(db: Database, actor: CqiActor, findingId: string, input: unknown) {
	assertAdmin(actor);
	const data = parseOrThrow(evaluationSchema, input);
	const finding = await loadFinding(db, findingId);
	if (finding.status !== 'evaluating') throw new ConflictError('Evaluasi hanya dapat dicatat saat temuan berstatus "Evaluasi".');
	const [row] = await db.insert(cqiEvaluations).values({ ...data, findingId, evaluatedBy: actor.id }).returning();
	await recordAudit(db, { ...audit(actor), action: 'cqi.evaluation.add', entityType: 'cqi_evaluation', entityId: row.id, summary: `Evaluasi ditambahkan pada ${finding.code}`, after: { findingId, metricLabel: row.metricLabel, valueBefore: row.valueBefore, valueAfter: row.valueAfter } });
	return row;
}

export async function transitionFinding(db: Database, actor: CqiActor, findingId: string, target: unknown) {
	assertAdmin(actor);
	if (!/^[0-9a-f-]{36}$/i.test(findingId)) throw new NotFoundError('Temuan tidak ditemukan.');
	const parsed = statusSchema.safeParse(target);
	if (!parsed.success) throw new ValidationError({ status: ['Status tidak valid'] });
	return transitionTo(db, actor, findingId, parsed.data);
}
