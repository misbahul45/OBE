import { and, eq, inArray } from 'drizzle-orm';
import type { DbExecutor } from '#lib/shared/db/client.server.ts';
import { maskNim } from '#lib/features/audit/index.server.ts';
import { courseOfferings } from '#lib/features/academic/academic.schema.ts';
import { assessmentComponents, assessmentScores } from '#lib/features/assessment/assessment.schema.ts';
import { cplDefinitions, cpmkDefinitions } from '#lib/features/curriculum/curriculum.schema.ts';
import { enrollments } from '#lib/features/enrollments/enrollments.schema.ts';
import { cplResults, cpmkResults } from '#lib/features/outcomes/outcomes.schema.ts';
import { students } from '#lib/features/students/students.schema.ts';
import {
	emptySummary,
	type ChangeAction,
	type GateOptions,
	type PlanBlocker,
	type PlannedComponent,
	type PlannedReference,
	type PlannedRow,
	type PlannedScore,
	type SheetImportInput,
	type SheetPlan
} from './imports.plan.types.ts';
import { validateSheet } from './validation.ts';

export type PlanOptions = { lock?: boolean; weightTolerancePercent?: number };

const sameNumber = (a: number | null, b: number | null) => a !== null && b !== null && Math.abs(a - b) < 0.00005;
const normalizeName = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();

function classify(existing: number | null | undefined, incoming: number): ChangeAction {
	if (existing === null || existing === undefined) return 'insert';
	return sameNumber(existing, incoming) ? 'unchanged' : 'update';
}

export async function planSheet(executor: DbExecutor, input: SheetImportInput, options: PlanOptions = {}): Promise<SheetPlan> {
	const lockMode = options.lock ? ('update' as const) : undefined;
	let courseId: string | null = null;
	let knownCpmk: Set<string> | null = null;
	let knownCpl: Set<string> | null = null;
	let cpmkIdByCode = new Map<string, string>();
	let cplIdByCode = new Map<string, string>();

	if (input.offeringId) {
		const [offering] = await executor.select({ id: courseOfferings.id, courseId: courseOfferings.courseId }).from(courseOfferings).where(eq(courseOfferings.id, input.offeringId)).limit(1);
		courseId = offering?.courseId ?? null;
	}
	if (courseId) {
		const cpmk = await executor.select({ id: cpmkDefinitions.id, code: cpmkDefinitions.code }).from(cpmkDefinitions).where(and(eq(cpmkDefinitions.courseId, courseId), eq(cpmkDefinitions.isActive, true)));
		cpmkIdByCode = new Map(cpmk.map((c) => [c.code, c.id]));
		knownCpmk = new Set(cpmkIdByCode.keys());
	}
	const cpl = await executor.select({ id: cplDefinitions.id, code: cplDefinitions.code }).from(cplDefinitions).where(eq(cplDefinitions.isActive, true));
	cplIdByCode = new Map(cpl.map((c) => [c.code, c.id]));
	knownCpl = new Set(cplIdByCode.keys());

	const validation = validateSheet(input.grid, input.mapping, {
		knownCpmkCodes: courseId ? knownCpmk : null,
		knownCplCodes: knownCpl,
		weightTolerancePercent: options.weightTolerancePercent
	});

	const summary = emptySummary();
	summary.blankCells = validation.summary.blankCells;
	const accepted = validation.rows.filter((r) => r.status !== 'error' && r.nim !== null && r.name !== null);
	summary.rowsValid = validation.rows.filter((r) => r.status === 'valid').length;
	summary.rowsWarning = validation.rows.filter((r) => r.status === 'warning').length;
	summary.rowsRejected = validation.rows.filter((r) => r.status === 'error').length;

	const base: SheetPlan = {
		sheet: input.sheetName,
		offeringId: input.offeringId,
		included: input.include,
		validation,
		components: [],
		rows: [],
		summary,
		needsNumericNimAck: validation.summary.numericNimRows > 0,
		offeringFound: courseId !== null
	};
	if (!input.offeringId || !courseId) return base;

	const existingComponents = await executor.select().from(assessmentComponents).where(eq(assessmentComponents.offeringId, input.offeringId));
	const componentByCode = new Map(existingComponents.map((c) => [c.code, c]));
	const plannedComponents: PlannedComponent[] = input.mapping.components.map((component) => {
		const existing = componentByCode.get(component.code);
		const weightChanged = existing !== undefined && existing.weightPercent !== null && !sameNumber(existing.weightPercent, component.weightPercent);
		return {
			code: component.code,
			name: component.name,
			type: component.type,
			weightPercent: component.weightPercent,
			maxScore: component.maxScore,
			action: existing === undefined ? 'create' : weightChanged ? 'weight_change' : 'existing',
			existingWeightPercent: existing?.weightPercent ?? null
		};
	});
	summary.componentsNew = plannedComponents.filter((c) => c.action === 'create').length;
	summary.weightChanges = plannedComponents.filter((c) => c.action === 'weight_change').length;

	const nims = accepted.map((r) => r.nim!);
	const foundStudents = nims.length ? await executor.select().from(students).where(inArray(students.nim, nims)) : [];
	const studentByNim = new Map(foundStudents.map((s) => [s.nim, s]));
	const foundEnrollments = foundStudents.length
		? await executor.select().from(enrollments).where(and(eq(enrollments.offeringId, input.offeringId), inArray(enrollments.studentId, foundStudents.map((s) => s.id))))
		: [];
	const enrollmentByStudent = new Map(foundEnrollments.map((e) => [e.studentId, e]));

	const existingComponentIds = existingComponents.map((c) => c.id);
	const scoreQuery = foundEnrollments.length && existingComponentIds.length
		? executor.select().from(assessmentScores).where(and(inArray(assessmentScores.enrollmentId, foundEnrollments.map((e) => e.id)), inArray(assessmentScores.componentId, existingComponentIds)))
		: null;
	const foundScores = scoreQuery ? (lockMode ? await scoreQuery.for('update') : await scoreQuery) : [];
	const scoreByKey = new Map(foundScores.map((s) => [`${s.enrollmentId}:${s.componentId}`, s.score]));

	const enrollmentIds = foundEnrollments.map((e) => e.id);
	const cpmkExisting = enrollmentIds.length ? await executor.select().from(cpmkResults).where(and(inArray(cpmkResults.enrollmentId, enrollmentIds), eq(cpmkResults.source, 'imported_reference'))) : [];
	const cplExisting = enrollmentIds.length ? await executor.select().from(cplResults).where(and(inArray(cplResults.enrollmentId, enrollmentIds), eq(cplResults.source, 'imported_reference'))) : [];
	const cpmkValue = new Map(cpmkExisting.map((r) => [`${r.enrollmentId}:${r.cpmkId}`, r.value]));
	const cplValue = new Map(cplExisting.map((r) => [`${r.enrollmentId}:${r.cplId}`, r.value]));

	const newNims = new Set<string>();
	for (const parsed of accepted) {
		const nim = parsed.nim!;
		const master = studentByNim.get(nim);
		const enrollment = master ? enrollmentByStudent.get(master.id) : undefined;
		const isNewStudent = !master && !newNims.has(nim);
		if (!master) newNims.add(nim);
		const nameConflict = !!master && normalizeName(master.name) !== normalizeName(parsed.name!);

		const scores: PlannedScore[] = [];
		for (const component of input.mapping.components) {
			const value = parsed.scores[component.code];
			if (value === null || value === undefined) continue;
			const existingComponent = componentByCode.get(component.code);
			const old = enrollment && existingComponent ? (scoreByKey.get(`${enrollment.id}:${existingComponent.id}`) ?? null) : null;
			scores.push({ code: component.code, action: classify(old, value), oldValue: old, newValue: value });
		}

		const references: PlannedReference[] = [];
		for (const [code, value] of Object.entries(parsed.references.cpmk)) {
			if (value === null) continue;
			const id = cpmkIdByCode.get(code);
			if (!id) continue;
			const old = enrollment ? (cpmkValue.get(`${enrollment.id}:${id}`) ?? null) : null;
			references.push({ kind: 'cpmk', code, action: classify(old, value), newValue: value });
		}
		for (const [code, value] of Object.entries(parsed.references.cpl)) {
			if (value === null) continue;
			const id = cplIdByCode.get(code);
			if (!id) continue;
			const old = enrollment ? (cplValue.get(`${enrollment.id}:${id}`) ?? null) : null;
			references.push({ kind: 'cpl', code, action: classify(old, value), newValue: value });
		}

		base.rows.push({
			row: parsed.row,
			nim,
			nimMasked: maskNim(nim),
			name: parsed.name!,
			studentAction: master ? 'reuse' : 'create',
			masterName: master?.name ?? null,
			nameConflict,
			enrollmentAction: enrollment ? 'existing' : 'create',
			scores,
			references,
			blankComponents: parsed.blankComponents,
			issues: parsed.issues
		});
		if (isNewStudent) summary.studentsNew++;
		else if (master) summary.studentsExisting++;
		if (enrollment) summary.enrollmentsExisting++;
		else summary.enrollmentsNew++;
		if (nameConflict) summary.nameConflicts++;
		for (const score of scores) {
			if (score.action === 'insert') summary.scoresNew++;
			else if (score.action === 'update') summary.scoresUpdated++;
			else summary.scoresUnchanged++;
		}
		for (const reference of references) {
			if (reference.action === 'insert') summary.referencesNew++;
			else if (reference.action === 'update') summary.referencesUpdated++;
			else summary.referencesUnchanged++;
		}
	}
	base.components = plannedComponents;
	return base;
}

export function evaluateGate(plan: SheetPlan, options: GateOptions): PlanBlocker[] {
	if (!plan.included) return [];
	const blockers: PlanBlocker[] = [];
	const add = (code: PlanBlocker['code'], message: string) => blockers.push({ code, sheet: plan.sheet, message: `Sheet "${plan.sheet}": ${message}` });

	if (!plan.offeringId) {
		add('OFFERING_NOT_SELECTED', 'belum dipetakan ke offering mata kuliah.');
		return blockers;
	}
	if (!plan.offeringFound) {
		add('OFFERING_NOT_FOUND', 'offering tidak ditemukan.');
		return blockers;
	}
	if (plan.validation.issues.some((i) => i.severity === 'error' && i.code !== 'NIM_NUMERIC_SOURCE'))
		add('SHEET_ERRORS', `terdapat galat tingkat sheet (${[...new Set(plan.validation.issues.filter((i) => i.severity === 'error').map((i) => i.code))].join(', ')}).`);
	if (plan.summary.rowsRejected > 0 && options.errorPolicy === 'block_on_error') add('ROW_ERRORS', `${plan.summary.rowsRejected} baris bergalat; perbaiki atau pilih lewati baris bergalat.`);
	if (plan.needsNumericNimAck && !options.acknowledgements.numericNim) add('NIM_NUMERIC_UNACKNOWLEDGED', 'NIM tersimpan sebagai angka; konfirmasi bahwa tidak ada NIM berawalan 0.');
	if (options.strategy === 'upsert' && plan.summary.scoresUpdated > 0 && !options.confirmations.scoreUpdates)
		add('SCORE_UPDATES_UNCONFIRMED', `${plan.summary.scoresUpdated} nilai lama akan diperbarui; konfirmasi diperlukan.`);
	if (plan.summary.weightChanges > 0 && !options.confirmations.weightChanges) add('WEIGHT_CHANGES_UNCONFIRMED', `${plan.summary.weightChanges} bobot komponen berubah; konfirmasi diperlukan.`);
	const importable = plan.rows.length > 0;
	if (!importable && plan.summary.rowsRejected === 0) add('NOTHING_TO_IMPORT', 'tidak ada baris yang dapat diimpor.');
	if (!importable && plan.summary.rowsRejected > 0 && options.errorPolicy === 'skip_invalid_rows') add('NOTHING_TO_IMPORT', 'seluruh baris bergalat.');
	return blockers;
}

export function summarizePlans(plans: SheetPlan[]) {
	const total = emptySummary();
	const newNims = new Set<string>();
	for (const plan of plans) {
		if (!plan.included) continue;
		for (const key of Object.keys(total) as (keyof typeof total)[]) {
			if (key === 'studentsNew' || key === 'studentsExisting') continue;
			total[key] += plan.summary[key];
		}
		for (const row of plan.rows) {
			if (row.studentAction === 'create') newNims.add(row.nim);
		}
	}
	const allNims = new Set(plans.filter((p) => p.included).flatMap((p) => p.rows.map((r) => r.nim)));
	total.studentsNew = newNims.size;
	total.studentsExisting = allNims.size - newNims.size;
	return total;
}
