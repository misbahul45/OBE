import { eq } from 'drizzle-orm';
import type { Database } from '#lib/shared/db/client.server.ts';
import { isUniqueViolation } from '#lib/shared/db/errors.ts';
import { NotFoundError, ValidationError } from '#lib/shared/http/errors.ts';
import { parseOrThrow } from '#lib/shared/http/zod.ts';
import { recordAudit } from '#lib/features/audit/index.server.ts';
import { generateTemporaryPassword, passwordIssues, type AppAuth } from '#lib/features/auth/index.server.ts';
import { session, user } from '#lib/features/auth/auth.schema.ts';
import { lecturers } from './lecturers.schema.ts';
import { lecturerSchema, lecturerUpdateSchema } from './lecturers.validation.ts';

export type LecturerActor = { id: string; role: string };
type Deps = { auth: AppAuth; db: Database };

const audit = (actor: LecturerActor) => ({ actorId: actor.id, actorRole: actor.role });

async function assertUnique(db: Database, field: 'lecturerCode' | 'nidn', value: string | null, exceptId?: string) {
	if (value === null) return;
	const column = field === 'lecturerCode' ? lecturers.lecturerCode : lecturers.nidn;
	const [row] = await db.select({ id: lecturers.id }).from(lecturers).where(eq(column, value)).limit(1);
	if (row && row.id !== exceptId) throw new ValidationError({ [field]: [field === 'nidn' ? 'NIDN sudah terdaftar' : 'Kode dosen sudah dipakai'] });
}

export type CreateLecturerOptions = { password?: string };

export async function createLecturerAccount(deps: Deps, actor: LecturerActor, input: unknown, options: CreateLecturerOptions = {}) {
	const data = parseOrThrow(lecturerSchema, input);
	if (options.password !== undefined) {
		const issues = passwordIssues(options.password);
		if (issues.length) throw new ValidationError({ password: issues });
	}
	const [existing] = await deps.db.select({ id: user.id }).from(user).where(eq(user.email, data.email)).limit(1);
	if (existing) throw new ValidationError({ email: ['Email sudah terdaftar'] });
	await assertUnique(deps.db, 'lecturerCode', data.lecturerCode);
	await assertUnique(deps.db, 'nidn', data.nidn);

	const temporaryPassword = options.password ?? generateTemporaryPassword(16);
	const created = await deps.auth.api.createUser({
		body: { email: data.email, password: temporaryPassword, name: data.name, role: 'lecturer', data: { mustChangePassword: true } }
	});
	try {
		const [lecturer] = await deps.db.insert(lecturers).values({ userId: created.user.id, lecturerCode: data.lecturerCode, nidn: data.nidn }).returning();
		await recordAudit(deps.db, {
			...audit(actor),
			action: 'lecturer.create',
			entityType: 'lecturer',
			entityId: lecturer.id,
			summary: `Akun dosen ${data.email} dibuat`,
			after: { userId: created.user.id, email: data.email, name: data.name, lecturerCode: data.lecturerCode, nidn: data.nidn, mustChangePassword: true }
		});
		return { lecturerId: lecturer.id, userId: created.user.id, email: data.email, temporaryPassword };
	} catch (error) {
		await deps.db.delete(user).where(eq(user.id, created.user.id));
		if (isUniqueViolation(error)) throw new ValidationError({ lecturerCode: ['Kode dosen atau NIDN sudah dipakai'] });
		throw error;
	}
}

export async function updateLecturer(db: Database, actor: LecturerActor, lecturerId: string, input: unknown) {
	const data = parseOrThrow(lecturerUpdateSchema, input);
	const [current] = await db.select({ lecturer: lecturers, name: user.name }).from(lecturers).innerJoin(user, eq(user.id, lecturers.userId)).where(eq(lecturers.id, lecturerId)).limit(1);
	if (!current) throw new NotFoundError('Dosen tidak ditemukan.');
	await assertUnique(db, 'lecturerCode', data.lecturerCode, lecturerId);
	await assertUnique(db, 'nidn', data.nidn, lecturerId);
	await db.transaction(async (tx) => {
		await tx.update(user).set({ name: data.name }).where(eq(user.id, current.lecturer.userId));
		await tx.update(lecturers).set({ lecturerCode: data.lecturerCode, nidn: data.nidn }).where(eq(lecturers.id, lecturerId));
		await recordAudit(tx, {
			...audit(actor),
			action: 'lecturer.update',
			entityType: 'lecturer',
			entityId: lecturerId,
			summary: 'Data dosen diperbarui',
			before: { name: current.name, lecturerCode: current.lecturer.lecturerCode, nidn: current.lecturer.nidn },
			after: data
		});
	});
}

async function setActive(deps: Deps, actor: LecturerActor, lecturerId: string, active: boolean) {
	const [row] = await deps.db.select().from(lecturers).where(eq(lecturers.id, lecturerId)).limit(1);
	if (!row) throw new NotFoundError('Dosen tidak ditemukan.');
	if (!active && row.userId === actor.id) throw new ValidationError({ form: ['Anda tidak dapat menonaktifkan akun sendiri'] });
	await deps.db.transaction(async (tx) => {
		await tx.update(user).set({ banned: !active, banReason: active ? null : 'Dinonaktifkan oleh Super Admin', banExpires: null }).where(eq(user.id, row.userId));
		if (!active) await tx.delete(session).where(eq(session.userId, row.userId));
		await recordAudit(tx, {
			...audit(actor),
			action: active ? 'lecturer.reactivate' : 'lecturer.deactivate',
			entityType: 'lecturer',
			entityId: lecturerId,
			summary: active ? 'Akun dosen diaktifkan kembali' : 'Akun dosen dinonaktifkan dan seluruh sesi dicabut',
			after: { banned: !active }
		});
	});
}

export const deactivateLecturer = (deps: Deps, actor: LecturerActor, lecturerId: string) => setActive(deps, actor, lecturerId, false);
export const reactivateLecturer = (deps: Deps, actor: LecturerActor, lecturerId: string) => setActive(deps, actor, lecturerId, true);

export async function resetLecturerPassword(deps: Deps, actor: LecturerActor, lecturerId: string) {
	const [row] = await deps.db.select().from(lecturers).where(eq(lecturers.id, lecturerId)).limit(1);
	if (!row) throw new NotFoundError('Dosen tidak ditemukan.');
	const temporaryPassword = generateTemporaryPassword(16);
	const context = await deps.auth.$context;
	const hashed = await context.password.hash(temporaryPassword);
	await deps.db.transaction(async (tx) => {
		await context.internalAdapter.updatePassword(row.userId, hashed);
		await tx.update(user).set({ mustChangePassword: true }).where(eq(user.id, row.userId));
		await tx.delete(session).where(eq(session.userId, row.userId));
		await recordAudit(tx, { ...audit(actor), action: 'lecturer.password_reset', entityType: 'lecturer', entityId: lecturerId, summary: 'Password sementara baru diterbitkan dan sesi dicabut', after: { mustChangePassword: true } });
	});
	return { temporaryPassword };
}

export async function findLecturerByUserId(db: Database, userId: string) {
	const [row] = await db.select().from(lecturers).where(eq(lecturers.userId, userId)).limit(1);
	return row ?? null;
}
