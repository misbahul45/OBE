import { auth } from '#lib/features/auth/auth.server.ts';
import { requireRole } from '#lib/features/auth/index.server.ts';
import { createLecturerAccount, deactivateLecturer, listLecturers, reactivateLecturer, resetLecturerPassword, updateLecturer } from '#lib/features/lecturers/index.server.ts';
import { db } from '#lib/shared/db/index.server.ts';
import { formValues, pageParam, runAction } from '#lib/shared/http/action.server.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const search = url.searchParams.get('cari')?.trim() ?? '';
	const statusParam = url.searchParams.get('status');
	const status = statusParam === 'active' || statusParam === 'inactive' ? statusParam : 'all';
	const list = await listLecturers(db, { search: search || undefined, status, page: pageParam(url), pageSize: 15 });
	const editId = url.searchParams.get('ubah');
	return { ...list, search, status, editing: editId ? (list.rows.find((row) => row.id === editId) ?? null) : null };
};

const fields = ['name', 'email', 'lecturerCode', 'nidn'];

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const actor = requireRole(locals, 'super_admin');
		const data = await request.formData();
		const result = await runAction(() => createLecturerAccount({ auth, db }, actor, Object.fromEntries(data)), formValues(data, fields));
		if (!result.ok) return result.failure;
		return { success: `Akun dosen ${result.value.email} dibuat. Salin password sementara sekarang; tidak akan ditampilkan lagi.`, temporaryPassword: result.value.temporaryPassword, temporaryEmail: result.value.email };
	},
	update: async ({ request, locals }) => {
		const actor = requireRole(locals, 'super_admin');
		const data = await request.formData();
		const result = await runAction(() => updateLecturer(db, actor, String(data.get('id') ?? ''), Object.fromEntries(data)), formValues(data, fields));
		return result.ok ? { success: 'Data dosen diperbarui.' } : result.failure;
	},
	deactivate: async ({ request, locals }) => {
		const actor = requireRole(locals, 'super_admin');
		const data = await request.formData();
		const result = await runAction(() => deactivateLecturer({ auth, db }, actor, String(data.get('id') ?? '')));
		return result.ok ? { success: 'Akun dosen dinonaktifkan dan seluruh sesinya dicabut.' } : result.failure;
	},
	reactivate: async ({ request, locals }) => {
		const actor = requireRole(locals, 'super_admin');
		const data = await request.formData();
		const result = await runAction(() => reactivateLecturer({ auth, db }, actor, String(data.get('id') ?? '')));
		return result.ok ? { success: 'Akun dosen diaktifkan kembali.' } : result.failure;
	},
	resetPassword: async ({ request, locals }) => {
		const actor = requireRole(locals, 'super_admin');
		const data = await request.formData();
		const result = await runAction(() => resetLecturerPassword({ auth, db }, actor, String(data.get('id') ?? '')));
		if (!result.ok) return result.failure;
		return { success: 'Password sementara baru diterbitkan. Salin sekarang; tidak akan ditampilkan lagi.', temporaryPassword: result.value.temporaryPassword, temporaryEmail: String(data.get('email') ?? '') };
	}
};
