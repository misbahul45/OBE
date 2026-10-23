import { and, asc, count, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import type { DbExecutor } from '#lib/shared/db/client.server.ts';
import { user } from '#lib/features/auth/auth.schema.ts';
import { enrollments } from '#lib/features/enrollments/enrollments.schema.ts';
import { lecturers } from '#lib/features/lecturers/lecturers.schema.ts';
import { academicYears, courseOfferings, courses, lecturerAssignments, semesters } from './academic.schema.ts';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.trunc(value)));
const like = (value: string) => `%${value.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export type Paging = { page?: number; pageSize?: number };

function paging(input: Paging) {
	const pageSize = clamp(input.pageSize ?? 20, 1, 100);
	const page = Math.max(1, Math.trunc(input.page ?? 1));
	return { page, pageSize, offset: (page - 1) * pageSize };
}

export async function listAcademicYears(db: DbExecutor) {
	const years = await db.select().from(academicYears).orderBy(desc(academicYears.startYear));
	const terms = await db.select().from(semesters).orderBy(asc(semesters.startDate));
	return years.map((year) => ({ ...year, semesters: terms.filter((term) => term.academicYearId === year.id) }));
}

export async function getActiveSemester(db: DbExecutor) {
	const [row] = await db.select().from(semesters).where(eq(semesters.status, 'active')).limit(1);
	return row ?? null;
}

export async function listSemesterOptions(db: DbExecutor) {
	return db.select({ id: semesters.id, name: semesters.name, status: semesters.status }).from(semesters).orderBy(desc(semesters.startDate));
}

export async function listCourses(db: DbExecutor, filters: Paging & { search?: string; onlyActive?: boolean } = {}) {
	const { page, pageSize, offset } = paging(filters);
	const where: (SQL | undefined)[] = [
		filters.onlyActive ? eq(courses.isActive, true) : undefined,
		filters.search ? or(ilike(courses.code, like(filters.search)), ilike(courses.name, like(filters.search))) : undefined
	];
	const [{ total }] = await db.select({ total: count() }).from(courses).where(and(...where));
	const rows = await db.select().from(courses).where(and(...where)).orderBy(asc(courses.code)).limit(pageSize).offset(offset);
	return { rows, total: Number(total), page, pageSize, pageCount: Math.max(1, Math.ceil(Number(total) / pageSize)) };
}

export type OfferingFilters = Paging & { semesterId?: string; search?: string; accessible?: string[] | 'all' };

export async function listOfferings(db: DbExecutor, filters: OfferingFilters = {}) {
	const { page, pageSize, offset } = paging(filters);
	if (filters.accessible !== undefined && filters.accessible !== 'all' && filters.accessible.length === 0) return { rows: [], total: 0, page, pageSize, pageCount: 1 };
	const where: (SQL | undefined)[] = [
		filters.semesterId ? eq(courseOfferings.semesterId, filters.semesterId) : undefined,
		filters.accessible && filters.accessible !== 'all' ? inArray(courseOfferings.id, filters.accessible) : undefined,
		filters.search ? or(ilike(courses.code, like(filters.search)), ilike(courses.name, like(filters.search))) : undefined
	];
	const base = db.select({ total: count() }).from(courseOfferings).innerJoin(courses, eq(courses.id, courseOfferings.courseId)).where(and(...where));
	const [{ total }] = await base;
	const rows = await db
		.select({
			id: courseOfferings.id,
			section: courseOfferings.section,
			status: courseOfferings.status,
			courseId: courses.id,
			courseCode: courses.code,
			courseName: courses.name,
			credits: courses.credits,
			semesterId: semesters.id,
			semesterName: semesters.name,
			semesterStatus: semesters.status,
			enrollmentCount: sql<number>`(select count(*)::int from ${enrollments} where ${enrollments.offeringId} = ${courseOfferings.id})`
		})
		.from(courseOfferings)
		.innerJoin(courses, eq(courses.id, courseOfferings.courseId))
		.innerJoin(semesters, eq(semesters.id, courseOfferings.semesterId))
		.where(and(...where))
		.orderBy(desc(semesters.startDate), asc(courses.code), asc(courseOfferings.section))
		.limit(pageSize)
		.offset(offset);
	const ids = rows.map((row) => row.id);
	const assigned = ids.length
		? await db
				.select({ assignmentId: lecturerAssignments.id, offeringId: lecturerAssignments.offeringId, lecturerId: lecturers.id, name: user.name, role: lecturerAssignments.role })
				.from(lecturerAssignments)
				.innerJoin(lecturers, eq(lecturers.id, lecturerAssignments.lecturerId))
				.innerJoin(user, eq(user.id, lecturers.userId))
				.where(inArray(lecturerAssignments.offeringId, ids))
		: [];
	return {
		rows: rows.map((row) => ({ ...row, enrollmentCount: Number(row.enrollmentCount), lecturers: assigned.filter((a) => a.offeringId === row.id) })),
		total: Number(total),
		page,
		pageSize,
		pageCount: Math.max(1, Math.ceil(Number(total) / pageSize))
	};
}

export async function getOffering(db: DbExecutor, offeringId: string) {
	const list = await listOfferings(db, { accessible: [offeringId], pageSize: 1 });
	return list.rows[0] ?? null;
}
