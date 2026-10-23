import { index, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id } from '#lib/shared/db/columns.ts';
import { user } from '#lib/features/auth/auth.schema.ts';
import { courseOfferings } from '#lib/features/academic/academic.schema.ts';
import { cplDefinitions, cpmkDefinitions, outcomePolicies } from '#lib/features/curriculum/curriculum.schema.ts';
import { enrollments } from '#lib/features/enrollments/enrollments.schema.ts';
import { importBatches } from '#lib/features/imports/imports.schema.ts';

export const resultSource = pgEnum('result_source', ['calculated', 'imported_reference', 'manual_approved']);
export const resultCompleteness = pgEnum('result_completeness', ['complete', 'incomplete', 'not_configured']);

export const outcomeCalculationRuns = pgTable(
	'outcome_calculation_runs',
	{
		id: id(),
		policyId: uuid('policy_id').references(() => outcomePolicies.id, { onDelete: 'set null' }),
		offeringId: uuid('offering_id').references(() => courseOfferings.id, { onDelete: 'set null' }),
		trigger: text('trigger').notNull(),
		formulaVersion: text('formula_version').notNull(),
		enrollmentsProcessed: integer('enrollments_processed').notNull().default(0),
		summary: jsonb('summary'),
		actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
		startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
		finishedAt: timestamp('finished_at', { withTimezone: true })
	},
	(t) => [index('outcome_calculation_runs_offering_idx').on(t.offeringId, t.startedAt)]
);

export const cpmkResults = pgTable(
	'cpmk_results',
	{
		id: id(),
		enrollmentId: uuid('enrollment_id')
			.notNull()
			.references(() => enrollments.id, { onDelete: 'cascade' }),
		cpmkId: uuid('cpmk_id')
			.notNull()
			.references(() => cpmkDefinitions.id, { onDelete: 'cascade' }),
		source: resultSource('source').notNull(),
		value: numeric('value', { precision: 9, scale: 4, mode: 'number' }),
		completeness: resultCompleteness('completeness').notNull(),
		formulaVersion: text('formula_version'),
		policyId: uuid('policy_id').references(() => outcomePolicies.id, { onDelete: 'set null' }),
		runId: uuid('run_id').references(() => outcomeCalculationRuns.id, { onDelete: 'set null' }),
		batchId: uuid('batch_id').references(() => importBatches.id, { onDelete: 'set null' }),
		inputs: jsonb('inputs'),
		computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
		createdAt: createdAt()
	},
	(t) => [unique('cpmk_results_unique').on(t.enrollmentId, t.cpmkId, t.source), index('cpmk_results_cpmk_idx').on(t.cpmkId)]
);

export const cplResults = pgTable(
	'cpl_results',
	{
		id: id(),
		enrollmentId: uuid('enrollment_id')
			.notNull()
			.references(() => enrollments.id, { onDelete: 'cascade' }),
		cplId: uuid('cpl_id')
			.notNull()
			.references(() => cplDefinitions.id, { onDelete: 'cascade' }),
		source: resultSource('source').notNull(),
		value: numeric('value', { precision: 9, scale: 4, mode: 'number' }),
		completeness: resultCompleteness('completeness').notNull(),
		coverage: numeric('coverage', { precision: 5, scale: 4, mode: 'number' }),
		formulaVersion: text('formula_version'),
		policyId: uuid('policy_id').references(() => outcomePolicies.id, { onDelete: 'set null' }),
		runId: uuid('run_id').references(() => outcomeCalculationRuns.id, { onDelete: 'set null' }),
		batchId: uuid('batch_id').references(() => importBatches.id, { onDelete: 'set null' }),
		inputs: jsonb('inputs'),
		computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
		createdAt: createdAt()
	},
	(t) => [unique('cpl_results_unique').on(t.enrollmentId, t.cplId, t.source), index('cpl_results_cpl_idx').on(t.cplId)]
);
