import { check, index, integer, pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createdAt, id, timestamps } from '#lib/shared/db/columns.ts';
import { user } from '#lib/features/auth/auth.schema.ts';
import { importBatches } from '#lib/features/imports/imports.schema.ts';

export const nameConflictStatus = pgEnum('name_conflict_status', ['open', 'kept_master', 'accepted_source']);

export const students = pgTable(
	'students',
	{
		id: id(),
		nim: text('nim').notNull().unique(),
		name: text('name').notNull(),
		cohortYear: integer('cohort_year'),
		createdByBatchId: uuid('created_by_batch_id').references(() => importBatches.id, { onDelete: 'set null' }),
		...timestamps()
	},
	(t) => [
		check('students_nim_digits', sql`${t.nim} ~ '^[0-9]{6,15}$'`),
		check('students_name_not_blank', sql`length(btrim(${t.name})) > 0`),
		index('students_name_idx').on(t.name),
		index('students_cohort_idx').on(t.cohortYear)
	]
);

export const studentNameConflicts = pgTable(
	'student_name_conflicts',
	{
		id: id(),
		studentId: uuid('student_id')
			.notNull()
			.references(() => students.id, { onDelete: 'cascade' }),
		batchId: uuid('batch_id')
			.notNull()
			.references(() => importBatches.id, { onDelete: 'cascade' }),
		sheetName: text('sheet_name').notNull(),
		rowNumber: integer('row_number').notNull(),
		masterName: text('master_name').notNull(),
		sourceName: text('source_name').notNull(),
		status: nameConflictStatus('status').notNull().default('open'),
		resolvedBy: text('resolved_by').references(() => user.id, { onDelete: 'set null' }),
		resolvedAt: timestamp('resolved_at', { withTimezone: true }),
		createdAt: createdAt()
	},
	(t) => [unique('student_name_conflicts_unique').on(t.studentId, t.batchId, t.sheetName, t.rowNumber), index('student_name_conflicts_status_idx').on(t.status)]
);
