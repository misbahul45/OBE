import { and, asc, count, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import type { DbExecutor } from '#lib/shared/db/client.server.ts';
import { lecturerAssignments } from '#lib/features/academic/academic.schema.ts';
import { user } from '#lib/features/auth/auth.schema.ts';
import { lecturers } from './lecturers.schema.ts';

export type LecturerFilters = { search?: string; status?: 'active' | 'inactive' | 'all'; page?: number; pageSize?: number };

const like = (value: string) => `%${value.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export async function listLecturers(db: DbExecutor, filters: LecturerFilters = {}) {
	const pageSize = Math.min(100, Math.max(1, Math.trunc(filters.pageSize ?? 20)));
	const page = Math.max(1, Math.trunc(filters.page ?? 1));
	const where: (SQL | undefined)[] = [
		filters.status === 'active' ? eq(user.banned, false) : filters.status === 'inactive' ? eq(user.banned, true) : undefined,
		filters.search ? or(ilike(user.name, like(filters.search)), ilike(user.email, like(filters.search)), ilike(lecturers.lecturerCode, like(filters.search))) : undefined
	];
	const [{ total }] = await db.select({ total: count() }).from(lecturers).innerJoin(user, eq(user.id, lecturers.userId)).where(and(...where));
	const rows = await db
		.select({
			id: lecturers.id,
			userId: user.id,
			name: user.name,
			email: user.email,
			lecturerCode: lecturers.lecturerCode,
			nidn: lecturers.nidn,
			banned: user.banned,
			mustChangePassword: user.mustChangePassword,
			assignmentCount: sql<number>`(select count(*)::int from ${lecturerAssignments} where ${lecturerAssignments.lecturerId} = ${lecturers.id})`
		})
		.from(lecturers)
		.innerJoin(user, eq(user.id, lecturers.userId))
		.where(and(...where))
		.orderBy(asc(user.name))
		.limit(pageSize)
		.offset((page - 1) * pageSize);
	return { rows: rows.map((r) => ({ ...r, banned: Boolean(r.banned), mustChangePassword: Boolean(r.mustChangePassword), assignmentCount: Number(r.assignmentCount) })), total: Number(total), page, pageSize, pageCount: Math.max(1, Math.ceil(Number(total) / pageSize)) };
}

export async function listLecturerOptions(db: DbExecutor) {
	return db
		.select({ id: lecturers.id, name: user.name, lecturerCode: lecturers.lecturerCode })
		.from(lecturers)
		.innerJoin(user, eq(user.id, lecturers.userId))
		.where(eq(user.banned, false))
		.orderBy(asc(user.name));
}
