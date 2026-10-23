import { error, fail } from '@sveltejs/kit';
import { getOwnProfile, requireUser, updateOwnName } from '#lib/features/auth/index.server.ts';
import { db } from '#lib/shared/db/index.server.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals);
	const profile = await getOwnProfile(db, user);
	if (!profile) error(404, 'Akun tidak ditemukan.');
	return { profile };
};

export const actions: Actions = {
	name: async ({ request, locals }) => {
		const user = requireUser(locals);
		const data = await request.formData();
		const submitted = String(data.get('name') ?? '');
		const result = await updateOwnName(db, user, { name: submitted });
		if (result.status === 'invalid_input') return fail(400, { fieldErrors: result.fieldErrors, name: submitted });
		if (result.status === 'not_found') return fail(404, { message: 'Akun tidak ditemukan.', name: submitted });
		return { success: 'Nama tampilan disimpan.', name: result.name };
	}
};
