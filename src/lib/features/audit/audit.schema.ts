import { index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id } from '#lib/shared/db/columns.ts';
import { user } from '#lib/features/auth/auth.schema.ts';
import { importBatches } from '#lib/features/imports/imports.schema.ts';

export const auditLogs = pgTable(
	'audit_logs',
	{
		id: id(),
		actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
		actorRole: text('actor_role'),
		action: text('action').notNull(),
		entityType: text('entity_type').notNull(),
		entityId: text('entity_id'),
		summary: text('summary').notNull(),
		before: jsonb('before'),
		after: jsonb('after'),
		batchId: uuid('batch_id').references(() => importBatches.id, { onDelete: 'set null' }),
		createdAt: createdAt()
	},
	(t) => [index('audit_logs_entity_idx').on(t.entityType, t.entityId), index('audit_logs_actor_idx').on(t.actorId, t.createdAt), index('audit_logs_created_idx').on(t.createdAt)]
);
