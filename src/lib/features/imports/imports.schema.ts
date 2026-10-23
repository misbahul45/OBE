import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { bytea, createdAt, id, timestamps } from '#lib/shared/db/columns.ts';
import { user } from '#lib/features/auth/auth.schema.ts';
import { courseOfferings } from '#lib/features/academic/academic.schema.ts';

export const importBatchStatus = pgEnum('import_batch_status', ['uploaded', 'mapped', 'validated', 'committed', 'failed', 'cancelled']);
export const importStrategy = pgEnum('import_strategy', ['upsert', 'validate_only', 'insert_missing']);
export const importSheetStatus = pgEnum('import_sheet_status', ['pending', 'ready', 'excluded', 'committed', 'failed']);
export const importIssueSeverity = pgEnum('import_issue_severity', ['error', 'warning', 'info']);

export const importBatches = pgTable(
	'import_batches',
	{
		id: id(),
		uploaderId: text('uploader_id')
			.notNull()
			.references(() => user.id, { onDelete: 'restrict' }),
		fileName: text('file_name').notNull(),
		fileSha256: text('file_sha256').notNull(),
		fileSize: integer('file_size').notNull(),
		fileKind: text('file_kind').notNull(),
		status: importBatchStatus('status').notNull().default('uploaded'),
		strategy: importStrategy('strategy').notNull().default('upsert'),
		duplicateOfBatchId: uuid('duplicate_of_batch_id'),
		totalRows: integer('total_rows').notNull().default(0),
		validRows: integer('valid_rows').notNull().default(0),
		warningRows: integer('warning_rows').notNull().default(0),
		errorRows: integer('error_rows').notNull().default(0),
		studentsInserted: integer('students_inserted').notNull().default(0),
		studentsReused: integer('students_reused').notNull().default(0),
		enrollmentsInserted: integer('enrollments_inserted').notNull().default(0),
		enrollmentsExisting: integer('enrollments_existing').notNull().default(0),
		scoresInserted: integer('scores_inserted').notNull().default(0),
		scoresUpdated: integer('scores_updated').notNull().default(0),
		scoresUnchanged: integer('scores_unchanged').notNull().default(0),
		referencesWritten: integer('references_written').notNull().default(0),
		summary: jsonb('summary'),
		errorMessage: text('error_message'),
		startedAt: timestamp('started_at', { withTimezone: true }),
		finishedAt: timestamp('finished_at', { withTimezone: true }),
		...timestamps()
	},
	(t) => [index('import_batches_sha_idx').on(t.fileSha256), index('import_batches_uploader_idx').on(t.uploaderId), index('import_batches_status_idx').on(t.status)]
);

export const importSheetMappings = pgTable(
	'import_sheet_mappings',
	{
		id: id(),
		batchId: uuid('batch_id')
			.notNull()
			.references(() => importBatches.id, { onDelete: 'cascade' }),
		sheetName: text('sheet_name').notNull(),
		offeringId: uuid('offering_id').references(() => courseOfferings.id, { onDelete: 'restrict' }),
		headerRow: integer('header_row'),
		fingerprint: text('fingerprint').notNull(),
		mapping: jsonb('mapping').notNull(),
		include: boolean('include').notNull().default(true),
		status: importSheetStatus('status').notNull().default('pending'),
		rowCount: integer('row_count').notNull().default(0),
		acknowledgements: jsonb('acknowledgements'),
		...timestamps()
	},
	(t) => [unique('import_sheet_mappings_batch_sheet_unique').on(t.batchId, t.sheetName), index('import_sheet_mappings_offering_idx').on(t.offeringId)]
);

export const importRowIssues = pgTable(
	'import_row_issues',
	{
		id: id(),
		batchId: uuid('batch_id')
			.notNull()
			.references(() => importBatches.id, { onDelete: 'cascade' }),
		sheetName: text('sheet_name').notNull(),
		rowNumber: integer('row_number'),
		columnRef: text('column_ref'),
		field: text('field'),
		severity: importIssueSeverity('severity').notNull(),
		code: text('code').notNull(),
		message: text('message').notNull(),
		action: text('action'),
		createdAt: createdAt()
	},
	(t) => [index('import_row_issues_batch_severity_idx').on(t.batchId, t.severity)]
);

export const importMappingPresets = pgTable('import_mapping_presets', {
	id: id(),
	fingerprint: text('fingerprint').notNull().unique(),
	name: text('name').notNull(),
	mapping: jsonb('mapping').notNull(),
	createdBy: text('created_by')
		.notNull()
		.references(() => user.id, { onDelete: 'restrict' }),
	useCount: integer('use_count').notNull().default(0),
	...timestamps()
});

export const importStagedFiles = pgTable('import_staged_files', {
	batchId: uuid('batch_id')
		.primaryKey()
		.references(() => importBatches.id, { onDelete: 'cascade' }),
	content: bytea('content').notNull(),
	contentType: text('content_type').notNull(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	createdAt: createdAt()
});
