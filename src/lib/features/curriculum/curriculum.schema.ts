import { boolean, check, date, integer, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, unique, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { id, timestamps } from '#lib/shared/db/columns.ts';
import { user } from '#lib/features/auth/auth.schema.ts';
import { courses } from '#lib/features/academic/academic.schema.ts';

export const policyStatus = pgEnum('policy_status', ['draft', 'active', 'retired']);
export const aggregationMethod = pgEnum('aggregation_method', ['not_configured', 'simple_mean', 'credit_weighted_mean']);

export const outcomePolicies = pgTable(
	'outcome_policies',
	{
		id: id(),
		version: integer('version').notNull().unique(),
		name: text('name').notNull(),
		status: policyStatus('status').notNull().default('draft'),
		scaleMax: numeric('scale_max', { precision: 7, scale: 2, mode: 'number' }).notNull().default(100),
		achievementThreshold: numeric('achievement_threshold', { precision: 7, scale: 2, mode: 'number' }),
		classAchievementRatio: numeric('class_achievement_ratio', { precision: 5, scale: 2, mode: 'number' }),
		weightTolerance: numeric('weight_tolerance', { precision: 6, scale: 4, mode: 'number' }).notNull().default(0.01),
		aggregationMethod: aggregationMethod('aggregation_method').notNull().default('not_configured'),
		formulaVersion: text('formula_version').notNull().default('v1'),
		notes: text('notes'),
		approvedBy: text('approved_by').references(() => user.id, { onDelete: 'set null' }),
		approvedAt: timestamp('approved_at', { withTimezone: true }),
		effectiveFrom: date('effective_from', { mode: 'string' }),
		...timestamps()
	},
	(t) => [
		uniqueIndex('outcome_policies_single_active').on(t.status).where(sql`${t.status} = 'active'`),
		check('outcome_policies_ratio_range', sql`${t.classAchievementRatio} is null or ${t.classAchievementRatio} between 0 and 100`)
	]
);

export const cplDefinitions = pgTable(
	'cpl_definitions',
	{
		id: id(),
		code: text('code').notNull().unique(),
		title: text('title').notNull(),
		description: text('description'),
		graduateAttributes: text('graduate_attributes').array().notNull().default(sql`'{}'::text[]`),
		knowledgeProfiles: text('knowledge_profiles').array().notNull().default(sql`'{}'::text[]`),
		sortOrder: integer('sort_order').notNull().default(0),
		isActive: boolean('is_active').notNull().default(true),
		...timestamps()
	},
	(t) => [check('cpl_definitions_code_format', sql`${t.code} ~ '^CPL-[0-9]+$'`)]
);

export const cplTargets = pgTable(
	'cpl_targets',
	{
		id: id(),
		policyId: uuid('policy_id')
			.notNull()
			.references(() => outcomePolicies.id, { onDelete: 'cascade' }),
		cplId: uuid('cpl_id')
			.notNull()
			.references(() => cplDefinitions.id, { onDelete: 'cascade' }),
		target: numeric('target', { precision: 7, scale: 2, mode: 'number' }).notNull(),
		...timestamps()
	},
	(t) => [unique('cpl_targets_unique').on(t.policyId, t.cplId), check('cpl_targets_non_negative', sql`${t.target} >= 0`)]
);

export const cpmkDefinitions = pgTable(
	'cpmk_definitions',
	{
		id: id(),
		courseId: uuid('course_id')
			.notNull()
			.references(() => courses.id, { onDelete: 'restrict' }),
		code: text('code').notNull(),
		description: text('description'),
		taxonomyLevel: text('taxonomy_level'),
		isActive: boolean('is_active').notNull().default(true),
		...timestamps()
	},
	(t) => [unique('cpmk_definitions_course_code_unique').on(t.courseId, t.code), check('cpmk_definitions_code_format', sql`${t.code} ~ '^CPMK-[0-9]+$'`)]
);

export const courseCplMappings = pgTable(
	'course_cpl_mappings',
	{
		id: id(),
		courseId: uuid('course_id')
			.notNull()
			.references(() => courses.id, { onDelete: 'cascade' }),
		cplId: uuid('cpl_id')
			.notNull()
			.references(() => cplDefinitions.id, { onDelete: 'cascade' }),
		contribution: numeric('contribution', { precision: 7, scale: 4, mode: 'number' }),
		approvalSource: text('approval_source'),
		...timestamps()
	},
	(t) => [unique('course_cpl_mappings_unique').on(t.courseId, t.cplId)]
);

export const cpmkCplMappings = pgTable(
	'cpmk_cpl_mappings',
	{
		id: id(),
		cpmkId: uuid('cpmk_id')
			.notNull()
			.references(() => cpmkDefinitions.id, { onDelete: 'cascade' }),
		cplId: uuid('cpl_id')
			.notNull()
			.references(() => cplDefinitions.id, { onDelete: 'cascade' }),
		weight: numeric('weight', { precision: 9, scale: 4, mode: 'number' }).notNull(),
		approvedBy: text('approved_by').references(() => user.id, { onDelete: 'set null' }),
		approvedAt: timestamp('approved_at', { withTimezone: true }),
		...timestamps()
	},
	(t) => [unique('cpmk_cpl_mappings_unique').on(t.cpmkId, t.cplId), check('cpmk_cpl_mappings_positive', sql`${t.weight} > 0`)]
);
