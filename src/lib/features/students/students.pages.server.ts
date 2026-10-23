import type { Database } from '#lib/shared/db/client.server.ts';
import { runAction } from '#lib/shared/http/action.server.ts';
import { pageParam } from '#lib/shared/http/action.server.ts';
import { listCourses, listSemesterOptions } from '#lib/features/academic/index.server.ts';
import { requireRole } from '#lib/features/auth/index.server.ts';
import type { SessionUser } from '#lib/features/auth/index.ts';
import { listCohortYears, listStudents, setStudentCohort, type StudentFilters } from './students.queries.server.ts';

type Locals = { user: SessionUser | null };

export async function studentDirectoryLoad(db: Database, { locals, url }: { locals: Locals; url: URL }) {
	requireRole(locals, 'super_admin');
	const search = url.searchParams.get('cari')?.trim() ?? '';
	const cohortParam = url.searchParams.get('angkatan') ?? '';
	const completenessParam = url.searchParams.get('kelengkapan') ?? '';
	const filters: StudentFilters = {
		search: search || undefined,
		cohortYear: cohortParam === 'unknown' ? 'unknown' : /^\d{4}$/.test(cohortParam) ? Number(cohortParam) : undefined,
		semesterId: url.searchParams.get('semester') || undefined,
		courseId: url.searchParams.get('matkul') || undefined,
		completeness: completenessParam === 'complete' || completenessParam === 'incomplete' ? completenessParam : undefined,
		page: pageParam(url),
		pageSize: 20
	};
	const [list, cohorts, semesters, courses] = await Promise.all([listStudents(db, 'all', filters), listCohortYears(db), listSemesterOptions(db), listCourses(db, { pageSize: 100 })]);
	return {
		...list,
		cohorts,
		semesters: semesters.map((s) => ({ id: s.id, name: s.name })),
		courses: courses.rows.map((c) => ({ id: c.id, label: `${c.code} · ${c.name}` })),
		query: { search, cohort: cohortParam, semester: filters.semesterId ?? '', course: filters.courseId ?? '', completeness: filters.completeness ?? '' }
	};
}

export function studentDirectoryActions(db: Database) {
	return {
		setCohort: async ({ request, locals }: { request: Request; locals: Locals }) => {
			const user = requireRole(locals, 'super_admin');
			const data = await request.formData();
			const raw = String(data.get('cohortYear') ?? '').trim();
			const year = raw === '' ? null : Number(raw);
			const result = await runAction(() => setStudentCohort(db, { id: user.id, role: user.role }, String(data.get('studentId') ?? ''), year));
			return result.ok ? { success: year === null ? 'Angkatan dikosongkan.' : `Angkatan ${year} disimpan.` } : result.failure;
		}
	};
}
