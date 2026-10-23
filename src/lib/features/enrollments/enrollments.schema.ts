import { index, pgEnum, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from '#lib/shared/db/columns.ts';
import { courseOfferings } from '#lib/features/academic/academic.schema.ts';
import { students } from '#lib/features/students/students.schema.ts';
import { importBatches } from '#lib/features/imports/imports.schema.ts';

export const enrollmentStatus = pgEnum('enrollment_status', ['active', 'dropped', 'completed']);

export const enrollments = pgTable(
	'enrollments',
	{
		id: id(),
		studentId: uuid('student_id')
			.notNull()
			.references(() => students.id, { onDelete: 'restrict' }),
		offeringId: uuid('offering_id')
			.notNull()
			.references(() => courseOfferings.id, { onDelete: 'restrict' }),
		status: enrollmentStatus('status').notNull().default('active'),
		sourceBatchId: uuid('source_batch_id').references(() => importBatches.id, { onDelete: 'set null' }),
		enrolledAt: timestamp('enrolled_at', { withTimezone: true }).notNull().defaultNow(),
		...timestamps()
	},
	(t) => [unique('enrollments_student_offering_unique').on(t.studentId, t.offeringId), index('enrollments_offering_idx').on(t.offeringId)]
);
