import type { Database } from '#lib/shared/db/client.server.ts';
import { pageParam } from '#lib/shared/http/action.server.ts';
import { getActiveSemester, listOfferings, listSemesterOptions } from '#lib/features/academic/index.server.ts';
import { requireRole } from '#lib/features/auth/index.server.ts';
import type { SessionUser } from '#lib/features/auth/index.ts';

type Locals = { user: SessionUser | null };

export async function reportsPageLoad(db: Database, { locals, url }: { locals: Locals; url: URL }) {
	requireRole(locals, 'super_admin');
	const semesters = await listSemesterOptions(db);
	const active = await getActiveSemester(db);
	const requested = url.searchParams.get('semester');
	const semesterId = semesters.some((s) => s.id === requested) ? (requested as string) : (active?.id ?? semesters[0]?.id);
	const search = url.searchParams.get('cari')?.trim() ?? '';
	const offerings = semesterId ? await listOfferings(db, { semesterId, search: search || undefined, page: pageParam(url), pageSize: 20 }) : { rows: [], total: 0, page: 1, pageSize: 20, pageCount: 1 };
	return {
		semesters: semesters.map((s) => ({ id: s.id, name: s.name })),
		semesterId: semesterId ?? '',
		search,
		rows: offerings.rows.map((o) => ({ id: o.id, courseCode: o.courseCode, courseName: o.courseName, section: o.section, students: o.enrollmentCount })),
		total: offerings.total,
		page: offerings.page,
		pageCount: offerings.pageCount
	};
}
