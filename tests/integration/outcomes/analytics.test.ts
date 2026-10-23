import { beforeAll, describe, expect, test } from 'bun:test';
import { activatePolicy, createCpl, createCpmk, createDraftPolicy, setAssessmentCpmkMapping, setCplTarget, setCpmkCplMapping } from '#lib/features/curriculum/index.server.ts';
import { getOfferingAnalytics, getOfferingRoster, getProgramAnalytics, recomputeOffering } from '#lib/features/outcomes/index.server.ts';
import { activateSemester, assignLecturer } from '#lib/features/academic/index.server.ts';
import { assessmentScores, cpmkResults } from '#lib/shared/db/schema.ts';
import { NotFoundError } from '#lib/shared/http/errors.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { createComponent, createCourse, createEnrollment, createLecturer, createOffering, createStudent, createTerm, createUser } from '../../support/factories.ts';

const ctx = useIsolatedDatabase('outcomes_analytics');
let admin: { id: string; role: string };
let cplId: string;

beforeAll(async () => {
	const user = await createUser(ctx.db, { role: 'super_admin' });
	admin = { id: user.id, role: 'super_admin' };
	const cpl = await createCpl(ctx.db, admin, { code: 'CPL-1', title: 'CPL analitik' });
	cplId = cpl.id;
	const policy = await createDraftPolicy(ctx.db, admin, { name: 'Kebijakan uji analitik', achievementThreshold: 70, classAchievementRatio: 70, aggregationMethod: 'simple_mean' });
	await setCplTarget(ctx.db, admin, { policyId: policy.id, cplId, target: 75 });
	await activatePolicy(ctx.db, admin, policy.id);
});

async function scene(semesterId?: string) {
	const course = await createCourse(ctx.db, { credits: 3 });
	const offering = await createOffering(ctx.db, { courseId: course.id, semesterId });
	const a = await createComponent(ctx.db, { offeringId: offering.id, code: 'UTS', weightPercent: 40 });
	const b = await createComponent(ctx.db, { offeringId: offering.id, code: 'UAS', weightPercent: 60 });
	const cpmk = await createCpmk(ctx.db, admin, { courseId: course.id, code: 'CPMK-1' });
	await setAssessmentCpmkMapping(ctx.db, admin, { componentId: a.id, cpmkId: cpmk.id });
	await setAssessmentCpmkMapping(ctx.db, admin, { componentId: b.id, cpmkId: cpmk.id });
	await setCpmkCplMapping(ctx.db, admin, { cpmkId: cpmk.id, cplId, weight: 1 });
	const data: [number | null, number | null][] = [[80, 70], [60, 50], [90, 100], [50, null]];
	const enrolled = [];
	for (const [x, y] of data) {
		const enrollment = await createEnrollment(ctx.db, { offeringId: offering.id, studentId: (await createStudent(ctx.db)).id });
		await ctx.db.insert(assessmentScores).values([{ enrollmentId: enrollment.id, componentId: a.id, score: x }, { enrollmentId: enrollment.id, componentId: b.id, score: y }]);
		enrolled.push(enrollment);
	}
	await recomputeOffering(ctx.db, admin, offering.id, 'uji');
	return { course, offering, a, b, cpmk, enrolled };
}

describe('getOfferingAnalytics', () => {
	test('menghitung statistik komponen, nilai akhir, CPMK, dan CPL sesuai perhitungan manual', async () => {
		const s = await scene();
		const result = await getOfferingAnalytics(ctx.db, s.offering.id);

		expect(result.studentCount).toBe(4);
		expect(result.weights).toMatchObject({ total: 100, ok: true, complete: true });
		const uts = result.components.find((c) => c.code === 'UTS')!;
		expect(uts).toMatchObject({ scored: 4, blank: 0, mean: 70, min: 50, max: 90, cpmkCodes: ['CPMK-1'] });
		const uas = result.components.find((c) => c.code === 'UAS')!;
		expect(uas).toMatchObject({ scored: 3, blank: 1, mean: 73.33, min: 50, max: 100 });

		expect(result.finalScore).toMatchObject({ complete: 3, incomplete: 1, notConfigured: false, mean: 74.67 });
		const filled = result.finalScore.bins.filter((bin) => bin.count > 0).map((bin) => [bin.from, bin.count]);
		expect(filled).toEqual([[50, 1], [70, 1], [90, 1]]);

		const cpmk = result.cpmk[0];
		expect(cpmk).toMatchObject({ code: 'CPMK-1', complete: 3, incomplete: 1, mean: 74.67, target: 70, meetsClassRatio: false });
		expect(cpmk.distribution).toMatchObject({ achieved: 2, notAchieved: 1, insufficient: 1, total: 4, ratioAchieved: 66.6667 });

		const cpl = result.cpl[0];
		expect(cpl).toMatchObject({ complete: 3, mean: 74.67, target: 75 });
		expect(cpl.distribution).toMatchObject({ achieved: 1, notAchieved: 2, ratioAchieved: 33.3333 });
		expect(result.warnings).toEqual([]);
		expect(result.lastRunAt).toBeInstanceOf(Date);
	});

	test('membandingkan nilai CPMK referensi Excel dengan hasil hitung tanpa menimpanya', async () => {
		const s = await scene();
		await ctx.db.insert(cpmkResults).values([
			{ enrollmentId: s.enrolled[0].id, cpmkId: s.cpmk.id, source: 'imported_reference', value: 74, completeness: 'complete' },
			{ enrollmentId: s.enrolled[1].id, cpmkId: s.cpmk.id, source: 'imported_reference', value: 60, completeness: 'complete' }
		]);
		const result = await getOfferingAnalytics(ctx.db, s.offering.id);
		expect(result.cpmk[0].reference).toEqual({ count: 2, mean: 67, differing: 1 });
		expect(result.cpmk[0].mean).toBe(74.67);
	});

	test('menandai konfigurasi yang belum lengkap sebagai peringatan, bukan angka nol', async () => {
		const offering = await createOffering(ctx.db);
		await createComponent(ctx.db, { offeringId: offering.id, code: 'UTS', weightPercent: 30 });
		await createComponent(ctx.db, { offeringId: offering.id, code: 'UAS', weightPercent: null });
		const enrollment = await createEnrollment(ctx.db, { offeringId: offering.id, studentId: (await createStudent(ctx.db)).id });
		const components = await ctx.db.query.assessmentComponents.findMany({ where: (t, { eq }) => eq(t.offeringId, offering.id) });
		await ctx.db.insert(assessmentScores).values(components.map((c) => ({ enrollmentId: enrollment.id, componentId: c.id, score: 80 })));
		const result = await getOfferingAnalytics(ctx.db, offering.id);
		expect(result.finalScore).toMatchObject({ complete: 0, notConfigured: true, reason: 'WEIGHT_MISSING', mean: null });
		expect(result.weights.complete).toBe(false);
		expect(result.warnings.join(' ')).toContain('tanpa bobot');
		expect(result.warnings.join(' ')).toContain('belum dipetakan ke CPMK');
		expect(result.warnings.join(' ')).toContain('belum memiliki CPMK');
		expect(result.cpmk).toEqual([]);
	});

	test('kelas tanpa data menghasilkan struktur kosong yang aman dan galat tidak ditemukan untuk ID asing', async () => {
		const offering = await createOffering(ctx.db);
		const result = await getOfferingAnalytics(ctx.db, offering.id);
		expect(result).toMatchObject({ studentCount: 0, components: [], cpmk: [], cpl: [], lastRunAt: null });
		expect(result.finalScore.mean).toBeNull();
		await expect(getOfferingAnalytics(ctx.db, '3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b')).rejects.toBeInstanceOf(NotFoundError);
	});
});

describe('getOfferingRoster', () => {
	test('memuat nilai akhir, status kelengkapan, komponen yang kosong, dan CPMK per mahasiswa', async () => {
		const s = await scene();
		const roster = await getOfferingRoster(ctx.db, s.offering.id);
		expect(roster.map((r) => [r.finalScore, r.status, r.missing])).toEqual([[74, 'complete', []], [54, 'complete', []], [96, 'complete', []], [null, 'incomplete', ['UAS']]]);
		expect(roster.map((r) => r.cpmk[s.cpmk.id])).toEqual([74, 54, 96, null]);
		expect(roster.every((r) => /^\d{6,15}$/.test(r.nim))).toBe(true);
		expect(await getOfferingRoster(ctx.db, (await createOffering(ctx.db)).id)).toEqual([]);
	});
});

describe('getProgramAnalytics', () => {
	test('merangkum CPL lintas kelas semester, agregasi sesuai kebijakan, dan kelas yang butuh perhatian', async () => {
		const { semester } = await createTerm(ctx.db, { status: 'planned' });
		await activateSemester(ctx.db, admin, semester.id);
		const first = await scene(semester.id);
		const second = await scene(semester.id);
		const lecturer = await createLecturer(ctx.db);
		await assignLecturer(ctx.db, admin, { offeringId: first.offering.id, lecturerId: lecturer.lecturer.id });
		const orphan = await createOffering(ctx.db, { semesterId: semester.id });

		const result = await getProgramAnalytics(ctx.db);
		expect(result.semester?.id).toBe(semester.id);
		expect(result.totals).toMatchObject({ offerings: 3, lecturers: 1, students: 8, enrollments: 8, offeringsWithResults: 2 });
		expect(result.cpl).toHaveLength(1);
		const [cpl] = result.cpl;
		expect(cpl).toMatchObject({ code: 'CPL-1', target: 75 });
		expect(cpl.offerings).toHaveLength(2);
		for (const entry of cpl.offerings) expect(entry).toMatchObject({ complete: 3, mean: 74.67, students: 4, ratioAchieved: 33.3333 });
		expect(cpl.aggregate).toMatchObject({ status: 'complete', value: 74.67, entries: 2, used: 2, coverage: 1 });
		const reasons = Object.fromEntries(result.attention.map((a) => [a.offeringId, a.reason]));
		expect(reasons[second.offering.id]).toBe('Belum ada dosen pengampu');
		expect(reasons[orphan.id]).toBe('Belum ada dosen pengampu');
		expect(reasons[first.offering.id]).toBeUndefined();
	});

	test('tanpa semester aktif mengembalikan total nol, bukan galat', async () => {
		const result = await getProgramAnalytics(ctx.db, '3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b');
		expect(result.semester).toBeNull();
		expect(result.cpl).toEqual([]);
		expect(result.totals.offerings).toBe(0);
	});
});
