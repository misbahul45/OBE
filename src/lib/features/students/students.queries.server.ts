import { eq, sql, type SQL } from 'drizzle-orm';
import type { Database, DbExecutor } from '#lib/shared/db/client.server.ts';
import { NotFoundError } from '#lib/shared/http/errors.ts';
import { recordAudit } from '#lib/features/audit/index.server.ts';
import { students } from './students.schema.ts';

export type StudentScope = 'all' | string[];

export type StudentFilters = {
	search?: string;
	cohortYear?: number | 'unknown';
	semesterId?: string;
	courseId?: string;
	completeness?: 'complete' | 'incomplete';
	page?: number;
	pageSize?: number;
};

export type StudentListItem = {
	id: string;
	nim: string;
	name: string;
	cohortYear: number | null;
	enrollmentCount: number;
	semesterCount: number;
	completeEnrollments: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.trunc(value)));
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

function scopeClause(scope: StudentScope): SQL | undefined {
	if (scope === 'all') return undefined;
	if (scope.length === 0) return sql`false`;
	return sql`e.offering_id in (${sql.join(scope.map((id) => sql`${id}::uuid`), sql`, `)})`;
}

export async function listStudents(db: DbExecutor, scope: StudentScope, filters: StudentFilters = {}) {
	const pageSize = clamp(filters.pageSize ?? 25, 1, 100);
	const page = Math.max(1, Math.trunc(filters.page ?? 1));
	const where: SQL[] = [];
	const scoped = scopeClause(scope);
	if (scoped) where.push(scoped);
	if (filters.search) {
		const pattern = `%${escapeLike(filters.search.trim())}%`;
		where.push(sql`(s.name ilike ${pattern} or s.nim ilike ${pattern})`);
	}
	if (filters.cohortYear === 'unknown') where.push(sql`s.cohort_year is null`);
	else if (typeof filters.cohortYear === 'number') where.push(sql`s.cohort_year = ${filters.cohortYear}`);
	if (filters.semesterId) where.push(sql`o.semester_id = ${filters.semesterId}::uuid`);
	if (filters.courseId) where.push(sql`o.course_id = ${filters.courseId}::uuid`);
	const whereSql = where.length ? sql`where ${sql.join(where, sql` and `)}` : sql``;

	const base = sql`
		from students s
		join enrollments e on e.student_id = s.id
		join course_offerings o on o.id = e.offering_id
		left join lateral (
			select
				count(*) filter (where c.is_required and c.is_active) as total,
				count(sc.id) filter (where c.is_required and c.is_active and sc.score is not null) as scored
			from assessment_components c
			left join assessment_scores sc on sc.component_id = c.id and sc.enrollment_id = e.id
			where c.offering_id = e.offering_id
		) comp on true
		${whereSql}`;
	const having =
		filters.completeness === 'complete'
			? sql`having count(distinct e.id) = count(distinct e.id) filter (where comp.total > 0 and comp.total = comp.scored)`
			: filters.completeness === 'incomplete'
				? sql`having count(distinct e.id) > count(distinct e.id) filter (where comp.total > 0 and comp.total = comp.scored)`
				: sql``;

	const grouped = sql`select s.id, s.nim, s.name, s.cohort_year as "cohortYear",
			count(distinct e.id)::int as "enrollmentCount",
			count(distinct o.semester_id)::int as "semesterCount",
			(count(distinct e.id) filter (where comp.total > 0 and comp.total = comp.scored))::int as "completeEnrollments"
		${base} group by s.id ${having}`;

	const totalRows = (await db.execute(sql`select count(*)::int as total from (${grouped}) g`)) as unknown as { total: number }[];
	const rows = (await db.execute(sql`${grouped} order by s.name asc, s.nim asc limit ${pageSize} offset ${(page - 1) * pageSize}`)) as unknown as StudentListItem[];
	const total = Number(totalRows[0]?.total ?? 0);
	return { rows, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function canViewStudent(db: DbExecutor, scope: StudentScope, studentId: string): Promise<boolean> {
	if (scope === 'all') {
		const [row] = await db.select({ id: students.id }).from(students).where(eq(students.id, studentId)).limit(1);
		return !!row;
	}
	if (scope.length === 0) return false;
	const rows = (await db.execute(
		sql`select 1 from enrollments e where e.student_id = ${studentId}::uuid and e.offering_id in (${sql.join(scope.map((id) => sql`${id}::uuid`), sql`, `)}) limit 1`
	)) as unknown as unknown[];
	return rows.length > 0;
}

export async function assertCanViewStudent(db: DbExecutor, scope: StudentScope, studentId: string): Promise<void> {
	if (!(await canViewStudent(db, scope, studentId))) throw new NotFoundError();
}

export async function listCohortYears(db: DbExecutor): Promise<number[]> {
	const rows = (await db.execute(sql`select distinct cohort_year as year from students where cohort_year is not null order by cohort_year desc`)) as unknown as { year: number }[];
	return rows.map((r) => r.year);
}

export async function setStudentCohort(db: Database, actor: { id: string; role: string }, studentId: string, cohortYear: number | null) {
	if (cohortYear !== null && (!Number.isInteger(cohortYear) || cohortYear < 1990 || cohortYear > 2100)) throw new NotFoundError('Angkatan tidak valid.');
	const [before] = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
	if (!before) throw new NotFoundError('Mahasiswa tidak ditemukan.');
	await db.update(students).set({ cohortYear }).where(eq(students.id, studentId));
	await recordAudit(db, { actorId: actor.id, actorRole: actor.role, action: 'student.cohort_set', entityType: 'student', entityId: studentId, summary: 'Angkatan mahasiswa diperbarui', before: { cohortYear: before.cohortYear }, after: { cohortYear } });
}
