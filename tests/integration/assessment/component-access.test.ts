import { beforeAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { createCpmk } from '#lib/features/curriculum/index.server.ts';
import { assignLecturer } from '#lib/features/academic/index.server.ts';
import { deleteComponent, recomputeForActor, saveComponent, setComponentCpmk } from '#lib/features/assessment/index.server.ts';
import { assessmentComponents, assessmentCpmkMappings, assessmentScores, cpmkResults } from '#lib/shared/db/schema.ts';
import { NotFoundError, ValidationError } from '#lib/shared/http/errors.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { createComponent, createEnrollment, createLecturer, createOffering, createStudent, createUser } from '../../support/factories.ts';

const ctx = useIsolatedDatabase('assessment_access');
let admin: { id: string; role: string };

beforeAll(async () => {
	const user = await createUser(ctx.db, { role: 'super_admin' });
	admin = { id: user.id, role: 'super_admin' };
});

async function scene() {
	const mine = await createOffering(ctx.db);
	const theirs = await createOffering(ctx.db);
	const lecturer = await createLecturer(ctx.db);
	await assignLecturer(ctx.db, admin, { offeringId: mine.id, lecturerId: lecturer.lecturer.id });
	const actor = { id: lecturer.account.id, role: 'lecturer' };
	const myComponent = await createComponent(ctx.db, { offeringId: mine.id, code: 'UTS', weightPercent: 100 });
	const theirComponent = await createComponent(ctx.db, { offeringId: theirs.id, code: 'UTS', weightPercent: 100 });
	const myCpmk = await createCpmk(ctx.db, admin, { courseId: mine.courseId, code: 'CPMK-1' });
	const myCpmk2 = await createCpmk(ctx.db, admin, { courseId: mine.courseId, code: 'CPMK-2' });
	const theirCpmk = await createCpmk(ctx.db, admin, { courseId: theirs.courseId, code: 'CPMK-1' });
	return { mine, theirs, actor, myComponent, theirComponent, myCpmk, myCpmk2, theirCpmk };
}

describe('akses komponen per kelas', () => {
	test('dosen dapat mengelola komponen kelas yang ditugaskan kepadanya', async () => {
		const s = await scene();
		const saved = await saveComponent(ctx.db, s.actor, { offeringId: s.mine.id, code: 'UAS', name: 'Ujian akhir', type: 'uas', weightPercent: 0, maxScore: 100 });
		expect(saved.component).toMatchObject({ code: 'UAS', offeringId: s.mine.id });
		const removed = await deleteComponent(ctx.db, s.actor, saved.component.id);
		expect(removed).toMatchObject({ removed: true });
	});

	test('dosen tidak dapat menyentuh kelas atau komponen milik dosen lain; galat sama dengan data yang tidak ada', async () => {
		const s = await scene();
		const before = (await ctx.db.select().from(assessmentComponents).where(eq(assessmentComponents.id, s.theirComponent.id)))[0];
		const forbidden = await saveComponent(ctx.db, s.actor, { offeringId: s.theirs.id, code: 'UTS', name: 'Diubah', weightPercent: 5 }).catch((e) => e);
		const missing = await saveComponent(ctx.db, s.actor, { offeringId: '3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b', code: 'UTS', name: 'X' }).catch((e) => e);
		expect(forbidden).toBeInstanceOf(NotFoundError);
		expect(forbidden.message).toBe(missing.message);
		await expect(deleteComponent(ctx.db, s.actor, s.theirComponent.id)).rejects.toBeInstanceOf(NotFoundError);
		await expect(setComponentCpmk(ctx.db, s.actor, s.theirComponent.id, [{ cpmkId: s.theirCpmk.id, coefficient: 1 }])).rejects.toBeInstanceOf(NotFoundError);
		await expect(recomputeForActor(ctx.db, s.actor, s.theirs.id)).rejects.toBeInstanceOf(NotFoundError);
		await expect(deleteComponent(ctx.db, s.actor, 'bukan-uuid')).rejects.toBeInstanceOf(NotFoundError);
		const after = (await ctx.db.select().from(assessmentComponents).where(eq(assessmentComponents.id, s.theirComponent.id)))[0];
		expect(after).toEqual(before);
	});

	test('Super Admin dapat mengelola kelas mana pun', async () => {
		const s = await scene();
		const result = await saveComponent(ctx.db, admin, { offeringId: s.theirs.id, code: 'TUGAS', name: 'Tugas', weightPercent: 0 });
		expect(result.component.offeringId).toBe(s.theirs.id);
	});
});

describe('pemetaan komponen ke CPMK', () => {
	test('menggantikan himpunan pemetaan, menghapus yang tidak dipilih, dan menghitung ulang hasil', async () => {
		const s = await scene();
		const enrollment = await createEnrollment(ctx.db, { offeringId: s.mine.id, studentId: (await createStudent(ctx.db)).id });
		await ctx.db.insert(assessmentScores).values({ enrollmentId: enrollment.id, componentId: s.myComponent.id, score: 80 });

		const first = await setComponentCpmk(ctx.db, s.actor, s.myComponent.id, [{ cpmkId: s.myCpmk.id, coefficient: 1 }, { cpmkId: s.myCpmk2.id, coefficient: 2 }]);
		expect(first.cpmk.written).toBe(2);
		expect(await ctx.db.select().from(assessmentCpmkMappings).where(eq(assessmentCpmkMappings.componentId, s.myComponent.id))).toHaveLength(2);

		const second = await setComponentCpmk(ctx.db, s.actor, s.myComponent.id, [{ cpmkId: s.myCpmk.id, coefficient: 1 }]);
		expect(second.cpmk.deleted).toBe(1);
		const mappings = await ctx.db.select().from(assessmentCpmkMappings).where(eq(assessmentCpmkMappings.componentId, s.myComponent.id));
		expect(mappings.map((m) => m.cpmkId)).toEqual([s.myCpmk.id]);
		const results = await ctx.db.select().from(cpmkResults).where(eq(cpmkResults.enrollmentId, enrollment.id));
		expect(results.map((r) => [r.cpmkId, r.value])).toEqual([[s.myCpmk.id, 80]]);

		const cleared = await setComponentCpmk(ctx.db, s.actor, s.myComponent.id, []);
		expect(cleared.cpmk.deleted).toBe(1);
		expect(await ctx.db.select().from(cpmkResults).where(eq(cpmkResults.enrollmentId, enrollment.id))).toHaveLength(0);
	});

	test('CPMK dari mata kuliah lain atau pilihan ganda ditolak tanpa mengubah pemetaan yang ada', async () => {
		const s = await scene();
		await setComponentCpmk(ctx.db, s.actor, s.myComponent.id, [{ cpmkId: s.myCpmk.id, coefficient: 1 }]);
		await expect(setComponentCpmk(ctx.db, s.actor, s.myComponent.id, [{ cpmkId: s.theirCpmk.id, coefficient: 1 }])).rejects.toBeInstanceOf(ValidationError);
		await expect(setComponentCpmk(ctx.db, s.actor, s.myComponent.id, [{ cpmkId: s.myCpmk.id, coefficient: 1 }, { cpmkId: s.myCpmk.id, coefficient: 2 }])).rejects.toBeInstanceOf(ValidationError);
		const mappings = await ctx.db.select().from(assessmentCpmkMappings).where(eq(assessmentCpmkMappings.componentId, s.myComponent.id));
		expect(mappings.map((m) => m.cpmkId)).toEqual([s.myCpmk.id]);
	});
});

describe('hitung ulang manual', () => {
	test('dosen yang ditugaskan dapat menghitung ulang dan hasilnya idempoten', async () => {
		const s = await scene();
		const first = await recomputeForActor(ctx.db, s.actor, s.mine.id);
		const second = await recomputeForActor(ctx.db, s.actor, s.mine.id);
		expect(first.enrollments).toBe(0);
		expect(second.changed).toBe(false);
	});
});
