import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { DbExecutor } from '#lib/shared/db/client.server.ts';
import { courseOfferings, courses, semesters } from '#lib/features/academic/academic.schema.ts';
import { assessmentComponents, assessmentScoreRevisions, assessmentScores } from '#lib/features/assessment/assessment.schema.ts';
import { cplDefinitions, cpmkDefinitions } from '#lib/features/curriculum/curriculum.schema.ts';
import { enrollments } from '#lib/features/enrollments/enrollments.schema.ts';
import { importBatches } from '#lib/features/imports/imports.schema.ts';
import { aggregateCpl, classifyAchievement, computeFinalScore, loadActivePolicy, type CalcComponent } from '#lib/features/outcomes/index.server.ts';
import { cplResults, cpmkResults } from '#lib/features/outcomes/outcomes.schema.ts';
import { assertCanViewStudent, type StudentScope } from './students.queries.server.ts';
import { students } from './students.schema.ts';
import type { ProfileCplSummary, ProfileEnrollment, ProfileOutcome, ProfileRevision, StudentProfile } from './students.types.ts';

const round2 = (value: number) => Math.round(value * 100) / 100;
const revisionCap = 60;

export async function getStudentProfile(db: DbExecutor, scope: StudentScope, studentId: string): Promise<StudentProfile> {
	await assertCanViewStudent(db, scope, studentId);
	const [student] = await db.select({ id: students.id, nim: students.nim, name: students.name, cohortYear: students.cohortYear }).from(students).where(eq(students.id, studentId)).limit(1);
	const policy = await loadActivePolicy(db);

	const enrollmentRows = await db
		.select({
			enrollmentId: enrollments.id,
			offeringId: courseOfferings.id,
			courseCode: courses.code,
			courseName: courses.name,
			credits: courses.credits,
			section: courseOfferings.section,
			semesterId: semesters.id,
			semesterName: semesters.name,
			semesterStart: semesters.startDate
		})
		.from(enrollments)
		.innerJoin(courseOfferings, eq(courseOfferings.id, enrollments.offeringId))
		.innerJoin(courses, eq(courses.id, courseOfferings.courseId))
		.innerJoin(semesters, eq(semesters.id, courseOfferings.semesterId))
		.where(and(eq(enrollments.studentId, studentId), scope === 'all' ? undefined : inArray(courseOfferings.id, scope.length ? scope : ['00000000-0000-0000-0000-000000000000'])))
		.orderBy(asc(semesters.startDate), asc(courses.code));

	const enrollmentIds = enrollmentRows.map((e) => e.enrollmentId);
	const offeringIds = [...new Set(enrollmentRows.map((e) => e.offeringId))];
	const componentRows = offeringIds.length ? await db.select().from(assessmentComponents).where(and(inArray(assessmentComponents.offeringId, offeringIds), eq(assessmentComponents.isActive, true))).orderBy(asc(assessmentComponents.sortOrder), asc(assessmentComponents.code)) : [];
	const scoreRows = enrollmentIds.length ? await db.select().from(assessmentScores).where(inArray(assessmentScores.enrollmentId, enrollmentIds)) : [];
	const cpmkRows = enrollmentIds.length ? await db.select({ r: cpmkResults, code: cpmkDefinitions.code, description: cpmkDefinitions.description }).from(cpmkResults).innerJoin(cpmkDefinitions, eq(cpmkDefinitions.id, cpmkResults.cpmkId)).where(inArray(cpmkResults.enrollmentId, enrollmentIds)) : [];
	const cplRows = enrollmentIds.length ? await db.select({ r: cplResults, code: cplDefinitions.code, title: cplDefinitions.title, sortOrder: cplDefinitions.sortOrder }).from(cplResults).innerJoin(cplDefinitions, eq(cplDefinitions.id, cplResults.cplId)).where(inArray(cplResults.enrollmentId, enrollmentIds)) : [];

	const outcomeOf = (rows: { calculated?: { value: number | null; completeness: string; formulaVersion: string | null; computedAt: Date }; reference?: number | null }, meta: { code: string; title: string }, target: number | null): ProfileOutcome => {
		const calc = rows.calculated;
		const value = calc && calc.completeness === 'complete' ? calc.value : null;
		return { code: meta.code, title: meta.title, value, completeness: calc?.completeness === 'complete' ? 'complete' : 'incomplete', target, achievement: classifyAchievement(value, target), reference: rows.reference ?? null, formulaVersion: calc?.formulaVersion ?? null, computedAt: calc?.computedAt ?? null };
	};

	const views: ProfileEnrollment[] = enrollmentRows.map((row) => {
		const comps = componentRows.filter((c) => c.offeringId === row.offeringId);
		const scores = Object.fromEntries(scoreRows.filter((s) => s.enrollmentId === row.enrollmentId).map((s) => [s.componentId, s.score]));
		const calc: CalcComponent[] = comps.map((c) => ({ id: c.id, code: c.code, weightPercent: c.weightPercent, maxScore: c.maxScore, isRequired: c.isRequired }));
		const final = computeFinalScore(calc, scores);

		const cpmkOf = (enrollmentId: string) => {
			const mine = cpmkRows.filter((x) => x.r.enrollmentId === enrollmentId);
			return [...new Set(mine.map((x) => x.r.cpmkId))]
				.map((cpmkId) => {
					const entries = mine.filter((x) => x.r.cpmkId === cpmkId);
					const first = entries[0];
					const calculated = entries.find((x) => x.r.source === 'calculated')?.r;
					const reference = entries.find((x) => x.r.source === 'imported_reference')?.r.value ?? null;
					return outcomeOf({ calculated, reference }, { code: first.code, title: first.description ?? first.code }, policy?.threshold ?? null);
				})
				.sort((a, b) => a.code.localeCompare(b.code));
		};
		const cplOf = (enrollmentId: string) => {
			const mine = cplRows.filter((x) => x.r.enrollmentId === enrollmentId);
			return [...new Set(mine.map((x) => x.r.cplId))]
				.map((cplId) => {
					const entries = mine.filter((x) => x.r.cplId === cplId);
					const first = entries[0];
					const calculated = entries.find((x) => x.r.source === 'calculated')?.r;
					const reference = entries.find((x) => x.r.source === 'imported_reference')?.r.value ?? null;
					return { ...outcomeOf({ calculated, reference }, { code: first.code, title: first.title }, policy?.targets[cplId] ?? null), sortOrder: first.sortOrder };
				})
				.sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
				.map(({ sortOrder, ...rest }) => {
					void sortOrder;
					return rest;
				});
		};

		return {
			enrollmentId: row.enrollmentId,
			offeringId: row.offeringId,
			courseCode: row.courseCode,
			courseName: row.courseName,
			section: row.section,
			credits: row.credits,
			semesterId: row.semesterId,
			semesterName: row.semesterName,
			final: { value: final.value, status: final.status, missing: final.missing },
			components: comps.map((c) => ({ code: c.code, name: c.name, weightPercent: c.weightPercent, maxScore: c.maxScore, score: scores[c.id] ?? null })),
			cpmk: cpmkOf(row.enrollmentId),
			cpl: cplOf(row.enrollmentId)
		};
	});

	const semesterOrder = [...new Map(enrollmentRows.map((e) => [e.semesterId, e.semesterName])).entries()];
	const semesterSummary = semesterOrder.map(([id, name]) => {
		const inSemester = views.filter((v) => v.semesterId === id);
		const finals = inSemester.map((v) => v.final.value).filter((v): v is number => v !== null);
		return { id, name, mean: finals.length ? round2(finals.reduce((s, v) => s + v, 0) / finals.length) : null, courses: inSemester.length };
	});

	const cplCodes = [...new Map(views.flatMap((v) => v.cpl).map((c) => [c.code, c])).values()];
	const cplSummary: ProfileCplSummary[] = cplCodes.map((meta) => {
		const entries = views.flatMap((v) => v.cpl.filter((c) => c.code === meta.code).map((c) => ({ courseName: v.courseName, semesterName: v.semesterName, credits: v.credits, value: c.value })));
		return { code: meta.code, title: meta.title, target: meta.target, aggregate: aggregateCpl(entries.map((e) => ({ value: e.value, credits: e.credits })), policy?.aggregation ?? 'not_configured'), entries };
	});

	const revisionRows = enrollmentIds.length
		? await db
				.select({ r: assessmentScoreRevisions, componentCode: assessmentComponents.code, courseName: courses.name, fileName: importBatches.fileName })
				.from(assessmentScoreRevisions)
				.innerJoin(assessmentComponents, eq(assessmentComponents.id, assessmentScoreRevisions.componentId))
				.innerJoin(courseOfferings, eq(courseOfferings.id, assessmentComponents.offeringId))
				.innerJoin(courses, eq(courses.id, courseOfferings.courseId))
				.leftJoin(importBatches, eq(importBatches.id, assessmentScoreRevisions.batchId))
				.where(inArray(assessmentScoreRevisions.enrollmentId, enrollmentIds))
				.orderBy(desc(assessmentScoreRevisions.createdAt))
				.limit(revisionCap)
		: [];
	const revisions: ProfileRevision[] = revisionRows.map((x) => ({ id: x.r.id, at: x.r.createdAt, courseName: x.courseName, componentCode: x.componentCode, oldScore: x.r.oldScore, newScore: x.r.newScore, changeType: x.r.changeType, batchFileName: x.fileName }));

	return {
		student,
		enrollments: views,
		semesters: semesterSummary,
		cplSummary,
		revisions,
		policy: policy ? { name: policy.name, threshold: policy.threshold, aggregation: policy.aggregation } : null,
		scopeLimited: scope !== 'all'
	};
}
