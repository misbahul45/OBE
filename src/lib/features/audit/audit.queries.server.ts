import { and, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import type { DbExecutor } from '#lib/shared/db/client.server.ts';
import { user } from '#lib/features/auth/auth.schema.ts';
import { auditLogs } from './audit.schema.ts';

export type AuditQuery = {
	page?: number;
	pageSize?: number;
	entityType?: string;
	action?: string;
	actorId?: string;
	batchId?: string;
	search?: string;
};

export type AuditListItem = {
	id: string;
	createdAt: Date;
	action: string;
	entityType: string;
	entityId: string | null;
	summary: string;
	actorId: string | null;
	actorName: string | null;
	actorRole: string | null;
	batchId: string | null;
	before: unknown;
	after: unknown;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.trunc(value)));
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function listAuditLogs(executor: DbExecutor, query: AuditQuery = {}) {
	const pageSize = clamp(query.pageSize ?? 25, 1, 100);
	const page = Math.max(1, Math.trunc(query.page ?? 1));
	const filters: (SQL | undefined)[] = [
		query.entityType ? eq(auditLogs.entityType, query.entityType) : undefined,
		query.action ? eq(auditLogs.action, query.action) : undefined,
		query.actorId ? eq(auditLogs.actorId, query.actorId) : undefined,
		query.batchId ? eq(auditLogs.batchId, query.batchId) : undefined,
		query.search ? or(ilike(auditLogs.summary, `%${escapeLike(query.search)}%`), ilike(auditLogs.action, `%${escapeLike(query.search)}%`)) : undefined
	];
	const where = and(...filters);
	const [{ total }] = await executor.select({ total: count() }).from(auditLogs).where(where);
	const rows = await executor
		.select({
			id: auditLogs.id,
			createdAt: auditLogs.createdAt,
			action: auditLogs.action,
			entityType: auditLogs.entityType,
			entityId: auditLogs.entityId,
			summary: auditLogs.summary,
			actorId: auditLogs.actorId,
			actorName: user.name,
			actorRole: auditLogs.actorRole,
			batchId: auditLogs.batchId,
			before: auditLogs.before,
			after: auditLogs.after
		})
		.from(auditLogs)
		.leftJoin(user, eq(user.id, auditLogs.actorId))
		.where(where)
		.orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
		.limit(pageSize)
		.offset((page - 1) * pageSize);
	return { rows: rows as AuditListItem[], total: Number(total), page, pageSize, pageCount: Math.max(1, Math.ceil(Number(total) / pageSize)) };
}
