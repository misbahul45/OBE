import { fail, redirect } from '@sveltejs/kit';
import { AUTH_RATE_LIMIT_ENABLED } from '$app/env/private';
import { auth } from '#lib/features/auth/auth.server.ts';
import { attemptLogin, homePathByRole, passwordChangePath, sanitizeNextPath } from '#lib/features/auth/index.server.ts';
import { db } from '#lib/shared/db/index.server.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, homePathByRole[locals.user.role]);
	return { next: sanitizeNextPath(url.searchParams.get('next')) };
};

export const actions: Actions = {
	default: async ({ request, getClientAddress }) => {
		const data = await request.formData();
		const email = String(data.get('email') ?? '');
		const next = sanitizeNextPath(String(data.get('next') ?? ''));
		let ip: string | null = null;
		try {
			ip = getClientAddress();
		} catch {
			ip = null;
		}

		const result = await attemptLogin({ auth, db }, { email, password: String(data.get('password') ?? '') }, { headers: request.headers, ip, rateLimit: AUTH_RATE_LIMIT_ENABLED ? undefined : false });

		switch (result.status) {
			case 'success':
				redirect(303, result.mustChangePassword ? passwordChangePath : (next ?? homePathByRole[result.role]));
			case 'invalid_input':
				return fail(400, { email, fieldErrors: result.fieldErrors });
			case 'disabled':
				return fail(403, { email, message: result.message });
			case 'rate_limited':
				return fail(429, { email, message: `Terlalu banyak percobaan masuk. Coba lagi dalam ${result.retryAfterSeconds} detik.` });
			case 'error':
				return fail(500, { email, message: 'Terjadi kesalahan pada server. Coba lagi beberapa saat.' });
			default:
				return fail(401, { email, message: 'Email atau password salah.' });
		}
	}
};
