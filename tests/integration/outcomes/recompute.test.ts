import { beforeAll, describe, expect, test } from 'bun:test';
import { and, eq, inArray } from 'drizzle-orm';
import { activatePolicy, createCpl, createCpmk, createDraftPolicy, setAssessmentCpmkMapping, setCpmkCplMapping } from '#lib/features/curriculum/index.server.ts';
import { listReferenceDiscrepancies, recomputeOffering } from '#lib/features/outcomes/index.server.ts';
import { assessmentCpmkMappings, assessmentScores, cplResults, cpmkResults, outcomeCalculationRuns } from '#lib/shared/db/schema.ts';
import { NotFoundError } from '#lib/shared/http/errors.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { createComponent, createEnrollment, createOffering, createStudent, createUser } from '../../support/factories.ts';

const ctx = useIsolatedDatabase('outcomes_recompute');
let admin: { id: string; role: string };

beforeAll(async () => {
	const user = await createUser(ctx.db, { role: 'super_admin' });
	admin = { id: user.id, role: 'super_admin' };
});

async function scene() {
	const offering = await createOffering(ctx.db);
	const uts = await createComponent(ctx.db, { offeringId: offering.id, code: 'UTS', weightPercent: 40 });
	const uas = await createComponent(ctx.db, { offeringId: offering.id, code: 'UAS', weightPercent: 60 });
	const cpmk1 = await createCpmk(ctx.db, admin, { courseId: offering.courseId, code: 'CPMK-1' });
	const cpmk2 = await createCpmk(ctx.db, admin, { courseId: offering.courseId, code: 'CPMK-2' });
	const cpl = await createCpl(ctx.db, admin, { code: `CPL-${1 + Math.floor(Math.random() * 90)}`, title: 'CPL uji recompute' }).catch(async () => createCpl(ctx.db, admin, { code: `CPL-${90 + Math.floor(Math.random() * 9)}`, title: 'CPL uji recompute' }));
	const m11 = await setAssessmentCpmkMapping(ctx.db, admin, { componentId: uts.id, cpmkId: cpmk1.id });
	await setAssessmentCpmkMapping(ctx.db, admin, { componentId: uas.id, cpmkId: cpmk1.id });
	await setAssessmentCpmkMapping(ctx.db, admin, { componentId: uas.id, cpmkId: cpmk2.id });
	await setCpmkCplMapping(ctx.db, admin, { cpmkId: cpmk1.id, cplId: cpl.id, weight: 1 });
	await setCpmkCplMapping(ctx.db, admin, { cpmkId: cpmk2.id, cplId: cpl.id, weight: 3 });
	const complete = await createEnrollment(ctx.db, { offeringId: offering.id, studentId: (await createStudent(ctx.db)).id });
	const partial = await createEnrollment(ctx.db, { offeringId: offering.id, studentId: (await createStudent(ctx.db)).id });
	const setScore = (enrollmentId: string, componentId: string, score: number | null) =>
		ctx.db.insert(assessmentScores).values({ enrollmentId, componentId, score }).onConflictDoUpdate({ target: [assessmentScores.enrollmentId, assessmentScores.componentId], set: { score } });
	await setScore(complete.id, uts.id, 80);
	await setScore(complete.id, uas.id, 90);
	await setScore(partial.id, uts.id, 80);
	return { offering, uts, uas, cpmk1, cpmk2, cpl, m11, complete, partial, setScore };
}

const valueOf = async (table: typeof cpmkResults | typeof cplResults, enrollmentId: string, key: string, source = 'calculated') => {
	const keyColumn = table === cpmkResults ? cpmkResults.cpmkId : cplResults.cplId;
	const [row] = await ctx.db.select().from(table).where(and(eq(table.enrollmentId, enrollmentId), eq(keyColumn, key), eq(table.source, source as 'calculated')));
	return row;
};

describe('recomputeOffering', () => {
	test('menghitung CPMK dan CPL dari nilai komponen sesuai rumus v1 dan menyimpan jejak', async () => {
		const s = await scene();
		const result = await recomputeOffering(ctx.db, admin, s.offering.id, 'uji');
		expect(result).toMatchObject({ changed: true, enrollments: 2, cpmk: { written: 4, deleted: 0 }, cpl: { written: 2, deleted: 0 } });
		expect(await valueOf(cpmkResults, s.complete.id, s.cpmk1.id)).toMatchObject({ value: 86, completeness: 'complete', formulaVersion: 'v1', source: 'calculated' });
		expect(await valueOf(cpmkResults, s.complete.id, s.cpmk2.id)).toMatchObject({ value: 90, completeness: 'complete' });
		expect(await valueOf(cplResults, s.complete.id, s.cpl.id)).toMatchObject({ value: 89, completeness: 'complete' });
		const trace = (await valueOf(cpmkResults, s.complete.id, s.cpmk1.id)).inputs as { trace: { code: string; score: number; normalized: number }[] };
		expect(trace.trace.map((t) => [t.code, t.score])).toEqual([['UAS', 90], ['UTS', 80]]);
		const [run] = await ctx.db.select().from(outcomeCalculationRuns).where(eq(outcomeCalculationRuns.id, result.runId!));
		expect(run).toMatchObject({ trigger: 'uji', formulaVersion: 'v1', enrollmentsProcessed: 2, offeringId: s.offering.id, actorId: admin.id });
	});

	test('mahasiswa dengan komponen wajib kosong tercatat belum lengkap dengan nilai null, bukan nol', async () => {
		const s = await scene();
		await recomputeOffering(ctx.db, admin, s.offering.id, 'uji');
		const cpmk1 = await valueOf(cpmkResults, s.partial.id, s.cpmk1.id);
		expect(cpmk1).toMatchObject({ value: null, completeness: 'incomplete' });
		expect((cpmk1.inputs as { missing: string[] }).missing).toEqual(['UAS']);
		expect(await valueOf(cplResults, s.partial.id, s.cpl.id)).toMatchObject({ value: null, completeness: 'incomplete' });
	});

	test('dijalankan ulang tanpa perubahan data tidak menulis hasil maupun snapshot baru', async () => {
		const s = await scene();
		await recomputeOffering(ctx.db, admin, s.offering.id, 'uji');
		const runsBefore = (await ctx.db.select().from(outcomeCalculationRuns).where(eq(outcomeCalculationRuns.offeringId, s.offering.id))).length;
		const again = await recomputeOffering(ctx.db, admin, s.offering.id, 'uji');
		expect(again).toMatchObject({ changed: false, runId: null, cpmk: { written: 0, deleted: 0 }, cpl: { written: 0, deleted: 0 } });
		expect((await ctx.db.select().from(outcomeCalculationRuns).where(eq(outcomeCalculationRuns.offeringId, s.offering.id))).length).toBe(runsBefore);
	});

	test('perubahan nilai memperbarui hanya hasil yang terdampak dan nol diperlakukan sebagai nilai nyata', async () => {
		const s = await scene();
		await recomputeOffering(ctx.db, admin, s.offering.id, 'uji');
		await s.setScore(s.complete.id, s.uas.id, 0);
		const result = await recomputeOffering(ctx.db, admin, s.offering.id, 'koreksi');
		expect(result.changed).toBe(true);
		expect(await valueOf(cpmkResults, s.complete.id, s.cpmk1.id)).toMatchObject({ value: 32, completeness: 'complete' });
		expect(await valueOf(cplResults, s.complete.id, s.cpl.id)).toMatchObject({ value: 8 });
		expect(result.cpmk.written).toBe(2);
		await s.setScore(s.partial.id, s.uas.id, 70);
		await recomputeOffering(ctx.db, admin, s.offering.id, 'lengkapi');
		expect(await valueOf(cpmkResults, s.partial.id, s.cpmk1.id)).toMatchObject({ value: 74, completeness: 'complete' });
	});

	test('pemetaan yang dilepas menghapus hasil basi dan CPL kembali belum dikonfigurasi', async () => {
		const s = await scene();
		await recomputeOffering(ctx.db, admin, s.offering.id, 'uji');
		await ctx.db.delete(assessmentCpmkMappings).where(and(eq(assessmentCpmkMappings.componentId, s.uas.id), eq(assessmentCpmkMappings.cpmkId, s.cpmk2.id)));
		const result = await recomputeOffering(ctx.db, admin, s.offering.id, 'ubah-pemetaan');
		expect(result.cpmk.deleted).toBe(2);
		expect(await valueOf(cpmkResults, s.complete.id, s.cpmk2.id)).toBeUndefined();
		expect(await valueOf(cplResults, s.complete.id, s.cpl.id)).toBeUndefined();
		expect(result.cpl.deleted).toBe(2);
	});

	test('bobot komponen hilang membuat CPMK belum dikonfigurasi sehingga tidak ada nilai palsu yang tersimpan', async () => {
		const offering = await createOffering(ctx.db);
		const comp = await createComponent(ctx.db, { offeringId: offering.id, code: 'TANPA-BOBOT' });
		const cpmk = await createCpmk(ctx.db, admin, { courseId: offering.courseId, code: 'CPMK-1' });
		await setAssessmentCpmkMapping(ctx.db, admin, { componentId: comp.id, cpmkId: cpmk.id });
		const enrollment = await createEnrollment(ctx.db, { offeringId: offering.id });
		await ctx.db.insert(assessmentScores).values({ enrollmentId: enrollment.id, componentId: comp.id, score: 90 });
		expect(await recomputeOffering(ctx.db, admin, offering.id, 'uji')).toMatchObject({ changed: false, cpmk: { written: 0 } });
		expect(await valueOf(cpmkResults, enrollment.id, cpmk.id)).toBeUndefined();
	});

	test('kebijakan aktif tercatat pada hasil; tanpa kebijakan policyId null; ID tak dikenal ditolak', async () => {
		const s = await scene();
		await recomputeOffering(ctx.db, admin, s.offering.id, 'tanpa-kebijakan');
		expect((await valueOf(cpmkResults, s.complete.id, s.cpmk1.id)).policyId).toBeNull();
		const draft = await createDraftPolicy(ctx.db, admin, { name: 'Kebijakan recompute' });
		await activatePolicy(ctx.db, admin, draft.id);
		const result = await recomputeOffering(ctx.db, admin, s.offering.id, 'dengan-kebijakan');
		expect(result.changed).toBe(true);
		expect((await valueOf(cpmkResults, s.complete.id, s.cpmk1.id)).policyId).toBe(draft.id);
		await expect(recomputeOffering(ctx.db, admin, '3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b', 'x')).rejects.toBeInstanceOf(NotFoundError);
	});
});

describe('referensi Excel dan offering lain', () => {
	test('imported_reference tidak pernah disentuh dan selisih terhadap hitungan sistem dilaporkan', async () => {
		const s = await scene();
		await ctx.db.insert(cpmkResults).values({ enrollmentId: s.complete.id, cpmkId: s.cpmk1.id, source: 'imported_reference', value: 76.421, completeness: 'complete', formulaVersion: 'excel' });
		await ctx.db.insert(cpmkResults).values({ enrollmentId: s.complete.id, cpmkId: s.cpmk2.id, source: 'imported_reference', value: 90.2, completeness: 'complete', formulaVersion: 'excel' });
		await recomputeOffering(ctx.db, admin, s.offering.id, 'uji');
		await s.setScore(s.complete.id, s.uts.id, 85);
		await recomputeOffering(ctx.db, admin, s.offering.id, 'koreksi');
		const refs = await ctx.db.select().from(cpmkResults).where(and(eq(cpmkResults.enrollmentId, s.complete.id), eq(cpmkResults.source, 'imported_reference')));
		expect(refs.map((r) => r.value).sort()).toEqual([76.421, 90.2]);
		const diffs = await listReferenceDiscrepancies(ctx.db, s.offering.id);
		expect(diffs).toHaveLength(1);
		expect(diffs[0]).toMatchObject({ kind: 'cpmk', code: 'CPMK-1', reference: 76.421 });
		expect(diffs[0].delta).toBeGreaterThan(8);
		expect(await listReferenceDiscrepancies(ctx.db, s.offering.id, 50)).toEqual([]);
	});

	test('menghitung ulang satu offering tidak menyentuh hasil offering lain', async () => {
		const a = await scene();
		const b = await scene();
		await recomputeOffering(ctx.db, admin, a.offering.id, 'uji');
		await recomputeOffering(ctx.db, admin, b.offering.id, 'uji');
		const before = await ctx.db.select().from(cpmkResults).where(inArray(cpmkResults.enrollmentId, [b.complete.id, b.partial.id]));
		await a.setScore(a.complete.id, a.uts.id, 10);
		await recomputeOffering(ctx.db, admin, a.offering.id, 'koreksi');
		const after = await ctx.db.select().from(cpmkResults).where(inArray(cpmkResults.enrollmentId, [b.complete.id, b.partial.id]));
		expect(after.map((r) => [r.id, r.value, r.computedAt.getTime()])).toEqual(before.map((r) => [r.id, r.value, r.computedAt.getTime()]));
	});
});
