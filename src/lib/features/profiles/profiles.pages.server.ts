import type { Database } from '#lib/shared/db/client.server.ts';
import { requireRole } from '#lib/features/auth/index.server.ts';
import type { SessionUser } from '#lib/features/auth/index.ts';
import { getProgramBlueprint } from './profiles.queries.server.ts';

type Locals = { user: SessionUser | null };

export async function profilesIndexLoad(db: Database, { locals }: { locals: Locals }) {
	requireRole(locals, 'super_admin');
	return { blueprint: await getProgramBlueprint(db) };
}
