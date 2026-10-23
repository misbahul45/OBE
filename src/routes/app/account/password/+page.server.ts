import { fail, redirect } from '@sveltejs/kit';
import { auth } from '#lib/features/auth/auth.server.ts';
import { changeOwnPassword, homePathByRole, requireUser } from '#lib/features/auth/index.server.ts';
import { db } from '#lib/shared/db/index.server.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const user = requireUser(locals);
	return { mustChange: user.mustChangePassword };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const user = requireUser(locals);
		const data = await request.formData();
		const result = await changeOwnPassword(
			{ auth, db },
			user,
			{ currentPassword: String(data.get('currentPassword') ?? ''), newPassword: String(data.get('newPassword') ?? ''), confirmPassword: String(data.get('confirmPassword') ?? '') },
			request.headers
		);
		if (result.status === 'invalid_input') return fail(400, { fieldErrors: result.fieldErrors });
		if (result.status === 'wrong_current') return fail(400, { fieldErrors: { currentPassword: ['Password saat ini tidak sesuai'] } });
		if (result.status === 'error') return fail(500, { message: 'Password tidak dapat diubah. Coba lagi beberapa saat.' });
		redirect(303, homePathByRole[user.role]);
	}
};
