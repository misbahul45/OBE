import { and, eq } from 'drizzle-orm';
import type { DbExecutor } from '#lib/shared/db/client.server.ts';
import { NotFoundError } from '#lib/shared/http/errors.ts';
import { appRoles } from '#lib/features/auth/index.ts';
import { lecturers } from '#lib/features/lecturers/lecturers.schema.ts';
import { lecturerAssignments } from './academic.schema.ts';

export type AccessActor = { id: string; role: string };

export async function lecturerIdOf(db: DbExecutor, userId: string): Promise<string | null> {
	const [row] = await db.select({ id: lecturers.id }).from(lecturers).where(eq(lecturers.userId, userId)).limit(1);
	return row?.id ?? null;
}

export async function canAccessOffering(db: DbExecutor, actor: AccessActor, offeringId: string): Promise<boolean> {
	if (actor.role === appRoles.superAdmin) return true;
	if (actor.role !== appRoles.lecturer) return false;
	const lecturerId = await lecturerIdOf(db, actor.id);
	if (!lecturerId) return false;
	const [row] = await db
		.select({ id: lecturerAssignments.id })
		.from(lecturerAssignments)
		.where(and(eq(lecturerAssignments.offeringId, offeringId), eq(lecturerAssignments.lecturerId, lecturerId)))
		.limit(1);
	return !!row;
}

export async function assertOfferingAccess(db: DbExecutor, actor: AccessActor, offeringId: string): Promise<void> {
	if (!(await canAccessOffering(db, actor, offeringId))) throw new NotFoundError();
}

export async function accessibleOfferingIds(db: DbExecutor, actor: AccessActor): Promise<string[] | 'all'> {
	if (actor.role === appRoles.superAdmin) return 'all';
	const lecturerId = actor.role === appRoles.lecturer ? await lecturerIdOf(db, actor.id) : null;
	if (!lecturerId) return [];
	const rows = await db.select({ offeringId: lecturerAssignments.offeringId }).from(lecturerAssignments).where(eq(lecturerAssignments.lecturerId, lecturerId));
	return rows.map((row) => row.offeringId);
}
