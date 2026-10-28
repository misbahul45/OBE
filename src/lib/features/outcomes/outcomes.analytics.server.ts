import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { DbExecutor } from '#lib/shared/db/client.server.ts';
import { NotFoundError } from '#lib/shared/http/errors.ts';
import { courseOfferings, courses, lecturerAssignments, semesters } from '#lib/features/academic/academic.schema.ts';
import { assessmentComponents, assessmentCpmkMappings, assessmentScores } from '#lib/features/assessment/assessment.schema.ts';
import { cplDefinitions, cplTargets, cpmkDefinitions, outcomePolicies } from '#lib/features/curriculum/curriculum.schema.ts';
import { componentWeightSummary } from '#lib/features/curriculum/index.ts';
import { enrollments } from '#lib/features/enrollments/enrollments.schema.ts';
import { importBatches } from '#lib/features/imports/imports.schema.ts';
import { students } from '#lib/features/students/students.schema.ts';
import { loadBlueprints } from './outcomes.blueprint.server.ts';
import { cplResults, cpmkResults, outcomeCalculationRuns } from './outcomes.schema.ts';
import { achievementDistribution, aggregateCpl, chooseBasis, compareWithReference, computeFinalScore, normalizeScore, sumDistributions, type CalcComponent, type Distribution, type OutcomeBasis } from './outcomes.calc.ts';
import { buildTrace } from './outcomes.trace.ts';
import type { AttentionItem, ComponentStat, OfferingAnalytics, OutcomeStat, PolicyView, ProgramAnalytics, ProgramCpl, ProgramOffering, RosterRow, ScoreBin, ThresholdSource } from './outcomes.types.ts';

export type { AttentionItem, ComponentStat, OfferingAnalytics, OutcomeStat, PolicyView, ProgramAnalytics, ProgramCpl, ProgramOffering, RosterRow, ScoreBin };

const round2 = (value: number) => Math.round(value * 100) / 100;
const mean = (values: number[]) => (values.length ? round2(values.reduce((sum, v) => sum + v, 0) / values.length) : null);

export async function loadActivePolicy(db: DbExecutor): Promise<PolicyView | null> {
	const [policy] = await db.select().from(outcomePolicies).where(eq(outcomePolicies.status, 'active')).limit(1);
	if (!policy) return null;
	const targets = await db.select().from(cplTargets).where(eq(cplTargets.policyId, policy.id));
	return { id: policy.id, name: policy.name, threshold: policy.achievementThreshold, classRatio: policy.classAchievementRatio, aggregation: policy.aggregationMethod, targets: Object.fromEntries(targets.map((t) => [t.cplId, t.target])) };
}

const emptyBins = (): ScoreBin[] => Array.from({ length: 10 }, (_, i) => ({ from: i * 10, to: i === 9 ? 100 : i * 10 + 9.99, count: 0 }));

type ResolvedTarget = { value: number | null; source: ThresholdSource | null };

const resolveTarget = (policyValue: number | null | undefined, excelValue: number | null): ResolvedTarget =>
	policyValue !== null && policyValue !== undefined ? { value: policyValue, source: 'policy' } : excelValue !== null ? { value: excelValue, source: 'excel' } : { value: null, source: null };

function outcomeStat(
	meta: { id: string; code: string; title: string },
	calculatedRows: { enrollmentId: string; value: number | null; completeness: string }[],
	referenceRows: { enrollmentId: string; value: number | null; completeness: string }[],
	enrollmentIds: string[],
	target: ResolvedTarget,
	classRatio: number | null
): OutcomeStat {
	const chosen = chooseBasis(calculatedRows, referenceRows);
	const byEnrollment = new Map(chosen.rows.map((r) => [r.enrollmentId, r]));
	const values = enrollmentIds.map((id) => {
		const row = byEnrollment.get(id);
		return row && row.completeness === 'complete' ? row.value : null;
	});
	const distribution = achievementDistribution(values, target.value);
	const complete = values.filter((v): v is number => v !== null);
	const referenceValues = referenceRows.map((r) => r.value).filter((v): v is number => v !== null);
	const calculatedById = new Map(calculatedRows.map((r) => [r.enrollmentId, r]));
	const differing = referenceRows.filter((r) => compareWithReference(calculatedById.get(r.enrollmentId)?.value ?? null, r.value).differs).length;
	return {
		...meta,
		complete: complete.length,
		incomplete: chosen.rows.filter((r) => r.completeness === 'incomplete').length,
		mean: mean(complete),
		target: target.value,
		distribution,
		meetsClassRatio: classRatio === null || distribution.ratioAchieved === null ? null : distribution.ratioAchieved >= classRatio,
		basis: chosen.basis,
		targetSource: target.value === null ? null : target.source,
		classRatio,
		reference: referenceRows.length ? { count: referenceRows.length, mean: mean(referenceValues), differing } : null
	};
}

export async function getOfferingAnalytics(db: DbExecutor, offeringId: string): Promise<OfferingAnalytics> {
	const [head] = await db
		.select({ id: courseOfferings.id, courseId: courses.id, courseCode: courses.code, courseName: courses.name, section: courseOfferings.section, credits: courses.credits, semesterName: semesters.name })
		.from(courseOfferings)
		.innerJoin(courses, eq(courses.id, courseOfferings.courseId))
		.innerJoin(semesters, eq(semesters.id, courseOfferings.semesterId))
		.where(eq(courseOfferings.id, offeringId))
		.limit(1);
	if (!head) throw new NotFoundError('Penawaran kelas tidak ditemukan.');

	const policy = await loadActivePolicy(db);
	const sourceBlueprint = (await loadBlueprints(db, [offeringId])).get(offeringId) ?? null;
	const excelStudentScore = sourceBlueprint?.blueprint.thresholds.studentScore ?? null;
	const classRatio = policy?.classRatio ?? sourceBlueprint?.blueprint.thresholds.classRatioPercent ?? null;
	const componentRows = await db.select().from(assessmentComponents).where(and(eq(assessmentComponents.offeringId, offeringId), eq(assessmentComponents.isActive, true))).orderBy(asc(assessmentComponents.sortOrder), asc(assessmentComponents.code));
	const enrollmentRows = await db.select({ id: enrollments.id }).from(enrollments).where(eq(enrollments.offeringId, offeringId));
	const enrollmentIds = enrollmentRows.map((e) => e.id);
	const scoreRows = enrollmentIds.length && componentRows.length ? await db.select().from(assessmentScores).where(and(inArray(assessmentScores.enrollmentId, enrollmentIds), inArray(assessmentScores.componentId, componentRows.map((c) => c.id)))) : [];

	const cpmkRows = await db.select().from(cpmkDefinitions).where(and(eq(cpmkDefinitions.courseId, head.courseId), eq(cpmkDefinitions.isActive, true))).orderBy(asc(cpmkDefinitions.code));
	const mappingRows = componentRows.length ? await db.select().from(assessmentCpmkMappings).where(inArray(assessmentCpmkMappings.componentId, componentRows.map((c) => c.id))) : [];
	const cpmkCodeById = new Map(cpmkRows.map((c) => [c.id, c.code]));

	const byComponent = new Map<string, number[]>();
	const scoresByEnrollment = new Map<string, Record<string, number | null>>();
	for (const row of scoreRows) {
		const bucket = scoresByEnrollment.get(row.enrollmentId) ?? {};
		bucket[row.componentId] = row.score;
		scoresByEnrollment.set(row.enrollmentId, bucket);
		if (row.score !== null) byComponent.set(row.componentId, [...(byComponent.get(row.componentId) ?? []), row.score]);
	}

	const components: ComponentStat[] = componentRows.map((c) => {
		const raw = byComponent.get(c.id) ?? [];
		const normalized = raw.map((v) => normalizeScore(v, c.maxScore));
		return {
			id: c.id,
			code: c.code,
			name: c.name,
			type: c.type,
			weightPercent: c.weightPercent,
			maxScore: c.maxScore,
			scored: raw.length,
			blank: Math.max(0, enrollmentIds.length - raw.length),
			mean: mean(normalized),
			min: normalized.length ? round2(Math.min(...normalized)) : null,
			max: normalized.length ? round2(Math.max(...normalized)) : null,
			cpmkCodes: mappingRows.filter((m) => m.componentId === c.id).map((m) => cpmkCodeById.get(m.cpmkId) ?? '').filter(Boolean).sort()
		};
	});

	const calc: CalcComponent[] = componentRows.map((c) => ({ id: c.id, code: c.code, weightPercent: c.weightPercent, maxScore: c.maxScore, isRequired: c.isRequired }));
	const bins = emptyBins();
	const finals: number[] = [];
	let incompleteFinal = 0;
	let finalReason: string | null = null;
	for (const id of enrollmentIds) {
		const final = computeFinalScore(calc, scoresByEnrollment.get(id) ?? {});
		if (final.status === 'complete' && final.value !== null) {
			finals.push(final.value);
			bins[Math.min(9, Math.floor(final.value / 10))].count++;
		} else if (final.status === 'incomplete') incompleteFinal++;
		else finalReason = final.reason ?? 'NO_COMPONENTS';
	}

	const cpmkResultRows = enrollmentIds.length && cpmkRows.length ? await db.select().from(cpmkResults).where(and(inArray(cpmkResults.enrollmentId, enrollmentIds), inArray(cpmkResults.cpmkId, cpmkRows.map((c) => c.id)))) : [];
	const cplResultRows = enrollmentIds.length ? await db.select().from(cplResults).where(inArray(cplResults.enrollmentId, enrollmentIds)) : [];
	const cplIds = [...new Set(cplResultRows.map((r) => r.cplId))];
	const cplRows = cplIds.length ? await db.select().from(cplDefinitions).where(inArray(cplDefinitions.id, cplIds)).orderBy(asc(cplDefinitions.sortOrder), asc(cplDefinitions.code)) : [];

	const cpmk = cpmkRows.map((c) =>
		outcomeStat(
			{ id: c.id, code: c.code, title: c.description ?? c.code },
			cpmkResultRows.filter((r) => r.cpmkId === c.id && r.source === 'calculated'),
			cpmkResultRows.filter((r) => r.cpmkId === c.id && r.source === 'imported_reference'),
			enrollmentIds,
			resolveTarget(policy?.threshold, excelStudentScore),
			classRatio
		)
	);
	const cpl = cplRows.map((c) =>
		outcomeStat(
			{ id: c.id, code: c.code, title: c.title },
			cplResultRows.filter((r) => r.cplId === c.id && r.source === 'calculated'),
			cplResultRows.filter((r) => r.cplId === c.id && r.source === 'imported_reference'),
			enrollmentIds,
			resolveTarget(policy?.targets[c.id], excelStudentScore),
			classRatio
		)
	);

	const weights = componentWeightSummary(componentRows, 0.5);
	const warnings: string[] = [];
	if (componentRows.length === 0) warnings.push('Belum ada komponen penilaian. Impor nilai atau tentukan komponen terlebih dahulu.');
	else if (!weights.complete) warnings.push('Ada komponen tanpa bobot; nilai akhir dan CPMK belum dapat dihitung.');
	else if (!weights.ok) warnings.push(`Total bobot komponen ${weights.total}%, bukan 100%; nilai akhir tidak dihitung.`);
	const unmapped = components.filter((c) => c.cpmkCodes.length === 0).map((c) => c.code);
	const referenceOnly = [...cpmk, ...cpl].some((o) => o.basis === 'imported_reference');
	if (componentRows.length && unmapped.length)
		warnings.push(referenceOnly ? `Komponen belum dipetakan ke CPMK pada mesin hitung (${unmapped.join(', ')}); angka CPMK dan CPL yang tampil berasal dari kolom Excel.` : `Komponen belum dipetakan ke CPMK: ${unmapped.join(', ')}.`);
	if (cpmkRows.length === 0) warnings.push('Mata kuliah belum memiliki CPMK.');
	if (!policy && excelStudentScore !== null) warnings.push(`Kebijakan OBE belum aktif; ketercapaian memakai ambang dari Excel (nilai ${excelStudentScore}${classRatio !== null ? `, rasio kelas ${classRatio}%` : ''}).`);
	else if (!policy) warnings.push('Belum ada kebijakan OBE aktif; ketercapaian tidak dapat dinilai.');
	else if (policy.threshold === null && excelStudentScore === null) warnings.push('Ambang ketercapaian CPMK belum dikonfigurasi pada kebijakan aktif.');

	const [lastRun] = await db.select({ at: outcomeCalculationRuns.finishedAt }).from(outcomeCalculationRuns).where(eq(outcomeCalculationRuns.offeringId, offeringId)).orderBy(desc(outcomeCalculationRuns.startedAt)).limit(1);

	return {
		offering: { id: head.id, courseId: head.courseId, courseCode: head.courseCode, courseName: head.courseName, section: head.section, credits: head.credits, semesterName: head.semesterName },
		studentCount: enrollmentIds.length,
		policy,
		components,
		weights,
		finalScore: { complete: finals.length, incomplete: incompleteFinal, notConfigured: finalReason !== null, reason: finalReason, mean: mean(finals), bins },
		cpmk,
		cpl,
		thresholds: { studentScore: policy?.threshold ?? excelStudentScore, classRatio, source: policy?.threshold != null ? 'policy' : excelStudentScore !== null ? 'excel' : null },
		trace: sourceBlueprint ? buildTrace({ blueprint: sourceBlueprint.blueprint, components, cpmk, cpl, source: { fileName: sourceBlueprint.fileName, sheetName: sourceBlueprint.sheetName } }) : null,
		warnings,
		lastRunAt: lastRun?.at ?? null
	};
}

export async function getProgramAnalytics(db: DbExecutor, semesterId?: string): Promise<ProgramAnalytics> {
	const [semester] = semesterId
		? await db.select({ id: semesters.id, name: semesters.name }).from(semesters).where(eq(semesters.id, semesterId)).limit(1)
		: await db.select({ id: semesters.id, name: semesters.name }).from(semesters).where(eq(semesters.status, 'active')).limit(1);
	const policy = await loadActivePolicy(db);
	const [committed, open] = await Promise.all([
		db.select({ id: importBatches.id }).from(importBatches).where(eq(importBatches.status, 'committed')),
		db.select({ id: importBatches.id }).from(importBatches).where(inArray(importBatches.status, ['uploaded', 'mapped', 'validated']))
	]);
	if (!semester) return { semester: null, policy, totals: { offerings: 0, lecturers: 0, students: 0, enrollments: 0, committedImports: committed.length, openImports: open.length, offeringsWithResults: 0 }, cpl: [], attention: [] };

	const offeringRows = await db
		.select({ id: courseOfferings.id, courseCode: courses.code, courseName: courses.name, section: courseOfferings.section, credits: courses.credits })
		.from(courseOfferings)
		.innerJoin(courses, eq(courses.id, courseOfferings.courseId))
		.where(eq(courseOfferings.semesterId, semester.id))
		.orderBy(asc(courses.code), asc(courseOfferings.section));
	const offeringIds = offeringRows.map((o) => o.id);
	const enrollmentRows = offeringIds.length ? await db.select({ id: enrollments.id, offeringId: enrollments.offeringId, studentId: enrollments.studentId }).from(enrollments).where(inArray(enrollments.offeringId, offeringIds)) : [];
	const assignments = offeringIds.length ? await db.select({ lecturerId: lecturerAssignments.lecturerId, offeringId: lecturerAssignments.offeringId }).from(lecturerAssignments).where(inArray(lecturerAssignments.offeringId, offeringIds)) : [];
	const enrollmentIds = enrollmentRows.map((e) => e.id);
	const offeringOfEnrollment = new Map(enrollmentRows.map((e) => [e.id, e.offeringId]));
	const blueprints = await loadBlueprints(db, offeringIds);
	const excelScores = [...blueprints.values()].map((b) => b.blueprint.thresholds.studentScore).filter((v): v is number => v !== null);
	const commonExcelScore = excelScores.length > 0 && excelScores.every((v) => v === excelScores[0]) ? excelScores[0] : null;
	const cplRows = enrollmentIds.length ? await db.select().from(cplResults).where(inArray(cplResults.enrollmentId, enrollmentIds)) : [];
	const cplMeta = cplRows.length ? await db.select().from(cplDefinitions).where(inArray(cplDefinitions.id, [...new Set(cplRows.map((r) => r.cplId))])).orderBy(asc(cplDefinitions.sortOrder), asc(cplDefinitions.code)) : [];
	const withResults = new Set(cplRows.map((r) => offeringOfEnrollment.get(r.enrollmentId)));

	const cpl: ProgramCpl[] = cplMeta.map((meta) => {
		const programTarget = resolveTarget(policy?.targets[meta.id], commonExcelScore);
		const offerings: ProgramOffering[] = [];
		for (const offering of offeringRows) {
			const own = cplRows.filter((r) => r.cplId === meta.id && offeringOfEnrollment.get(r.enrollmentId) === offering.id);
			if (own.length === 0) continue;
			const chosen = chooseBasis(own.filter((r) => r.source === 'calculated'), own.filter((r) => r.source === 'imported_reference'));
			const byEnrollment = new Map(chosen.rows.map((r) => [r.enrollmentId, r]));
			const classEnrollments = enrollmentRows.filter((e) => e.offeringId === offering.id);
			const values = classEnrollments.map((e) => {
				const row = byEnrollment.get(e.id);
				return row && row.completeness === 'complete' ? row.value : null;
			});
			const complete = values.filter((v): v is number => v !== null);
			const target = resolveTarget(policy?.targets[meta.id], blueprints.get(offering.id)?.blueprint.thresholds.studentScore ?? commonExcelScore).value;
			const distribution = achievementDistribution(values, target);
			offerings.push({
				offeringId: offering.id,
				courseCode: offering.courseCode,
				courseName: offering.courseName,
				section: offering.section,
				credits: offering.credits,
				students: classEnrollments.length,
				complete: complete.length,
				mean: mean(complete),
				ratioAchieved: distribution.ratioAchieved,
				distribution,
				basis: (chosen.basis ?? 'calculated') as OutcomeBasis
			});
		}
		const aggregate = aggregateCpl(offerings.map((o) => ({ value: o.mean, credits: o.credits })), policy?.aggregation ?? 'not_configured');
		return { id: meta.id, code: meta.code, title: meta.title, target: programTarget.value, targetSource: programTarget.source, offerings, aggregate, distribution: sumDistributions(offerings.map((o) => o.distribution)) };
	});

	const attention: AttentionItem[] = [];
	for (const offering of offeringRows) {
		const label = `${offering.courseCode} · ${offering.courseName} (Kelas ${offering.section})`;
		const students = enrollmentRows.filter((e) => e.offeringId === offering.id).length;
		if (!assignments.some((a) => a.offeringId === offering.id)) attention.push({ offeringId: offering.id, label, reason: 'Belum ada dosen pengampu' });
		else if (students === 0) attention.push({ offeringId: offering.id, label, reason: 'Belum ada nilai yang diimpor' });
		else if (!withResults.has(offering.id)) attention.push({ offeringId: offering.id, label, reason: 'Nilai ada tetapi hasil CPL belum terhitung; periksa komponen, bobot, dan pemetaan CPMK' });
	}

	return {
		semester,
		policy,
		totals: {
			offerings: offeringRows.length,
			lecturers: new Set(assignments.map((a) => a.lecturerId)).size,
			students: new Set(enrollmentRows.map((e) => e.studentId)).size,
			enrollments: enrollmentRows.length,
			committedImports: committed.length,
			openImports: open.length,
			offeringsWithResults: [...withResults].filter(Boolean).length
		},
		cpl,
		attention
	};
}

export async function getOfferingRoster(db: DbExecutor, offeringId: string): Promise<RosterRow[]> {
	const rows = await db
		.select({ enrollmentId: enrollments.id, studentId: students.id, nim: students.nim, name: students.name })
		.from(enrollments)
		.innerJoin(students, eq(students.id, enrollments.studentId))
		.where(eq(enrollments.offeringId, offeringId))
		.orderBy(asc(students.name), asc(students.nim));
	if (rows.length === 0) return [];
	const componentRows = await db.select().from(assessmentComponents).where(and(eq(assessmentComponents.offeringId, offeringId), eq(assessmentComponents.isActive, true)));
	const calc: CalcComponent[] = componentRows.map((c) => ({ id: c.id, code: c.code, weightPercent: c.weightPercent, maxScore: c.maxScore, isRequired: c.isRequired }));
	const ids = rows.map((r) => r.enrollmentId);
	const scoreRows = componentRows.length ? await db.select().from(assessmentScores).where(and(inArray(assessmentScores.enrollmentId, ids), inArray(assessmentScores.componentId, componentRows.map((c) => c.id)))) : [];
	const scoresBy = new Map<string, Record<string, number | null>>();
	for (const row of scoreRows) scoresBy.set(row.enrollmentId, { ...(scoresBy.get(row.enrollmentId) ?? {}), [row.componentId]: row.score });
	const cpmkRows = await db.select({ enrollmentId: cpmkResults.enrollmentId, cpmkId: cpmkResults.cpmkId, value: cpmkResults.value, completeness: cpmkResults.completeness, source: cpmkResults.source }).from(cpmkResults).where(inArray(cpmkResults.enrollmentId, ids));
	return rows.map((row) => {
		const final = computeFinalScore(calc, scoresBy.get(row.enrollmentId) ?? {});
		const cpmk: Record<string, number | null> = {};
		const cpmkBasis: Record<string, OutcomeBasis> = {};
		const mine = cpmkRows.filter((r) => r.enrollmentId === row.enrollmentId);
		for (const r of mine.filter((x) => x.source === 'imported_reference')) {
			cpmk[r.cpmkId] = r.completeness === 'complete' ? r.value : null;
			cpmkBasis[r.cpmkId] = 'imported_reference';
		}
		for (const r of mine.filter((x) => x.source === 'calculated')) {
			if (r.completeness === 'complete' && r.value !== null) {
				cpmk[r.cpmkId] = r.value;
				cpmkBasis[r.cpmkId] = 'calculated';
			} else if (cpmk[r.cpmkId] === undefined) cpmk[r.cpmkId] = null;
		}
		return { ...row, finalScore: final.value, status: final.status, missing: final.missing, cpmk, cpmkBasis };
	});
}
