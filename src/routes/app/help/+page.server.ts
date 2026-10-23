import { requireUser } from '#lib/features/auth/index.server.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	requireUser(locals);
	return {};
};
