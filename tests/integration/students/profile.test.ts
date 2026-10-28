import { beforeAll, describe, expect, test } from 'bun:test';
import { activatePolicy, createCpl, createCpmk, createDraftPolicy, setAssessmentCpmkMapping, setCplTarget, setCpmkCplMapping } from '#lib/features/curriculum/index.server.ts';
import { recomputeOffering } from '#lib/features/outcomes/index.server.ts';
import { getStudentProfile } from '#lib/features/students/index.server.ts';
import { assessmentScoreRevisions, assessmentScores, cplResults, cpmkResults } from '#lib/shared/db/schema.ts';
import { NotFoundError } from '#lib/shared/http/errors.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { attachBlueprint, createBatch, sampleBlueprint } from '../../support/imports.ts';
import { createComponent, createCourse, createEnrollment, createOffering, createStudent, createTerm, createUser } from '../../support/factories.ts';

const ctx = useIsolatedDatabase('students_profile');
let admin: { id: string; role: string };
let cplId: string;
let yearSeed = 2001;

beforeAll(async () => {
	const user = await createUser(ctx.db, { role: 'super_admin' });
	admin = { id: user.id, role: 'super_admin' };
	cplId = (await createCpl(ctx.db, admin, { code: 'CPL-1', title: 'Dasar biomedis' })).id;
	const policy = await createDraftPolicy(ctx.db, admin, { name: 'Kebijakan uji profil', achievementThreshold: 70, classAchievementRatio: 70, aggregationMethod: 'simple_mean' });
	await setCplTarget(ctx.db, admin, { policyId: policy.id, cplId, target: 75 });
	await activatePolicy(ctx.db, admin, policy.id);
});

async function twoSemesters() {
	const first = await createTerm(ctx.db, { startYear: yearSeed });
	const second = await createTerm(ctx.db, { startYear: yearSeed + 1 });
	yearSeed += 2;
	const course1 = await createCourse(ctx.db, { name: 'Biologi Sel Uji', credits: 3 });
	const course2 = await createCourse(ctx.db, { name: 'Instrumentasi Uji', credits: 3 });
	const offering1 = await createOffering(ctx.db, { courseId: course1.id, semesterId: first.semester.id });
	const offering2 = await createOffering(ctx.db, { courseId: course2.id, semesterId: second.semester.id });
	const student = await createStudent(ctx.db);

	const uts = await createComponent(ctx.db, { offeringId: offering1.id, code: 'UTS', weightPercent: 40 });
	const uas = await createComponent(ctx.db, { offeringId: offering1.id, code: 'UAS', weightPercent: 60 });
	const tugas = await createComponent(ctx.db, { offeringId: offering2.id, code: 'TUGAS', weightPercent: 100 });
	const cpmk1 = await createCpmk(ctx.db, admin, { courseId: course1.id, code: 'CPMK-1' });
	const cpmk2 = await createCpmk(ctx.db, admin, { courseId: course2.id, code: 'CPMK-1' });
	for (const [component, cpmk] of [[uts, cpmk1], [uas, cpmk1], [tugas, cpmk2]] as const) await setAssessmentCpmkMapping(ctx.db, admin, { componentId: component.id, cpmkId: cpmk.id });
	await setCpmkCplMapping(ctx.db, admin, { cpmkId: cpmk1.id, cplId, weight: 1 });
	await setCpmkCplMapping(ctx.db, admin, { cpmkId: cpmk2.id, cplId, weight: 1 });

	const enrollment1 = await createEnrollment(ctx.db, { offeringId: offering1.id, studentId: student.id });
	const enrollment2 = await createEnrollment(ctx.db, { offeringId: offering2.id, studentId: student.id });
	await ctx.db.insert(assessmentScores).values([
		{ enrollmentId: enrollment1.id, componentId: uts.id, score: 80 },
		{ enrollmentId: enrollment1.id, componentId: uas.id, score: 70 },
		{ enrollmentId: enrollment2.id, componentId: tugas.id, score: 90 }
	]);
	await recomputeOffering(ctx.db, admin, offering1.id, 'uji');
	await recomputeOffering(ctx.db, admin, offering2.id, 'uji');
	return { student, offering1, offering2, enrollment1, enrollment2, cpmk1, uts, uas, tugas, course1, course2 };
}

describe('getStudentProfile', () => {
	test('merangkum riwayat lintas semester dengan nilai akhir, CPMK, dan CPL tanpa pelacak per semester', async () => {
		const s = await twoSemesters();
		const profile = await getStudentProfile(ctx.db, 'all', s.student.id);
		expect(profile.student).toMatchObject({ id: s.student.id, nim: s.student.nim });
		expect(profile.scopeLimited).toBe(false);
		expect(profile.enrollments.map((e) => [e.courseName, e.final.value, e.final.status])).toEqual([['Biologi Sel Uji', 74, 'complete'], ['Instrumentasi Uji', 90, 'complete']]);
		expect(profile.enrollments[0].components.map((c) => [c.code, c.score])).toEqual([['UAS', 70], ['UTS', 80]]);
		expect(profile.enrollments[0].cpmk[0]).toMatchObject({ code: 'CPMK-1', value: 74, target: 70, achievement: 'tercapai', completeness: 'complete', formulaVersion: 'v1' });
		expect(profile.enrollments[0].cpl[0]).toMatchObject({ code: 'CPL-1', value: 74, target: 75, achievement: 'belum_tercapai' });
		expect(profile.enrollments[1].cpl[0]).toMatchObject({ value: 90, achievement: 'tercapai' });
		expect('semesters' in profile).toBe(false);
		expect(profile.cplSummary).toHaveLength(1);
		expect(profile.cplSummary[0].aggregate).toMatchObject({ status: 'complete', value: 82, entries: 2, used: 2, coverage: 1 });
		expect(profile.cplSummary[0]).toMatchObject({ target: 75, targetSource: 'policy', achievement: 'tercapai', assumedMethod: false });
		expect(profile.cplSummary[0].entries.map((e) => [e.value, e.basis])).toEqual([[74, 'calculated'], [90, 'calculated']]);
		expect(profile.policy).toMatchObject({ threshold: 70, aggregation: 'simple_mean' });
	});

	test('menyertakan nilai referensi Excel di samping hasil hitung tanpa mencampurnya', async () => {
		const s = await twoSemesters();
		await ctx.db.insert(cpmkResults).values({ enrollmentId: s.enrollment1.id, cpmkId: s.cpmk1.id, source: 'imported_reference', value: 73, completeness: 'complete' });
		const profile = await getStudentProfile(ctx.db, 'all', s.student.id);
		expect(profile.enrollments[0].cpmk[0]).toMatchObject({ value: 74, reference: 73, basis: 'calculated' });
		expect(profile.enrollments[1].cpmk[0].reference).toBeNull();
	});

	test('dosen hanya melihat kelas dalam cakupannya; mahasiswa di luar cakupan tidak ditemukan', async () => {
		const s = await twoSemesters();
		const scoped = await getStudentProfile(ctx.db, [s.offering1.id], s.student.id);
		expect(scoped.scopeLimited).toBe(true);
		expect(scoped.enrollments.map((e) => e.courseName)).toEqual(['Biologi Sel Uji']);
		expect(scoped.cplSummary[0].entries).toHaveLength(1);

		const other = await createStudent(ctx.db);
		await createEnrollment(ctx.db, { offeringId: s.offering2.id, studentId: other.id });
		await expect(getStudentProfile(ctx.db, [s.offering1.id], other.id)).rejects.toBeInstanceOf(NotFoundError);
		await expect(getStudentProfile(ctx.db, [], s.student.id)).rejects.toBeInstanceOf(NotFoundError);
		await expect(getStudentProfile(ctx.db, 'all', '3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b')).rejects.toBeInstanceOf(NotFoundError);
	});

	test('riwayat revisi nilai tampil terbaru dahulu dengan nama berkas sumber', async () => {
		const s = await twoSemesters();
		const batch = await createBatch(ctx.db, admin.id, { fileName: 'nilai-semester.xlsx' });
		await ctx.db.insert(assessmentScoreRevisions).values([
			{ enrollmentId: s.enrollment1.id, componentId: s.uts.id, oldScore: null, newScore: 75, changeType: 'import_initial', batchId: batch.id, createdAt: new Date('2026-01-01T00:00:00Z') },
			{ enrollmentId: s.enrollment1.id, componentId: s.uts.id, oldScore: 75, newScore: 80, changeType: 'import_update', batchId: batch.id, createdAt: new Date('2026-02-01T00:00:00Z') }
		]);
		const profile = await getStudentProfile(ctx.db, 'all', s.student.id);
		expect(profile.revisions.map((r) => [r.componentCode, r.oldScore, r.newScore, r.changeType, r.batchFileName])).toEqual([
			['UTS', 75, 80, 'import_update', 'nilai-semester.xlsx'],
			['UTS', null, 75, 'import_initial', 'nilai-semester.xlsx']
		]);
	});

	test('nilai komponen yang kosong menghasilkan status belum lengkap, bukan nol', async () => {
		const s = await twoSemesters();
		await ctx.db.insert(assessmentScores).values({ enrollmentId: (await createEnrollment(ctx.db, { offeringId: s.offering1.id, studentId: (await createStudent(ctx.db)).id })).id, componentId: s.uts.id, score: 80 });
		const [{ studentId }] = (await ctx.db.query.enrollments.findMany({ where: (t, { eq }) => eq(t.offeringId, s.offering1.id), orderBy: (t, { desc }) => desc(t.createdAt), limit: 1 })) as { studentId: string }[];
		const profile = await getStudentProfile(ctx.db, 'all', studentId);
		expect(profile.enrollments[0].final).toEqual({ value: null, status: 'incomplete', missing: ['UAS'] });
		expect(profile.enrollments[0].components.find((c) => c.code === 'UAS')?.score).toBeNull();
	});

	test('tanpa hasil hitung, nilai CPL dari kolom Excel dipakai dengan ambang dari Excel dan ditandai sumbernya', async () => {
		const term = await createTerm(ctx.db, { startYear: yearSeed });
		yearSeed += 1;
		const course = await createCourse(ctx.db, { name: 'Mata Kuliah Excel Uji', credits: 2 });
		const offering = await createOffering(ctx.db, { courseId: course.id, semesterId: term.semester.id });
		const student = await createStudent(ctx.db);
		const enrollment = await createEnrollment(ctx.db, { offeringId: offering.id, studentId: student.id });
		const cpl2 = await createCpl(ctx.db, admin, { code: 'CPL-2', title: 'CPL dari Excel' });
		await ctx.db.insert(cplResults).values({ enrollmentId: enrollment.id, cplId: cpl2.id, source: 'imported_reference', value: 66, completeness: 'complete', formulaVersion: 'excel' });
		const batch = await createBatch(ctx.db, admin.id);
		await attachBlueprint(ctx.db, { batchId: batch.id, offeringId: offering.id, sheetName: 'Sheet Excel Uji', blueprint: sampleBlueprint() });
		const profile = await getStudentProfile(ctx.db, 'all', student.id);
		expect(profile.enrollments[0].cpl[0]).toMatchObject({ value: 66, basis: 'imported_reference', target: 62, achievement: 'tercapai', completeness: 'complete' });
		expect(profile.cplSummary[0]).toMatchObject({ target: 62, targetSource: 'excel', achievement: 'tercapai' });
		expect(profile.cplSummary[0].entries).toEqual([{ courseName: 'Mata Kuliah Excel Uji', credits: 2, value: 66, basis: 'imported_reference' }]);
	});
});
