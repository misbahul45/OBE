import { pgTable, text } from 'drizzle-orm/pg-core';
import { id, timestamps } from '#lib/shared/db/columns.ts';
import { user } from '#lib/features/auth/auth.schema.ts';

export const lecturers = pgTable('lecturers', {
	id: id(),
	userId: text('user_id')
		.notNull()
		.unique()
		.references(() => user.id, { onDelete: 'restrict' }),
	lecturerCode: text('lecturer_code').unique(),
	nidn: text('nidn').unique(),
	...timestamps()
});
