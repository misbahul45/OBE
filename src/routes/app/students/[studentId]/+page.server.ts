import { accessibleOfferingIds } from '#lib/features/academic/index.server.ts';
import { requireUser } from '#lib/features/auth/index.server.ts';
import { getStudentProfile } from '#lib/features/students/index.server.ts';
import { db } from '#lib/shared/db/index.server.ts';
import { orNotFound } from '#lib/shared/http/action.server.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const user = requireUser(locals);
	const scope = await accessibleOfferingIds(db, { id: user.id, role: user.role });
	const profile = await orNotFound(() => getStudentProfile(db, scope, params.studentId));
	return { profile, backHref: user.role === 'super_admin' ? '/app/admin/students' : '/app/lecturer/courses' };
};
