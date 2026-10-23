import { desc, sql } from 'drizzle-orm';
import type { Database } from '#lib/shared/db/client.server.ts';
import { pageParam } from '#lib/shared/http/action.server.ts';
import { requireRole } from '#lib/features/auth/index.server.ts';
import type { SessionUser } from '#lib/features/auth/index.ts';
import { auditLogs } from './audit.schema.ts';
import { listAuditLogs } from './audit.queries.server.ts';

type Locals = { user: SessionUser | null };

export async function auditPageLoad(db: Database, { locals, url }: { locals: Locals; url: URL }) {
	requireRole(locals, 'super_admin');
	const search = url.searchParams.get('cari')?.trim() ?? '';
	const entityType = url.searchParams.get('entitas') ?? '';
	const list = await listAuditLogs(db, { search: search || undefined, entityType: entityType || undefined, page: pageParam(url), pageSize: 25 });
	const entities = await db.select({ entityType: auditLogs.entityType, n: sql<number>`count(*)::int` }).from(auditLogs).groupBy(auditLogs.entityType).orderBy(desc(sql`count(*)`));
	return { ...list, search, entityType, entities: entities.map((e) => e.entityType) };
}
