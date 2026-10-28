import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Database, DbExecutor } from '#lib/shared/db/client.server.ts';
import { recordAudit } from '#lib/features/audit/index.server.ts';
import { assessmentComponents, assessmentScoreRevisions, assessmentScores } from '#lib/features/assessment/assessment.schema.ts';
import { cplDefinitions, cpmkDefinitions } from '#lib/features/curriculum/curriculum.schema.ts';
import { courseOfferings } from '#lib/features/academic/academic.schema.ts';
import { enrollments } from '#lib/features/enrollments/enrollments.schema.ts';
import { cplResults, cpmkResults } from '#lib/features/outcomes/outcomes.schema.ts';
import { studentNameConflicts, students } from '#lib/features/students/students.schema.ts';
import { importBatches, importSheetMappings } from './imports.schema.ts';
import { emptySummary, ImportBlockedError, type ErrorPolicy, type ImportStrategy, type PlanSummary, type SheetImportInput, type SheetPlan } from './imports.plan.types.ts';
import { evaluateGate, planSheet } from './imports.plan.server.ts';
import { sameStored } from './numbers.ts';
import { blueprintCpmkCodes, extractObeBlueprint } from './obe-blueprint.ts';
import { analyzeSheet } from './sheet-analysis.ts';

export class ImportStateError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ImportStateError';
	}
}

export type CommitParams = {
	batchId: string;
	actor: { id: string; role: string };
	sheets: SheetImportInput[];
	strategy: ImportStrategy;
	errorPolicy: ErrorPolicy;
	confirmations: { scoreUpdates: boolean; weightChanges: boolean };
};

export type SheetCommitResult = { sheet: string; offeringId: string; summary: PlanSummary; enrollmentIds: string[]; skippedUpdates: number };

export type CommitResult = {
	batchId: string;
	summary: PlanSummary;
	sheets: SheetCommitResult[];
	studentIds: string[];
};

const normalizeName = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();

async function applySheet(tx: DbExecutor, plan: SheetPlan, params: CommitParams): Promise<SheetCommitResult> {
	const offeringId = plan.offeringId!;
	const summary = emptySummary();
	summary.rowsValid = plan.summary.rowsValid;
	summary.rowsWarning = plan.summary.rowsWarning;
	summary.rowsRejected = plan.summary.rowsRejected;
	summary.blankCells = plan.summary.blankCells;
	const actorRef = { actorId: params.actor.id, actorRole: params.actor.role, batchId: params.batchId };

	const mapped = new Map(plan.components.map((component, index) => [component.code, { component, index }]));
	for (const { component, index } of mapped.values()) {
		if (component.action === 'create') {
			const inserted = await tx
				.insert(assessmentComponents)
				.values({ offeringId, code: component.code, name: component.name, type: component.type, weightPercent: component.weightPercent, maxScore: component.maxScore, sortOrder: index })
				.onConflictDoNothing({ target: [assessmentComponents.offeringId, assessmentComponents.code] })
				.returning({ id: assessmentComponents.id });
			if (inserted.length) summary.componentsNew++;
		} else if (component.action === 'weight_change' && params.confirmations.weightChanges) {
			await tx.update(assessmentComponents).set({ weightPercent: component.weightPercent }).where(and(eq(assessmentComponents.offeringId, offeringId), eq(assessmentComponents.code, component.code)));
			summary.weightChanges++;
			await recordAudit(tx, {
				...actorRef,
				action: 'assessment_component.weight_change',
				entityType: 'assessment_component',
				entityId: `${offeringId}:${component.code}`,
				summary: `Bobot komponen ${component.code} diubah lewat impor`,
				before: { weightPercent: component.existingWeightPercent },
				after: { weightPercent: component.weightPercent }
			});
		}
	}
	const componentRows = await tx.select().from(assessmentComponents).where(eq(assessmentComponents.offeringId, offeringId));
	const componentId = new Map(componentRows.map((c) => [c.code, c.id]));

	const rows = plan.rows;
	const nims = [...new Set(rows.map((r) => r.nim))];
	const toCreate = new Map(rows.filter((r) => r.studentAction === 'create').map((r) => [r.nim, r.name]));
	if (toCreate.size) {
		const created = await tx
			.insert(students)
			.values([...toCreate].map(([nim, name]) => ({ nim, name, createdByBatchId: params.batchId })))
			.onConflictDoNothing({ target: students.nim })
			.returning({ nim: students.nim });
		summary.studentsNew = created.length;
	}
	const studentRows = nims.length ? await tx.select().from(students).where(inArray(students.nim, nims)) : [];
	const studentByNim = new Map(studentRows.map((s) => [s.nim, s]));
	summary.studentsExisting = nims.length - summary.studentsNew;

	const conflicts = rows.flatMap((r) => {
		const master = studentByNim.get(r.nim);
		return master && normalizeName(master.name) !== normalizeName(r.name)
			? [{ studentId: master.id, batchId: params.batchId, sheetName: plan.sheet, rowNumber: r.row, masterName: master.name, sourceName: r.name }]
			: [];
	});
	if (conflicts.length) await tx.insert(studentNameConflicts).values(conflicts).onConflictDoNothing();
	summary.nameConflicts = conflicts.length;

	const createdEnrollments = studentRows.length
		? await tx
				.insert(enrollments)
				.values(studentRows.map((s) => ({ studentId: s.id, offeringId, sourceBatchId: params.batchId })))
				.onConflictDoNothing({ target: [enrollments.studentId, enrollments.offeringId] })
				.returning({ id: enrollments.id })
		: [];
	summary.enrollmentsNew = createdEnrollments.length;
	summary.enrollmentsExisting = studentRows.length - createdEnrollments.length;
	const enrollmentRows = studentRows.length
		? await tx.select().from(enrollments).where(and(eq(enrollments.offeringId, offeringId), inArray(enrollments.studentId, studentRows.map((s) => s.id))))
		: [];
	const enrollmentByStudent = new Map(enrollmentRows.map((e) => [e.studentId, e.id]));

	type Intent = { enrollmentId: string; componentId: string; code: string; value: number; row: number };
	const intents: Intent[] = [];
	for (const row of rows) {
		const studentId = studentByNim.get(row.nim)?.id;
		const enrollmentId = studentId ? enrollmentByStudent.get(studentId) : undefined;
		if (!enrollmentId) continue;
		for (const score of row.scores) {
			const id = componentId.get(score.code);
			if (id) intents.push({ enrollmentId, componentId: id, code: score.code, value: score.newValue, row: row.row });
		}
	}

	const existingScores = intents.length
		? await tx
				.select()
				.from(assessmentScores)
				.where(and(inArray(assessmentScores.enrollmentId, [...new Set(intents.map((i) => i.enrollmentId))]), inArray(assessmentScores.componentId, [...componentId.values()])))
				.for('update')
		: [];
	const existingByKey = new Map(existingScores.map((s) => [`${s.enrollmentId}:${s.componentId}`, s]));
	const keyOf = (i: Intent) => `${i.enrollmentId}:${i.componentId}`;
	const sourceFields = (i: Intent) => ({ sourceBatchId: params.batchId, sourceSheet: plan.sheet, sourceRow: i.row });

	const fresh = intents.filter((i) => !existingByKey.has(keyOf(i)));
	const filled = intents.filter((i) => existingByKey.get(keyOf(i))?.score === null);
	const differing = intents.filter((i) => {
		const current = existingByKey.get(keyOf(i))?.score;
		return current !== undefined && current !== null && !sameStored(current, i.value);
	});
	summary.scoresUnchanged = intents.length - fresh.length - filled.length - differing.length;

	const revisions: (typeof assessmentScoreRevisions.$inferInsert)[] = [];
	const insertedKeys = new Set<string>();
	if (fresh.length) {
		const inserted = await tx
			.insert(assessmentScores)
			.values(fresh.map((i) => ({ enrollmentId: i.enrollmentId, componentId: i.componentId, score: i.value, ...sourceFields(i) })))
			.onConflictDoNothing({ target: [assessmentScores.enrollmentId, assessmentScores.componentId] })
			.returning({ enrollmentId: assessmentScores.enrollmentId, componentId: assessmentScores.componentId });
		for (const row of inserted) insertedKeys.add(`${row.enrollmentId}:${row.componentId}`);
	}
	const lostRace = fresh.filter((i) => !insertedKeys.has(keyOf(i)));
	for (const i of fresh.filter((x) => insertedKeys.has(keyOf(x))))
		revisions.push({ enrollmentId: i.enrollmentId, componentId: i.componentId, oldScore: null, newScore: i.value, changeType: 'import_initial', batchId: params.batchId, actorId: params.actor.id });
	summary.scoresNew += insertedKeys.size;

	for (const i of filled) {
		await tx.update(assessmentScores).set({ score: i.value, ...sourceFields(i) }).where(and(eq(assessmentScores.enrollmentId, i.enrollmentId), eq(assessmentScores.componentId, i.componentId)));
		revisions.push({ enrollmentId: i.enrollmentId, componentId: i.componentId, oldScore: null, newScore: i.value, changeType: 'import_initial', batchId: params.batchId, actorId: params.actor.id });
		summary.scoresNew++;
	}

	let skippedUpdates = 0;
	const updatable = params.strategy === 'upsert' ? [...differing, ...lostRace] : [];
	if (params.strategy !== 'upsert') skippedUpdates = differing.length;
	for (const i of updatable) {
		const [current] = await tx
			.select({ score: assessmentScores.score })
			.from(assessmentScores)
			.where(and(eq(assessmentScores.enrollmentId, i.enrollmentId), eq(assessmentScores.componentId, i.componentId)))
			.for('update');
		if (current && current.score !== null && sameStored(current.score, i.value)) {
			summary.scoresUnchanged++;
			continue;
		}
		await tx.update(assessmentScores).set({ score: i.value, ...sourceFields(i) }).where(and(eq(assessmentScores.enrollmentId, i.enrollmentId), eq(assessmentScores.componentId, i.componentId)));
		revisions.push({ enrollmentId: i.enrollmentId, componentId: i.componentId, oldScore: current?.score ?? null, newScore: i.value, changeType: 'import_update', batchId: params.batchId, actorId: params.actor.id });
		summary.scoresUpdated++;
		await recordAudit(tx, {
			...actorRef,
			action: 'assessment_score.update',
			entityType: 'assessment_score',
			entityId: `${i.enrollmentId}:${i.componentId}`,
			summary: `Nilai komponen ${i.code} diperbarui lewat impor (sheet ${plan.sheet}, baris ${i.row})`,
			before: { score: current?.score ?? null },
			after: { score: i.value }
		});
	}
	if (revisions.length) await tx.insert(assessmentScoreRevisions).values(revisions);

	const sheetInput = params.sheets.find((s) => s.sheetName === plan.sheet);
	const blueprint = sheetInput ? extractObeBlueprint(sheetInput.grid, analyzeSheet(sheetInput.grid, { headerRow: sheetInput.mapping.headerRow }), sheetInput.mapping) : null;
	const wantedCpmk = [...new Set([...(sheetInput?.mapping.cpmkColumns.map((c) => c.code) ?? []), ...(blueprint ? blueprintCpmkCodes(blueprint) : [])])];
	if (wantedCpmk.length) {
		const [offering] = await tx.select({ courseId: courseOfferings.courseId }).from(courseOfferings).where(eq(courseOfferings.id, offeringId)).limit(1);
		const created = await tx
			.insert(cpmkDefinitions)
			.values(wantedCpmk.map((code) => ({ courseId: offering.courseId, code })))
			.onConflictDoNothing({ target: [cpmkDefinitions.courseId, cpmkDefinitions.code] })
			.returning({ code: cpmkDefinitions.code });
		if (created.length)
			await recordAudit(tx, {
				...actorRef,
				action: 'cpmk.auto_create',
				entityType: 'course',
				entityId: offering.courseId,
				summary: `CPMK ${created.map((c) => c.code).join(', ')} dibuat otomatis dari kolom dan matriks Excel (sheet ${plan.sheet})`,
				after: { codes: created.map((c) => c.code) }
			});
	}
	const cpmkDefs = await tx.select({ id: cpmkDefinitions.id, code: cpmkDefinitions.code }).from(cpmkDefinitions).innerJoin(courseOfferings, eq(courseOfferings.courseId, cpmkDefinitions.courseId)).where(eq(courseOfferings.id, offeringId));
	const cplDefs = await tx.select({ id: cplDefinitions.id, code: cplDefinitions.code }).from(cplDefinitions);
	const cpmkIds = new Map(cpmkDefs.map((d) => [d.code, d.id]));
	const cplIds = new Map(cplDefs.map((d) => [d.code, d.id]));
	for (const row of rows) {
		const studentId = studentByNim.get(row.nim)?.id;
		const enrollmentId = studentId ? enrollmentByStudent.get(studentId) : undefined;
		if (!enrollmentId) continue;
		for (const reference of row.references) {
			if (reference.action === 'unchanged') {
				summary.referencesUnchanged++;
				continue;
			}
			const inputs = { sheet: plan.sheet, row: row.row, code: reference.code };
			if (reference.kind === 'cpmk') {
				const cpmkId = cpmkIds.get(reference.code);
				if (!cpmkId) continue;
				await tx
					.insert(cpmkResults)
					.values({ enrollmentId, cpmkId, source: 'imported_reference', value: reference.newValue, completeness: 'complete', formulaVersion: 'excel', batchId: params.batchId, inputs })
					.onConflictDoUpdate({
						target: [cpmkResults.enrollmentId, cpmkResults.cpmkId, cpmkResults.source],
						set: { value: sql`excluded.value`, batchId: params.batchId, inputs, computedAt: new Date() },
						setWhere: sql`${cpmkResults.value} is distinct from excluded.value`
					});
			} else {
				const cplId = cplIds.get(reference.code);
				if (!cplId) continue;
				await tx
					.insert(cplResults)
					.values({ enrollmentId, cplId, source: 'imported_reference', value: reference.newValue, completeness: 'complete', formulaVersion: 'excel', batchId: params.batchId, inputs })
					.onConflictDoUpdate({
						target: [cplResults.enrollmentId, cplResults.cplId, cplResults.source],
						set: { value: sql`excluded.value`, batchId: params.batchId, inputs, computedAt: new Date() },
						setWhere: sql`${cplResults.value} is distinct from excluded.value`
					});
			}
			if (reference.action === 'insert') summary.referencesNew++;
			else summary.referencesUpdated++;
		}
	}

	await recordAudit(tx, {
		...actorRef,
		action: 'import.commit.sheet',
		entityType: 'import_batch',
		entityId: params.batchId,
		summary: `Impor sheet "${plan.sheet}" ke offering ${offeringId}`,
		after: { students: { new: summary.studentsNew, reused: summary.studentsExisting }, enrollments: { new: summary.enrollmentsNew }, scores: { new: summary.scoresNew, updated: summary.scoresUpdated, unchanged: summary.scoresUnchanged }, skippedUpdates }
	});
	await tx
		.update(importSheetMappings)
		.set({
			status: 'committed',
			rowCount: rows.length,
			...(blueprint ? { mapping: sql`${importSheetMappings.mapping} || ${JSON.stringify({ blueprint })}::jsonb` } : {})
		})
		.where(and(eq(importSheetMappings.batchId, params.batchId), eq(importSheetMappings.sheetName, plan.sheet)));

	return { sheet: plan.sheet, offeringId, summary, enrollmentIds: enrollmentRows.map((e) => e.id), skippedUpdates };
}

function addSummary(target: PlanSummary, source: PlanSummary) {
	for (const key of Object.keys(target) as (keyof PlanSummary)[]) target[key] += source[key];
}

export async function commitImport(db: Database, params: CommitParams): Promise<CommitResult> {
	const [batch] = await db.select().from(importBatches).where(eq(importBatches.id, params.batchId)).limit(1);
	if (!batch) throw new ImportStateError('Batch impor tidak ditemukan.');
	if (batch.status === 'committed' || batch.status === 'cancelled') throw new ImportStateError('Batch impor sudah selesai atau dibatalkan.');
	await db.update(importBatches).set({ startedAt: new Date(), errorMessage: null }).where(eq(importBatches.id, params.batchId));

	try {
		return await db.transaction(async (tx) => {
			const included = params.sheets.filter((s) => s.include);
			const plans: SheetPlan[] = [];
			for (const sheet of included) plans.push(await planSheet(tx, sheet, { lock: true }));
			const blockers = plans.flatMap((plan, i) =>
				evaluateGate(plan, { strategy: params.strategy, errorPolicy: params.errorPolicy, confirmations: params.confirmations, acknowledgements: included[i].acknowledgements })
			);
			if (blockers.length) throw new ImportBlockedError(blockers);

			const total = emptySummary();
			const results: SheetCommitResult[] = [];
			for (const plan of plans) {
				const result = await applySheet(tx, plan, params);
				results.push(result);
				addSummary(total, result.summary);
			}
			const studentIds = await tx
				.select({ studentId: enrollments.studentId })
				.from(enrollments)
				.where(inArray(enrollments.id, results.flatMap((r) => r.enrollmentIds)));
			const distinctStudents = [...new Set(studentIds.map((s) => s.studentId))];
			const allNims = new Set(plans.flatMap((p) => p.rows.map((r) => r.nim)));
			total.studentsExisting = Math.max(0, allNims.size - total.studentsNew);

			await tx
				.update(importBatches)
				.set({
					status: 'committed',
					strategy: params.strategy,
					totalRows: total.rowsValid + total.rowsWarning + total.rowsRejected,
					validRows: total.rowsValid,
					warningRows: total.rowsWarning,
					errorRows: total.rowsRejected,
					studentsInserted: total.studentsNew,
					studentsReused: total.studentsExisting,
					enrollmentsInserted: total.enrollmentsNew,
					enrollmentsExisting: total.enrollmentsExisting,
					scoresInserted: total.scoresNew,
					scoresUpdated: total.scoresUpdated,
					scoresUnchanged: total.scoresUnchanged,
					referencesWritten: total.referencesNew + total.referencesUpdated,
					summary: { sheets: results.map((r) => ({ sheet: r.sheet, offeringId: r.offeringId, summary: r.summary, skippedUpdates: r.skippedUpdates })) },
					finishedAt: new Date()
				})
				.where(eq(importBatches.id, params.batchId));
			await recordAudit(tx, {
				actorId: params.actor.id,
				actorRole: params.actor.role,
				action: 'import.commit',
				entityType: 'import_batch',
				entityId: params.batchId,
				summary: `Impor ${results.length} sheet selesai`,
				after: { sheets: results.length, scoresNew: total.scoresNew, scoresUpdated: total.scoresUpdated },
				batchId: params.batchId
			});
			return { batchId: params.batchId, summary: total, sheets: results, studentIds: distinctStudents };
		});
	} catch (error) {
		if (error instanceof ImportBlockedError) throw error;
		const code = (error as { cause?: { code?: string } }).cause?.code ?? (error as { code?: string }).code ?? 'UNKNOWN';
		await db
			.update(importBatches)
			.set({ status: 'failed', errorMessage: `Penyimpanan gagal (kode ${code}). Tidak ada data akademik yang berubah.`, finishedAt: new Date() })
			.where(eq(importBatches.id, params.batchId));
		throw error;
	}
}
