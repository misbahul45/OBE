import { date, index, numeric, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, timestamps } from '#lib/shared/db/columns.ts';
import { user } from '#lib/features/auth/auth.schema.ts';
import { courseOfferings, semesters } from '#lib/features/academic/academic.schema.ts';
import { cplDefinitions, cpmkDefinitions } from '#lib/features/curriculum/curriculum.schema.ts';

export const cqiStatus = pgEnum('cqi_status', ['open', 'analysis', 'planned', 'in_progress', 'evaluating', 'closed', 'cancelled']);
export const cqiPriority = pgEnum('cqi_priority', ['low', 'medium', 'high', 'critical']);
export const cqiActionStatus = pgEnum('cqi_action_status', ['planned', 'in_progress', 'done', 'cancelled']);

export const cqiFindings = pgTable(
	'cqi_findings',
	{
		id: id(),
		code: text('code').notNull().unique(),
		title: text('title').notNull(),
		description: text('description').notNull(),
		priority: cqiPriority('priority').notNull().default('medium'),
		status: cqiStatus('status').notNull().default('open'),
		semesterId: uuid('semester_id').references(() => semesters.id, { onDelete: 'set null' }),
		offeringId: uuid('offering_id').references(() => courseOfferings.id, { onDelete: 'set null' }),
		cplId: uuid('cpl_id').references(() => cplDefinitions.id, { onDelete: 'set null' }),
		cpmkId: uuid('cpmk_id').references(() => cpmkDefinitions.id, { onDelete: 'set null' }),
		rootCause: text('root_cause'),
		createdBy: text('created_by')
			.notNull()
			.references(() => user.id, { onDelete: 'restrict' }),
		closedAt: timestamp('closed_at', { withTimezone: true }),
		...timestamps()
	},
	(t) => [index('cqi_findings_status_idx').on(t.status, t.priority)]
);

export const cqiActions = pgTable(
	'cqi_actions',
	{
		id: id(),
		findingId: uuid('finding_id')
			.notNull()
			.references(() => cqiFindings.id, { onDelete: 'cascade' }),
		description: text('description').notNull(),
		picUserId: text('pic_user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'restrict' }),
		dueDate: date('due_date', { mode: 'string' }).notNull(),
		status: cqiActionStatus('status').notNull().default('planned'),
		completedAt: timestamp('completed_at', { withTimezone: true }),
		...timestamps()
	},
	(t) => [index('cqi_actions_finding_idx').on(t.findingId), index('cqi_actions_due_idx').on(t.status, t.dueDate)]
);

export const cqiEvidence = pgTable('cqi_evidence', {
	id: id(),
	findingId: uuid('finding_id')
		.notNull()
		.references(() => cqiFindings.id, { onDelete: 'cascade' }),
	actionId: uuid('action_id').references(() => cqiActions.id, { onDelete: 'set null' }),
	title: text('title').notNull(),
	url: text('url'),
	note: text('note'),
	addedBy: text('added_by')
		.notNull()
		.references(() => user.id, { onDelete: 'restrict' }),
	createdAt: createdAt()
});

export const cqiEvaluations = pgTable('cqi_evaluations', {
	id: id(),
	findingId: uuid('finding_id')
		.notNull()
		.references(() => cqiFindings.id, { onDelete: 'cascade' }),
	metricLabel: text('metric_label').notNull(),
	valueBefore: numeric('value_before', { precision: 9, scale: 4, mode: 'number' }),
	valueAfter: numeric('value_after', { precision: 9, scale: 4, mode: 'number' }),
	conclusion: text('conclusion').notNull(),
	evaluatedBy: text('evaluated_by')
		.notNull()
		.references(() => user.id, { onDelete: 'restrict' }),
	evaluatedAt: timestamp('evaluated_at', { withTimezone: true }).notNull().defaultNow(),
	createdAt: createdAt()
});
