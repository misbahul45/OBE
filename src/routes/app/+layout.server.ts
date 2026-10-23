import { requireUser } from '#lib/features/auth/index.server.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({ user: requireUser(locals) });
