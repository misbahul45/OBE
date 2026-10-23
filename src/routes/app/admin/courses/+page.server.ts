import { createCourse, listCourses, setCourseActive, updateCourse } from '#lib/features/academic/index.server.ts';
import { requireRole } from '#lib/features/auth/index.server.ts';
import { db } from '#lib/shared/db/index.server.ts';
import { formValues, pageParam, runAction } from '#lib/shared/http/action.server.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const search = url.searchParams.get('cari')?.trim() ?? '';
	const list = await listCourses(db, { search: search || undefined, page: pageParam(url), pageSize: 15 });
	const editId = url.searchParams.get('ubah');
	return { ...list, search, editing: editId ? (list.rows.find((row) => row.id === editId) ?? null) : null };
};

const fields = ['code', 'name', 'credits', 'description'];

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const actor = requireRole(locals, 'super_admin');
		const data = await request.formData();
		const result = await runAction(() => createCourse(db, actor, Object.fromEntries(data)), formValues(data, fields));
		return result.ok ? { success: `Mata kuliah ${result.value.code} dibuat.` } : result.failure;
	},
	update: async ({ request, locals }) => {
		const actor = requireRole(locals, 'super_admin');
		const data = await request.formData();
		const result = await runAction(() => updateCourse(db, actor, String(data.get('id') ?? ''), Object.fromEntries(data)), formValues(data, fields));
		return result.ok ? { success: `Mata kuliah ${result.value.code} diperbarui.` } : result.failure;
	},
	toggle: async ({ request, locals }) => {
		const actor = requireRole(locals, 'super_admin');
		const data = await request.formData();
		const result = await runAction(() => setCourseActive(db, actor, String(data.get('id') ?? ''), data.get('active') === 'true'));
		return result.ok ? { success: `Mata kuliah ${result.value.code} ${result.value.isActive ? 'diaktifkan' : 'dinonaktifkan'}.` } : result.failure;
	}
};
