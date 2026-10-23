import { assignLecturer, createOffering, listCourses, listOfferings, listSemesterOptions, removeAssignment } from '#lib/features/academic/index.server.ts';
import { requireRole } from '#lib/features/auth/index.server.ts';
import { listLecturerOptions } from '#lib/features/lecturers/index.server.ts';
import { db } from '#lib/shared/db/index.server.ts';
import { formValues, pageParam, runAction } from '#lib/shared/http/action.server.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const semesterId = url.searchParams.get('semester') || undefined;
	const search = url.searchParams.get('cari')?.trim() ?? '';
	const [offerings, semesters, courses, lecturers] = await Promise.all([
		listOfferings(db, { semesterId, search: search || undefined, page: pageParam(url), pageSize: 15 }),
		listSemesterOptions(db),
		listCourses(db, { onlyActive: true, pageSize: 100 }),
		listLecturerOptions(db)
	]);
	return { offerings, semesters, courses: courses.rows.map((c) => ({ id: c.id, label: `${c.code} · ${c.name}` })), lecturers, semesterId: semesterId ?? '', search };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const actor = requireRole(locals, 'super_admin');
		const data = await request.formData();
		const result = await runAction(() => createOffering(db, actor, Object.fromEntries(data)), formValues(data, ['courseId', 'semesterId', 'section']));
		return result.ok ? { success: `Penawaran kelas ${result.value.section} dibuat.` } : result.failure;
	},
	assign: async ({ request, locals }) => {
		const actor = requireRole(locals, 'super_admin');
		const data = await request.formData();
		const result = await runAction(() => assignLecturer(db, actor, Object.fromEntries(data)), formValues(data, ['offeringId', 'lecturerId', 'role']));
		return result.ok ? { success: 'Dosen ditugaskan.' } : result.failure;
	},
	unassign: async ({ request, locals }) => {
		const actor = requireRole(locals, 'super_admin');
		const data = await request.formData();
		const result = await runAction(() => removeAssignment(db, actor, String(data.get('assignmentId') ?? '')));
		return result.ok ? { success: 'Penugasan dicabut.' } : result.failure;
	}
};
