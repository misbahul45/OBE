import type { DbExecutor } from '#lib/shared/db/client.server.ts';
import { auditLogs } from './audit.schema.ts';
import { redactSensitive } from './audit.redact.ts';

export type AuditEntry = {
	actorId: string | null;
	actorRole?: string | null;
	action: string;
	entityType: string;
	entityId?: string | null;
	summary: string;
	before?: unknown;
	after?: unknown;
	batchId?: string | null;
};

export async function recordAudit(executor: DbExecutor, entry: AuditEntry): Promise<void> {
	await executor.insert(auditLogs).values({
		actorId: entry.actorId,
		actorRole: entry.actorRole ?? null,
		action: entry.action,
		entityType: entry.entityType,
		entityId: entry.entityId ?? null,
		summary: entry.summary,
		before: redactSensitive(entry.before) ?? null,
		after: redactSensitive(entry.after) ?? null,
		batchId: entry.batchId ?? null
	});
}
