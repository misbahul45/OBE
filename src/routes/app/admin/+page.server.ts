import { adminDashboard } from '#lib/features/dashboard/index.server.ts';
import { requireRole } from '#lib/features/auth/index.server.ts';
import { db } from '#lib/shared/db/index.server.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireRole(locals, 'super_admin');
	return adminDashboard(db, { id: user.id, role: user.role });
};
