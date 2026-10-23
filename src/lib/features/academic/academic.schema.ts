import { boolean, check, date, index, integer, pgEnum, pgTable, text, uniqueIndex, unique, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createdAt, id, timestamps } from '#lib/shared/db/columns.ts';
import { lecturers } from '#lib/features/lecturers/lecturers.schema.ts';

export const termKind = pgEnum('term_kind', ['ganjil', 'genap', 'pendek']);
export const termStatus = pgEnum('term_status', ['planned', 'active', 'closed']);
export const offeringStatus = pgEnum('offering_status', ['draft', 'open', 'closed']);
export const assignmentRole = pgEnum('assignment_role', ['coordinator', 'member']);

export const academicYears = pgTable(
	'academic_years',
	{
		id: id(),
		code: text('code').notNull().unique(),
		startYear: integer('start_year').notNull(),
		isActive: boolean('is_active').notNull().default(false),
		...timestamps()
	},
	(t) => [
		uniqueIndex('academic_years_single_active').on(t.isActive).where(sql`${t.isActive} = true`),
		check('academic_years_start_year_range', sql`${t.startYear} between 2000 and 2100`)
	]
);

export const semesters = pgTable(
	'semesters',
	{
		id: id(),
		academicYearId: uuid('academic_year_id')
			.notNull()
			.references(() => academicYears.id, { onDelete: 'restrict' }),
		term: termKind('term').notNull(),
		name: text('name').notNull(),
		startDate: date('start_date', { mode: 'string' }).notNull(),
		endDate: date('end_date', { mode: 'string' }).notNull(),
		status: termStatus('status').notNull().default('planned'),
		...timestamps()
	},
	(t) => [
		unique('semesters_year_term_unique').on(t.academicYearId, t.term),
		uniqueIndex('semesters_single_active').on(t.status).where(sql`${t.status} = 'active'`),
		check('semesters_date_order', sql`${t.endDate} >= ${t.startDate}`)
	]
);

export const courses = pgTable(
	'courses',
	{
		id: id(),
		code: text('code').notNull().unique(),
		name: text('name').notNull(),
		credits: integer('credits').notNull(),
		description: text('description'),
		isActive: boolean('is_active').notNull().default(true),
		...timestamps()
	},
	(t) => [
		check('courses_code_normalized', sql`${t.code} = upper(btrim(${t.code})) and length(${t.code}) > 0`),
		check('courses_credits_range', sql`${t.credits} between 1 and 12`)
	]
);

export const courseOfferings = pgTable(
	'course_offerings',
	{
		id: id(),
		courseId: uuid('course_id')
			.notNull()
			.references(() => courses.id, { onDelete: 'restrict' }),
		semesterId: uuid('semester_id')
			.notNull()
			.references(() => semesters.id, { onDelete: 'restrict' }),
		section: text('section').notNull().default('A'),
		status: offeringStatus('status').notNull().default('open'),
		...timestamps()
	},
	(t) => [
		unique('course_offerings_course_semester_section_unique').on(t.courseId, t.semesterId, t.section),
		index('course_offerings_semester_idx').on(t.semesterId),
		check('course_offerings_section_normalized', sql`${t.section} = upper(btrim(${t.section})) and length(${t.section}) > 0`)
	]
);

export const lecturerAssignments = pgTable(
	'lecturer_assignments',
	{
		id: id(),
		offeringId: uuid('offering_id')
			.notNull()
			.references(() => courseOfferings.id, { onDelete: 'restrict' }),
		lecturerId: uuid('lecturer_id')
			.notNull()
			.references(() => lecturers.id, { onDelete: 'restrict' }),
		role: assignmentRole('role').notNull().default('member'),
		createdAt: createdAt()
	},
	(t) => [unique('lecturer_assignments_unique').on(t.offeringId, t.lecturerId), index('lecturer_assignments_lecturer_idx').on(t.lecturerId)]
);
