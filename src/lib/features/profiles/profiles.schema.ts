import { check, integer, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { id, timestamps } from '#lib/shared/db/columns.ts';
import { cplDefinitions } from '#lib/features/curriculum/curriculum.schema.ts';

export const graduateProfiles = pgTable(
	'graduate_profiles',
	{
		id: id(),
		code: text('code').notNull().unique(),
		name: text('name').notNull(),
		summary: text('summary'),
		creditEstimate: text('credit_estimate'),
		sortOrder: integer('sort_order').notNull().default(0),
		...timestamps()
	},
	(t) => [check('graduate_profiles_code_format', sql`${t.code} ~ '^PL[0-9]+$'`)]
);

export const careerFields = pgTable(
	'career_fields',
	{
		id: id(),
		code: text('code').notNull().unique(),
		name: text('name').notNull(),
		summary: text('summary'),
		sortOrder: integer('sort_order').notNull().default(0),
		...timestamps()
	},
	(t) => [check('career_fields_code_format', sql`${t.code} ~ '^BK[0-9]+$'`)]
);

export const cplProfileLinks = pgTable(
	'cpl_profile_links',
	{
		id: id(),
		cplId: uuid('cpl_id')
			.notNull()
			.references(() => cplDefinitions.id, { onDelete: 'cascade' }),
		profileId: uuid('profile_id')
			.notNull()
			.references(() => graduateProfiles.id, { onDelete: 'cascade' }),
		...timestamps()
	},
	(t) => [unique('cpl_profile_links_pair').on(t.cplId, t.profileId)]
);

export const profileCareerLinks = pgTable(
	'profile_career_links',
	{
		id: id(),
		profileId: uuid('profile_id')
			.notNull()
			.references(() => graduateProfiles.id, { onDelete: 'cascade' }),
		careerFieldId: uuid('career_field_id')
			.notNull()
			.references(() => careerFields.id, { onDelete: 'cascade' }),
		relevance: integer('relevance').notNull(),
		...timestamps()
	},
	(t) => [unique('profile_career_links_pair').on(t.profileId, t.careerFieldId), check('profile_career_links_relevance_range', sql`${t.relevance} between 1 and 3`)]
);
