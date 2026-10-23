import { activateSemester, closeSemester, createAcademicYear, createSemester, listAcademicYears } from '#lib/features/academic/index.server.ts';
import { requireRole } from '#lib/features/auth/index.server.ts';
import { db } from '#lib/shared/db/index.server.ts';
import { formValues, runAction } from '#lib/shared/http/action.server.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ years: await listAcademicYears(db) });

export const actions: Actions = {
	createYear: async ({ request, locals }) => {
		const actor = requireRole(locals, 'super_admin');
		const data = await request.formData();
		const result = await runAction(() => createAcademicYear(db, actor, Object.fromEntries(data)), formValues(data, ['startYear']));
		return result.ok ? { success: `Tahun akademik ${result.value.code} dibuat.` } : result.failure;
	},
	createSemester: async ({ request, locals }) => {
		const actor = requireRole(locals, 'super_admin');
		const data = await request.formData();
		const result = await runAction(() => createSemester(db, actor, Object.fromEntries(data)), formValues(data, ['academicYearId', 'term', 'startDate', 'endDate']));
		return result.ok ? { success: `Semester ${result.value.name} dibuat.` } : result.failure;
	},
	activate: async ({ request, locals }) => {
		const actor = requireRole(locals, 'super_admin');
		const data = await request.formData();
		const result = await runAction(() => activateSemester(db, actor, String(data.get('semesterId') ?? '')));
		return result.ok ? { success: `Semester ${result.value.name} kini aktif.` } : result.failure;
	},
	close: async ({ request, locals }) => {
		const actor = requireRole(locals, 'super_admin');
		const data = await request.formData();
		const result = await runAction(() => closeSemester(db, actor, String(data.get('semesterId') ?? '')));
		return result.ok ? { success: `Semester ${result.value.name} ditutup.` } : result.failure;
	}
};
