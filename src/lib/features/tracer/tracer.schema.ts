import { boolean, pgEnum, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from '#lib/shared/db/columns.ts';
import { user } from '#lib/features/auth/auth.schema.ts';
import { students } from '#lib/features/students/students.schema.ts';
import { careerFields } from '#lib/features/profiles/profiles.schema.ts';

export const tracerKeeratan = pgEnum('tracer_keeratan', ['sangat_erat', 'erat', 'cukup_erat', 'kurang_erat', 'tidak_sama_sekali']);

export const tracerRecords = pgTable('tracer_records', {
	id: id(),
	studentId: uuid('student_id')
		.notNull()
		.unique()
		.references(() => students.id, { onDelete: 'cascade' }),
	isLinear: boolean('is_linear').notNull(),
	careerFieldId: uuid('career_field_id').references(() => careerFields.id, { onDelete: 'set null' }),
	keeratan: tracerKeeratan('keeratan'),
	note: text('note'),
	recordedBy: text('recorded_by').references(() => user.id, { onDelete: 'set null' }),
	...timestamps()
});
