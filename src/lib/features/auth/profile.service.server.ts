import { and, count, eq, gt } from 'drizzle-orm';
import type { Database } from '#lib/shared/db/client.server.ts';
import { courseOfferings, lecturerAssignments, lecturers, semesters, session, user } from '#lib/shared/db/schema.ts';
import { recordAudit } from '#lib/features/audit/index.server.ts';
import type { OwnProfile, SessionUser } from './auth.types.ts';
import { fieldErrorsOf, profileNameSchema, type FieldErrors } from './auth.validation.ts';

export type UpdateNameResult = { status: 'success'; name: string } | { status: 'invalid_input'; fieldErrors: FieldErrors } | { status: 'not_found' };

export async function getOwnProfile(db: Database, actor: SessionUser): Promise<OwnProfile | null> {
	const [account] = await db.select({ name: user.name, email: user.email, createdAt: user.createdAt, mustChangePassword: user.mustChangePassword }).from(user).where(eq(user.id, actor.id)).limit(1);
	if (!account) return null;
	const [sessions] = await db.select({ total: count() }).from(session).where(and(eq(session.userId, actor.id), gt(session.expiresAt, new Date())));
	const [lecturer] = await db.select({ id: lecturers.id, lecturerCode: lecturers.lecturerCode, nidn: lecturers.nidn }).from(lecturers).where(eq(lecturers.userId, actor.id)).limit(1);
	let activeClasses = 0;
	if (lecturer) {
		const [classes] = await db
			.select({ total: count() })
			.from(lecturerAssignments)
			.innerJoin(courseOfferings, eq(courseOfferings.id, lecturerAssignments.offeringId))
			.innerJoin(semesters, eq(semesters.id, courseOfferings.semesterId))
			.where(and(eq(lecturerAssignments.lecturerId, lecturer.id), eq(semesters.status, 'active')));
		activeClasses = classes?.total ?? 0;
	}
	return {
		name: account.name,
		email: account.email,
		role: actor.role,
		createdAt: account.createdAt,
		mustChangePassword: Boolean(account.mustChangePassword),
		activeSessions: sessions?.total ?? 0,
		lecturer: lecturer ? { lecturerCode: lecturer.lecturerCode, nidn: lecturer.nidn, activeClasses } : null
	};
}

export async function updateOwnName(db: Database, actor: SessionUser, rawInput: unknown): Promise<UpdateNameResult> {
	const parsed = profileNameSchema.safeParse(rawInput);
	if (!parsed.success) return { status: 'invalid_input', fieldErrors: fieldErrorsOf(parsed.error) };
	const [current] = await db.select({ name: user.name }).from(user).where(eq(user.id, actor.id)).limit(1);
	if (!current) return { status: 'not_found' };
	if (current.name === parsed.data.name) return { status: 'success', name: current.name };
	await db.update(user).set({ name: parsed.data.name }).where(eq(user.id, actor.id));
	await recordAudit(db, {
		actorId: actor.id,
		actorRole: actor.role,
		action: 'auth.profile.update',
		entityType: 'user',
		entityId: actor.id,
		summary: 'Pengguna mengubah nama tampilan sendiri',
		before: { name: current.name },
		after: { name: parsed.data.name }
	});
	return { status: 'success', name: parsed.data.name };
}
