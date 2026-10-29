import { eq, sql, type SQL } from 'drizzle-orm';
import type { Database, DbExecutor } from '#lib/shared/db/client.server.ts';
import { NotFoundError } from '#lib/shared/http/errors.ts';
import { recordAudit } from '#lib/features/audit/index.server.ts';
import { students } from './students.schema.ts';
import { defaultStudentPageSize, searchTokens, type SortDirection, type StudentSort } from './students.search.ts';

export type StudentScope = 'all' | string[];

export type StudentFilters = {
	search?: string;
	cohortYear?: number | 'unknown';
	semesterId?: string;
	courseId?: string;
	completeness?: 'complete' | 'incomplete';
	sort?: StudentSort;
	direction?: SortDirection;
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

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

function scopeClause(scope: StudentScope): SQL | undefined {
	if (scope === 'all') return undefined;
	if (scope.length === 0) return sql`false`;
	return sql`e.offering_id in (${sql.join(scope.map((id) => sql`${id}::uuid`), sql`, `)})`;
}

const sortColumns: Record<StudentSort, string> = { nama: 'g.name', nim: 'g.nim', angkatan: 'g."cohortYear"', matkul: 'g."enrollmentCount"' };

export async function listStudents(db: DbExecutor, scope: StudentScope, filters: StudentFilters = {}) {
	const tokens = searchTokens(filters.search);
	const first = await runList(db, scope, filters, tokens.length > 1 ? 'phrase' : 'tokens');
	if (first.total > 0 || tokens.length <= 1) return first;
	return runList(db, scope, filters, 'tokens');
}

async function runList(db: DbExecutor, scope: StudentScope, filters: StudentFilters, mode: 'phrase' | 'tokens') {
	const pageSize = Math.min(100, Math.max(1, Math.trunc(filters.pageSize ?? defaultStudentPageSize)));
	const requestedPage = Math.max(1, Math.trunc(filters.page ?? 1));
	const tokens = searchTokens(filters.search);
	const where: SQL[] = [];
	const scoped = scopeClause(scope);
	if (scoped) where.push(scoped);
	for (const needle of mode === 'phrase' ? [tokens.join(' ')] : tokens) {
		const pattern = `%${escapeLike(needle)}%`;
		where.push(sql`(s.name ilike ${pattern} or s.nim ilike ${pattern})`);
	}
	if (filters.cohortYear === 'unknown') where.push(sql`s.cohort_year is null`);
	else if (typeof filters.cohortYear === 'number') where.push(sql`s.cohort_year = ${filters.cohortYear}`);
	if (filters.semesterId) where.push(sql`o.semester_id = ${filters.semesterId}::uuid`);
	if (filters.courseId) where.push(sql`o.course_id = ${filters.courseId}::uuid`);
	const whereSql = where.length ? sql`where ${sql.join(where, sql` and `)}` : sql``;

	const phrase = escapeLike(tokens.join(' '));
	const rank = tokens.length
		? sql`case when s.nim = ${tokens.join(' ')} then 0 when s.nim ilike ${`${phrase}%`} then 1 when s.name ilike ${`${phrase}%`} then 2 when s.name ilike ${`% ${phrase}%`} then 3 else 4 end`
		: sql`0`;

	const needsCompleteness = filters.completeness !== undefined;
	const completenessJoin = needsCompleteness
		? sql`left join lateral (
			select
				count(*) filter (where c.is_required and c.is_active) as total,
				count(sc.id) filter (where c.is_required and c.is_active and sc.score is not null) as scored
			from assessment_components c
			left join assessment_scores sc on sc.component_id = c.id and sc.enrollment_id = e.id
			where c.offering_id = e.offering_id
		) comp on true`
		: sql``;
	const having =
		filters.completeness === 'complete'
			? sql`having count(distinct e.id) = count(distinct e.id) filter (where comp.total > 0 and comp.total = comp.scored)`
			: filters.completeness === 'incomplete'
				? sql`having count(distinct e.id) > count(distinct e.id) filter (where comp.total > 0 and comp.total = comp.scored)`
				: sql``;
	const completeSelect = needsCompleteness
		? sql`(count(distinct e.id) filter (where comp.total > 0 and comp.total = comp.scored))::int`
		: sql`(select count(*) from enrollments e2 where e2.student_id = s.id and not exists (select 1 from assessment_components c2 where c2.offering_id = e2.offering_id and c2.is_required and c2.is_active and not exists (select 1 from assessment_scores sc2 where sc2.component_id = c2.id and sc2.enrollment_id = e2.id and sc2.score is not null)) and exists (select 1 from assessment_components c3 where c3.offering_id = e2.offering_id and c3.is_required and c3.is_active))::int`;

	const grouped = sql`select s.id, s.nim, s.name, s.cohort_year as "cohortYear",
			count(distinct e.id)::int as "enrollmentCount",
			count(distinct o.semester_id)::int as "semesterCount",
			${completeSelect} as "completeEnrollments",
			${rank} as rank
		from students s
		join enrollments e on e.student_id = s.id
		join course_offerings o on o.id = e.offering_id
		${completenessJoin}
		${whereSql}
		group by s.id ${having}`;

	const sort = filters.sort;
	const direction = filters.direction === 'turun' ? 'desc' : 'asc';
	const orderBy = sort
		? sql.raw(`${sortColumns[sort]} ${direction}${sort === 'angkatan' ? ' nulls last' : ''}, g.name asc, g.nim asc`)
		: tokens.length
			? sql.raw('g.rank asc, g.name asc, g.nim asc')
			: sql.raw('g.name asc, g.nim asc');

	const fetchPage = async (target: number) =>
		(await db.execute(sql`select g.id, g.nim, g.name, g."cohortYear", g."enrollmentCount", g."semesterCount", g."completeEnrollments", (count(*) over())::int as total
			from (${grouped}) g order by ${orderBy} limit ${pageSize} offset ${(target - 1) * pageSize}`)) as unknown as (StudentListItem & { total: number })[];

	let page = requestedPage;
	let fetched = await fetchPage(page);
	let total = Number(fetched[0]?.total ?? 0);
	if (fetched.length === 0 && page > 1) {
		const counted = (await db.execute(sql`select count(*)::int as total from (${grouped}) g`)) as unknown as { total: number }[];
		total = Number(counted[0]?.total ?? 0);
		page = Math.max(1, Math.ceil(total / pageSize));
		fetched = total > 0 ? await fetchPage(page) : [];
	}
	const rows: StudentListItem[] = fetched.map(({ total: _total, ...row }) => {
		void _total;
		return row;
	});
	return { rows, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)), tokens, matched: mode };
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
