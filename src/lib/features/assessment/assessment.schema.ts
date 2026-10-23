import { boolean, check, foreignKey, index, integer, numeric, pgEnum, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createdAt, id, timestamps } from '#lib/shared/db/columns.ts';
import { user } from '#lib/features/auth/auth.schema.ts';
import { courseOfferings } from '#lib/features/academic/academic.schema.ts';
import { cpmkDefinitions } from '#lib/features/curriculum/curriculum.schema.ts';
import { enrollments } from '#lib/features/enrollments/enrollments.schema.ts';
import { importBatches } from '#lib/features/imports/imports.schema.ts';

export const componentType = pgEnum('component_type', ['uts', 'uas', 'tugas', 'kuis', 'proyek', 'praktikum', 'kehadiran', 'softskill', 'lainnya']);
export const scoreChangeType = pgEnum('score_change_type', ['import_initial', 'import_update', 'manual_correction']);

export const assessmentComponents = pgTable(
	'assessment_components',
	{
		id: id(),
		offeringId: uuid('offering_id')
			.notNull()
			.references(() => courseOfferings.id, { onDelete: 'restrict' }),
		code: text('code').notNull(),
		name: text('name').notNull(),
		type: componentType('type').notNull().default('lainnya'),
		weightPercent: numeric('weight_percent', { precision: 7, scale: 4, mode: 'number' }),
		maxScore: numeric('max_score', { precision: 9, scale: 4, mode: 'number' }).notNull().default(100),
		sortOrder: integer('sort_order').notNull().default(0),
		isRequired: boolean('is_required').notNull().default(true),
		isActive: boolean('is_active').notNull().default(true),
		sourceLabel: text('source_label'),
		...timestamps()
	},
	(t) => [
		unique('assessment_components_offering_code_unique').on(t.offeringId, t.code),
		check('assessment_components_weight_range', sql`${t.weightPercent} is null or ${t.weightPercent} between 0 and 100`),
		check('assessment_components_max_positive', sql`${t.maxScore} > 0`)
	]
);

export const assessmentCpmkMappings = pgTable(
	'assessment_cpmk_mappings',
	{
		id: id(),
		componentId: uuid('component_id').notNull(),
		cpmkId: uuid('cpmk_id')
			.notNull()
			.references(() => cpmkDefinitions.id, { onDelete: 'cascade' }),
		coefficient: numeric('coefficient', { precision: 9, scale: 4, mode: 'number' }).notNull().default(1),
		approvedBy: text('approved_by').references(() => user.id, { onDelete: 'set null' }),
		...timestamps()
	},
	(t) => [
		foreignKey({ name: 'assessment_cpmk_mappings_component_fk', columns: [t.componentId], foreignColumns: [assessmentComponents.id] }).onDelete('cascade'),
		unique('assessment_cpmk_mappings_unique').on(t.componentId, t.cpmkId),
		check('assessment_cpmk_mappings_positive', sql`${t.coefficient} > 0`)
	]
);

export const assessmentScores = pgTable(
	'assessment_scores',
	{
		id: id(),
		enrollmentId: uuid('enrollment_id')
			.notNull()
			.references(() => enrollments.id, { onDelete: 'restrict' }),
		componentId: uuid('component_id')
			.notNull()
			.references(() => assessmentComponents.id, { onDelete: 'restrict' }),
		score: numeric('score', { precision: 9, scale: 4, mode: 'number' }),
		sourceBatchId: uuid('source_batch_id').references(() => importBatches.id, { onDelete: 'set null' }),
		sourceSheet: text('source_sheet'),
		sourceRow: integer('source_row'),
		...timestamps()
	},
	(t) => [
		unique('assessment_scores_enrollment_component_unique').on(t.enrollmentId, t.componentId),
		index('assessment_scores_component_idx').on(t.componentId),
		check('assessment_scores_non_negative', sql`${t.score} is null or ${t.score} >= 0`)
	]
);

export const assessmentScoreRevisions = pgTable(
	'assessment_revisions',
	{
		id: id(),
		enrollmentId: uuid('enrollment_id')
			.notNull()
			.references(() => enrollments.id, { onDelete: 'restrict' }),
		componentId: uuid('component_id')
			.notNull()
			.references(() => assessmentComponents.id, { onDelete: 'restrict' }),
		oldScore: numeric('old_score', { precision: 9, scale: 4, mode: 'number' }),
		newScore: numeric('new_score', { precision: 9, scale: 4, mode: 'number' }),
		changeType: scoreChangeType('change_type').notNull(),
		batchId: uuid('batch_id').references(() => importBatches.id, { onDelete: 'set null' }),
		actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
		reason: text('reason'),
		createdAt: createdAt()
	},
	(t) => [index('assessment_revisions_lookup_idx').on(t.enrollmentId, t.componentId, t.createdAt), index('assessment_revisions_batch_idx').on(t.batchId)]
);
