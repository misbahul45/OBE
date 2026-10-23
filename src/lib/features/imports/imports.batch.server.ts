import { and, asc, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import type { Database } from '#lib/shared/db/client.server.ts';
import { NotFoundError, ValidationError } from '#lib/shared/http/errors.ts';
import { recordAudit } from '#lib/features/audit/index.server.ts';
import { canAccessOffering, accessibleOfferingIds } from '#lib/features/academic/index.server.ts';
import { courseOfferings, courses, semesters } from '#lib/features/academic/academic.schema.ts';
import { appRoles } from '#lib/features/auth/index.ts';
import { recomputeOfferings } from '#lib/features/outcomes/index.server.ts';
import { sha256Hex, sanitizeFileName } from './file-safety.server.ts';
import { importBatches, importMappingPresets, importRowIssues, importSheetMappings, importStagedFiles } from './imports.schema.ts';
import { commitImport } from './imports.commit.server.ts';
import { evaluateGate, planSheet, summarizePlans } from './imports.plan.server.ts';
import { ImportBlockedError, type ErrorPolicy, type ImportStrategy, type PlanBlocker, type SheetImportInput, type SheetPlan } from './imports.plan.types.ts';
import type { SheetAnalysis, SheetGrid, SheetMapping } from './imports.types.ts';
import { mappingFromForm, sheetMappingSchema, type MappingFormEntries } from './mapping.validation.ts';
import { analyzeSheet, suggestMapping } from './sheet-analysis.ts';
import { pickOffering, resolveSheet } from './sheet-target.ts';
import { readWorkbook, WorkbookReadError, type WorkbookErrorCode } from './workbook-reader.server.ts';
import { allIssues } from './validation.ts';

export type ImportActor = { id: string; role: string };

export type StoredSheetMapping = { mapping: SheetMapping | null; source: 'auto' | 'preset' | 'manual'; presetId?: string };

export type SheetSettings = { numericNim: boolean };

const stagedTtlMs = 24 * 60 * 60 * 1000;
const issueCap = 5000;

export type DuplicateInfo = { batchId: string; fileName: string; finishedAt: Date | null; offeringIds: string[] };

export type UploadResult =
	| { ok: true; batchId: string; duplicates: DuplicateInfo[]; sheets: string[]; skipped: { name: string; reason: string }[] }
	| { ok: false; code: WorkbookErrorCode; message: string };

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

async function createOfferingSuggester(db: Database, actor: ImportActor): Promise<(sheetName: string) => string | null> {
	const scope = await accessibleOfferingIds(db, actor);
	if (scope !== 'all' && scope.length === 0) return () => null;
	const rows = await db
		.select({ id: courseOfferings.id, courseCode: courses.code, courseName: courses.name, section: courseOfferings.section })
		.from(courseOfferings)
		.innerJoin(courses, eq(courses.id, courseOfferings.courseId))
		.innerJoin(semesters, eq(semesters.id, courseOfferings.semesterId))
		.where(and(eq(semesters.status, 'active'), scope === 'all' ? undefined : inArray(courseOfferings.id, scope)));
	const catalog = rows.map((row) => ({ code: row.courseCode, name: row.courseName }));
	return (sheetName) => {
		const resolved = resolveSheet(sheetName, catalog);
		return resolved ? (pickOffering(rows, resolved)?.id ?? null) : null;
	};
}

export async function stageUpload(db: Database, actor: ImportActor, file: { name: string; bytes: Uint8Array }): Promise<UploadResult> {
	await purgeExpiredStagedFiles(db).catch(() => 0);
	const fileName = sanitizeFileName(file.name);
	let workbook;
	try {
		workbook = readWorkbook(file.bytes, fileName);
	} catch (error) {
		if (error instanceof WorkbookReadError) return { ok: false, code: error.code, message: error.message };
		throw error;
	}
	const sha = sha256Hex(file.bytes);
	const previous = await db
		.select({ id: importBatches.id, fileName: importBatches.fileName, finishedAt: importBatches.finishedAt })
		.from(importBatches)
		.where(and(eq(importBatches.fileSha256, sha), eq(importBatches.status, 'committed'), actor.role === appRoles.superAdmin ? undefined : eq(importBatches.uploaderId, actor.id)))
		.orderBy(desc(importBatches.finishedAt))
		.limit(5);
	const previousSheets = previous.length
		? await db.select({ batchId: importSheetMappings.batchId, offeringId: importSheetMappings.offeringId }).from(importSheetMappings).where(and(inArray(importSheetMappings.batchId, previous.map((p) => p.id)), eq(importSheetMappings.status, 'committed')))
		: [];
	const duplicates: DuplicateInfo[] = previous.map((p) => ({ batchId: p.id, fileName: p.fileName, finishedAt: p.finishedAt, offeringIds: previousSheets.filter((s) => s.batchId === p.id && s.offeringId).map((s) => s.offeringId!) }));

	const suggestOffering = await createOfferingSuggester(db, actor);
	type PreparedSheet = { grid: SheetGrid; analysis: SheetAnalysis; stored: StoredSheetMapping; offeringId: string | null };
	const prepared: PreparedSheet[] = [];
	for (const grid of workbook.sheets) {
		const analysis = analyzeSheet(grid);
		const [preset] = await db.select().from(importMappingPresets).where(eq(importMappingPresets.fingerprint, analysis.fingerprint)).limit(1);
		const fromPreset = preset ? sheetMappingSchema.safeParse(preset.mapping) : null;
		const suggested = suggestMapping(analysis);
		const mapping = fromPreset?.success ? (fromPreset.data as SheetMapping) : suggested;
		const stored: StoredSheetMapping = { mapping, source: fromPreset?.success ? 'preset' : 'auto', presetId: fromPreset?.success ? preset.id : undefined };
		prepared.push({ grid, analysis, stored, offeringId: mapping ? suggestOffering(grid.name) : null });
	}

	const batchId = await db.transaction(async (tx) => {
		const [batch] = await tx
			.insert(importBatches)
			.values({ uploaderId: actor.id, fileName, fileSha256: sha, fileSize: file.bytes.byteLength, fileKind: workbook.kind, status: 'uploaded', duplicateOfBatchId: duplicates[0]?.batchId ?? null })
			.returning({ id: importBatches.id });
		await tx.insert(importStagedFiles).values({
			batchId: batch.id,
			content: Buffer.from(file.bytes),
			contentType: workbook.kind === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv',
			expiresAt: new Date(Date.now() + stagedTtlMs)
		});
		await tx.insert(importSheetMappings).values(
			prepared.map((p) => ({
				batchId: batch.id,
				sheetName: p.grid.name,
				offeringId: p.offeringId,
				headerRow: p.analysis.headerRow,
				fingerprint: p.analysis.fingerprint,
				mapping: p.stored,
				include: p.stored.mapping !== null,
				status: 'pending' as const,
				rowCount: p.analysis.studentRowCount,
				acknowledgements: { numericNim: false } satisfies SheetSettings
			}))
		);
		const presetIds = prepared.map((p) => p.stored.presetId).filter((id): id is string => !!id);
		if (presetIds.length) await tx.update(importMappingPresets).set({ useCount: sql`${importMappingPresets.useCount} + 1` }).where(inArray(importMappingPresets.id, presetIds));
		await recordAudit(tx, { actorId: actor.id, actorRole: actor.role, action: 'import.upload', entityType: 'import_batch', entityId: batch.id, batchId: batch.id, summary: `Berkas ${fileName} diunggah (${workbook.sheets.length} sheet)`, after: { fileName, size: file.bytes.byteLength, sha256: sha, sheets: workbook.sheets.length, duplicateOf: duplicates[0]?.batchId ?? null } });
		return batch.id;
	});
	return { ok: true, batchId, duplicates, sheets: workbook.sheets.map((s) => s.name), skipped: workbook.skipped };
}

export async function assertBatchAccess(db: Database, actor: ImportActor, batchId: string) {
	const [batch] = await db.select().from(importBatches).where(eq(importBatches.id, batchId)).limit(1);
	if (!batch) throw new NotFoundError();
	if (actor.role !== appRoles.superAdmin && batch.uploaderId !== actor.id) throw new NotFoundError();
	return batch;
}

export async function assertBatchOpen(db: Database, actor: ImportActor, batchId: string) {
	const batch = await assertBatchAccess(db, actor, batchId);
	if (batch.status === 'committed' || batch.status === 'cancelled') throw new ValidationError({ form: ['Batch sudah selesai atau dibatalkan'] });
	return batch;
}

export type LoadedBatch = {
	batch: typeof importBatches.$inferSelect;
	sheets: {
		row: typeof importSheetMappings.$inferSelect;
		grid: SheetGrid;
		analysis: SheetAnalysis;
		stored: StoredSheetMapping;
		input: SheetImportInput;
		settings: SheetSettings;
	}[];
	skipped: { name: string; reason: string }[];
};

export class StagedFileMissingError extends Error {
	constructor() {
		super('Berkas sementara sudah kedaluwarsa atau dihapus. Unggah ulang berkas.');
		this.name = 'StagedFileMissingError';
	}
}

export async function loadBatch(db: Database, actor: ImportActor, batchId: string): Promise<LoadedBatch> {
	const batch = await assertBatchAccess(db, actor, batchId);
	const [staged] = await db.select().from(importStagedFiles).where(eq(importStagedFiles.batchId, batchId)).limit(1);
	if (!staged || staged.expiresAt < new Date()) throw new StagedFileMissingError();
	const workbook = readWorkbook(new Uint8Array(staged.content), batch.fileName);
	const rows = await db.select().from(importSheetMappings).where(eq(importSheetMappings.batchId, batchId)).orderBy(asc(importSheetMappings.createdAt), asc(importSheetMappings.sheetName));
	const rowByName = new Map(rows.map((r) => [r.sheetName, r]));
	const sheets: LoadedBatch['sheets'] = [];
	for (const grid of workbook.sheets) {
		const row = rowByName.get(grid.name);
		if (!row) continue;
		const stored = row.mapping as StoredSheetMapping;
		const parsed = stored.mapping ? sheetMappingSchema.safeParse(stored.mapping) : null;
		const mapping = parsed?.success ? (parsed.data as SheetMapping) : null;
		const analysis = analyzeSheet(grid, { headerRow: row.headerRow ?? undefined });
		const settings = { numericNim: Boolean((row.acknowledgements as SheetSettings | null)?.numericNim) };
		sheets.push({
			row,
			grid,
			analysis,
			stored: { ...stored, mapping },
			settings,
			input: {
				sheetName: row.sheetName,
				offeringId: row.offeringId,
				grid,
				mapping: mapping ?? { headerRow: 1, nimColumn: 0, nameColumn: null, firstDataRow: 2, components: [], cpmkColumns: [], cplColumns: [], excludedRows: [] },
				acknowledgements: { numericNim: settings.numericNim },
				include: row.include && mapping !== null
			}
		});
	}
	return { batch, sheets, skipped: workbook.skipped };
}

export type SheetChange = {
	offeringId?: string | null;
	include?: boolean;
	mappingForm?: MappingFormEntries;
	reanalyzeHeaderRow?: number;
	acknowledgeNumericNim?: boolean;
	savePresetName?: string;
};

export async function saveSheetSettings(db: Database, actor: ImportActor, batchId: string, sheetName: string, change: SheetChange) {
	await assertBatchOpen(db, actor, batchId);
	const loaded = await loadBatch(db, actor, batchId);
	const sheet = loaded.sheets.find((s) => s.row.sheetName === sheetName);
	if (!sheet) throw new NotFoundError('Sheet tidak ditemukan.');
	const update: Partial<typeof importSheetMappings.$inferInsert> = {};

	if (change.offeringId !== undefined) {
		if (change.offeringId !== null && !(await canAccessOffering(db, actor, change.offeringId))) throw new ValidationError({ offeringId: ['Offering tidak ditemukan atau Anda tidak ditugaskan pada kelas ini'] });
		update.offeringId = change.offeringId;
	}
	if (change.include !== undefined) update.include = change.include && sheet.stored.mapping !== null;
	if (change.acknowledgeNumericNim !== undefined) update.acknowledgements = { numericNim: change.acknowledgeNumericNim } satisfies SheetSettings;

	if (change.reanalyzeHeaderRow !== undefined) {
		const analysis = analyzeSheet(sheet.grid, { headerRow: change.reanalyzeHeaderRow });
		const mapping = suggestMapping(analysis);
		if (!mapping) throw new ValidationError({ headerRow: ['Baris header dengan kolom NIM tidak ditemukan pada baris tersebut'] });
		update.headerRow = analysis.headerRow;
		update.fingerprint = analysis.fingerprint;
		update.rowCount = analysis.studentRowCount;
		update.mapping = { mapping, source: 'manual' } satisfies StoredSheetMapping;
		update.include = true;
	}

	if (change.mappingForm) {
		const base = sheet.stored.mapping ?? suggestMapping(sheet.analysis);
		if (!base) throw new ValidationError({ form: ['Pemetaan awal tidak tersedia; tentukan baris header terlebih dahulu'] });
		const candidate = mappingFromForm(change.mappingForm, base);
		const parsed = sheetMappingSchema.safeParse(candidate);
		if (!parsed.success) {
			const fieldErrors: Record<string, string[]> = {};
			for (const issue of parsed.error.issues) (fieldErrors[issue.path.join('.') || 'form'] ??= []).push(issue.message);
			throw new ValidationError(fieldErrors, 'Pemetaan kolom tidak valid.');
		}
		update.mapping = { mapping: parsed.data as SheetMapping, source: 'manual' } satisfies StoredSheetMapping;
		update.headerRow = parsed.data.headerRow;
	}

	await db.transaction(async (tx) => {
		if (Object.keys(update).length) await tx.update(importSheetMappings).set(update).where(and(eq(importSheetMappings.batchId, batchId), eq(importSheetMappings.sheetName, sheetName)));
		if (change.savePresetName) {
			const mappingToSave = (update.mapping as StoredSheetMapping | undefined)?.mapping ?? sheet.stored.mapping;
			if (mappingToSave) {
				const fingerprint = (update.fingerprint as string | undefined) ?? sheet.row.fingerprint;
				await tx
					.insert(importMappingPresets)
					.values({ fingerprint, name: change.savePresetName, mapping: mappingToSave, createdBy: actor.id })
					.onConflictDoUpdate({ target: importMappingPresets.fingerprint, set: { name: change.savePresetName, mapping: mappingToSave } });
			}
		}
		await tx.update(importBatches).set({ status: 'mapped' }).where(and(eq(importBatches.id, batchId), eq(importBatches.status, 'uploaded')));
		await recordAudit(tx, { actorId: actor.id, actorRole: actor.role, action: 'import.sheet_settings', entityType: 'import_batch', entityId: batchId, batchId, summary: `Pengaturan sheet "${sheetName}" diperbarui`, after: { offeringId: update.offeringId, include: update.include, preset: change.savePresetName ?? null } });
	});
}

export type DryRunOptions = { strategy: ImportStrategy; errorPolicy: ErrorPolicy; confirmations: { scoreUpdates: boolean; weightChanges: boolean } };

export type DryRunResult = {
	plans: SheetPlan[];
	summary: ReturnType<typeof summarizePlans>;
	blockers: PlanBlocker[];
	issueTotals: { error: number; warning: number; info: number };
};

export async function runDryRun(db: Database, actor: ImportActor, batchId: string, options: DryRunOptions): Promise<DryRunResult> {
	await assertBatchOpen(db, actor, batchId);
	const loaded = await loadBatch(db, actor, batchId);
	const plans: SheetPlan[] = [];
	for (const sheet of loaded.sheets) plans.push(await planSheet(db, sheet.input));
	const blockers = plans.flatMap((plan, i) => evaluateGate(plan, { ...options, acknowledgements: loaded.sheets[i].input.acknowledgements }));
	const issues = plans.filter((p) => p.included).flatMap((p) => allIssues(p.validation));
	const totals = { error: issues.filter((i) => i.severity === 'error').length, warning: issues.filter((i) => i.severity === 'warning').length, info: issues.filter((i) => i.severity === 'info').length };
	const summary = summarizePlans(plans);

	await db.transaction(async (tx) => {
		await tx.delete(importRowIssues).where(eq(importRowIssues.batchId, batchId));
		const ranked = [...issues].sort((a, b) => ({ error: 0, warning: 1, info: 2 })[a.severity] - { error: 0, warning: 1, info: 2 }[b.severity]).slice(0, issueCap);
		for (let i = 0; i < ranked.length; i += 500)
			await tx.insert(importRowIssues).values(ranked.slice(i, i + 500).map((issue) => ({ batchId, sheetName: issue.sheet, rowNumber: issue.row, columnRef: issue.column, field: issue.field, severity: issue.severity, code: issue.code, message: issue.message })));
		await tx
			.update(importBatches)
			.set({ status: 'validated', strategy: options.strategy, totalRows: summary.rowsValid + summary.rowsWarning + summary.rowsRejected, validRows: summary.rowsValid, warningRows: summary.rowsWarning, errorRows: summary.rowsRejected })
			.where(eq(importBatches.id, batchId));
	});
	return { plans, summary, blockers, issueTotals: totals };
}

export type CommitBatchResult =
	| { ok: true; summary: ReturnType<typeof summarizePlans>; offeringIds: string[]; studentIds: string[]; recompute: 'done' | 'failed' }
	| { ok: false; blockers: PlanBlocker[] };

export async function commitBatch(db: Database, actor: ImportActor, batchId: string, options: DryRunOptions): Promise<CommitBatchResult> {
	await assertBatchOpen(db, actor, batchId);
	const loaded = await loadBatch(db, actor, batchId);
	const included = loaded.sheets.filter((s) => s.input.include);
	for (const sheet of included)
		if (sheet.input.offeringId && !(await canAccessOffering(db, actor, sheet.input.offeringId))) return { ok: false, blockers: [{ code: 'OFFERING_NOT_FOUND', sheet: sheet.row.sheetName, message: `Sheet "${sheet.row.sheetName}": Anda tidak berhak mengimpor ke offering ini.` }] };
	try {
		const result = await commitImport(db, { batchId, actor, sheets: loaded.sheets.map((s) => s.input), strategy: options.strategy, errorPolicy: options.errorPolicy, confirmations: options.confirmations });
		const offeringIds = [...new Set(result.sheets.map((s) => s.offeringId))];
		let recompute: 'done' | 'failed' = 'done';
		try {
			await recomputeOfferings(db, actor, offeringIds, `import:${batchId}`);
		} catch {
			recompute = 'failed';
		}
		await db.delete(importStagedFiles).where(eq(importStagedFiles.batchId, batchId));
		return { ok: true, summary: result.summary, offeringIds, studentIds: result.studentIds, recompute };
	} catch (error) {
		if (error instanceof ImportBlockedError) return { ok: false, blockers: error.blockers };
		throw error;
	}
}

export async function cancelBatch(db: Database, actor: ImportActor, batchId: string) {
	const batch = await assertBatchAccess(db, actor, batchId);
	if (batch.status === 'committed') throw new ValidationError({ form: ['Batch yang sudah disimpan tidak dapat dibatalkan'] });
	await db.transaction(async (tx) => {
		await tx.update(importBatches).set({ status: 'cancelled', finishedAt: new Date() }).where(eq(importBatches.id, batchId));
		await tx.delete(importStagedFiles).where(eq(importStagedFiles.batchId, batchId));
		await recordAudit(tx, { actorId: actor.id, actorRole: actor.role, action: 'import.cancel', entityType: 'import_batch', entityId: batchId, batchId, summary: 'Batch impor dibatalkan dan berkas sementara dihapus' });
	});
}

export async function purgeExpiredStagedFiles(db: Database): Promise<number> {
	const removed = await db.delete(importStagedFiles).where(lt(importStagedFiles.expiresAt, new Date())).returning({ batchId: importStagedFiles.batchId });
	return removed.length;
}
