import { redirect } from '@sveltejs/kit';
import { auth } from '#lib/features/auth/auth.server.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	await auth.api.signOut({ headers: request.headers });
	redirect(303, '/login');
};
