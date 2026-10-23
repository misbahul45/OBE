import { describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import {
	activatePolicy,
	cloneActivePolicyAsDraft,
	createCpl,
	createCpmk,
	createDraftPolicy,
	getActivePolicy,
	listComponents,
	listCourseCplMappings,
	listCpl,
	listCpmkCplMappings,
	listPolicies,
	removeAssessmentCpmkMapping,
	removeComponent,
	removeCourseCplMapping,
	setAssessmentCpmkMapping,
	setCourseCplMapping,
	setCplTarget,
	setCpmkCplMapping,
	updateCpl,
	updateDraftPolicy,
	upsertComponent
} from '#lib/features/curriculum/index.server.ts';
import { assessmentComponents, assessmentScores, auditLogs, outcomePolicies } from '#lib/shared/db/schema.ts';
import { ConflictError, NotFoundError, ValidationError } from '#lib/shared/http/errors.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { createComponent, createCourse, createEnrollment, createOffering, createUser } from '../../support/factories.ts';

const ctx = useIsolatedDatabase('curriculum_service');

async function actor() {
	const user = await createUser(ctx.db, { role: 'super_admin' });
	return { id: user.id, role: 'super_admin' };
}

describe('CPL dan CPMK', () => {
	test('kode dinormalisasi, duplikat ditolak, pembaruan diaudit', async () => {
		const admin = await actor();
		const cpl = await createCpl(ctx.db, admin, { code: 'cpl 1', title: 'Pengetahuan rekayasa', sortOrder: '1' });
		expect(cpl.code).toBe('CPL-1');
		await expect(createCpl(ctx.db, admin, { code: 'CPL-1', title: 'Duplikat sah' })).rejects.toMatchObject({ fieldErrors: { code: ['CPL-1 sudah ada'] } });
		const updated = await updateCpl(ctx.db, admin, cpl.id, { code: 'CPL-1', title: 'Judul diperbarui', sortOrder: 1 });
		expect(updated.title).toBe('Judul diperbarui');
		const trail = await ctx.db.select().from(auditLogs).where(eq(auditLogs.entityId, cpl.id));
		expect(trail.map((l) => l.action).sort()).toEqual(['cpl.create', 'cpl.update']);
		await expect(updateCpl(ctx.db, admin, '3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b', { code: 'CPL-9', title: 'Tidak ada' })).rejects.toBeInstanceOf(NotFoundError);
	});

	test('CPMK unik per mata kuliah tetapi boleh sama di mata kuliah lain', async () => {
		const admin = await actor();
		const a = await createCourse(ctx.db);
		const b = await createCourse(ctx.db);
		await createCpmk(ctx.db, admin, { courseId: a.id, code: 'cpmk1' });
		await createCpmk(ctx.db, admin, { courseId: b.id, code: 'CPMK-1' });
		await expect(createCpmk(ctx.db, admin, { courseId: a.id, code: 'CPMK-1' })).rejects.toBeInstanceOf(ValidationError);
		await expect(createCpmk(ctx.db, admin, { courseId: '3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b', code: 'CPMK-1' })).rejects.toMatchObject({ fieldErrors: { courseId: expect.any(Array) } });
	});
});

describe('pemetaan', () => {
	test('mata kuliah ke CPL bersifat upsert dan dapat dihapus; kontribusi kosong tetap null', async () => {
		const admin = await actor();
		const course = await createCourse(ctx.db);
		const cpl = await createCpl(ctx.db, admin, { code: 'CPL-2', title: 'Judul pemetaan' });
		const first = await setCourseCplMapping(ctx.db, admin, { courseId: course.id, cplId: cpl.id, contribution: '', approvalSource: 'Rapat kurikulum' });
		expect(first.contribution).toBeNull();
		const second = await setCourseCplMapping(ctx.db, admin, { courseId: course.id, cplId: cpl.id, contribution: '40' });
		expect(second.id).toBe(first.id);
		expect(second.contribution).toBe(40);
		expect(await listCourseCplMappings(ctx.db, course.id)).toMatchObject([{ cplCode: 'CPL-2', contribution: 40 }]);
		await removeCourseCplMapping(ctx.db, admin, first.id);
		expect(await listCourseCplMappings(ctx.db, course.id)).toEqual([]);
		await expect(removeCourseCplMapping(ctx.db, admin, first.id)).rejects.toBeInstanceOf(NotFoundError);
	});

	test('CPMK ke CPL mencatat pengesahan dan menolak bobot nol', async () => {
		const admin = await actor();
		const course = await createCourse(ctx.db);
		const cpl = await createCpl(ctx.db, admin, { code: 'CPL-3', title: 'Judul pemetaan' });
		const cpmk = await createCpmk(ctx.db, admin, { courseId: course.id, code: 'CPMK-1' });
		const row = await setCpmkCplMapping(ctx.db, admin, { cpmkId: cpmk.id, cplId: cpl.id, weight: '0.5' });
		expect(row).toMatchObject({ weight: 0.5, approvedBy: admin.id });
		await expect(setCpmkCplMapping(ctx.db, admin, { cpmkId: cpmk.id, cplId: cpl.id, weight: 0 })).rejects.toBeInstanceOf(ValidationError);
		expect(await listCpmkCplMappings(ctx.db, course.id)).toMatchObject([{ cpmkCode: 'CPMK-1', cplCode: 'CPL-3', weight: 0.5 }]);
	});
});

describe('komponen asesmen per offering', () => {
	test('upsert berdasarkan kode, ringkasan bobot jujur tentang kelengkapan dan jumlah', async () => {
		const admin = await actor();
		const offering = await createOffering(ctx.db);
		await upsertComponent(ctx.db, admin, { offeringId: offering.id, code: 'uts', name: 'UTS', type: 'uts', weightPercent: '40' });
		const again = await upsertComponent(ctx.db, admin, { offeringId: offering.id, code: 'UTS', name: 'UTS revisi', type: 'uts', weightPercent: '40' });
		expect(again.name).toBe('UTS revisi');
		await upsertComponent(ctx.db, admin, { offeringId: offering.id, code: 'UAS', name: 'UAS', type: 'uas', weightPercent: '' });
		let listing = await listComponents(ctx.db, offering.id);
		expect(listing.components).toHaveLength(2);
		expect(listing.weights).toMatchObject({ total: null, complete: false, ok: false });
		await upsertComponent(ctx.db, admin, { offeringId: offering.id, code: 'UAS', name: 'UAS', type: 'uas', weightPercent: '60' });
		listing = await listComponents(ctx.db, offering.id);
		expect(listing.weights).toMatchObject({ total: 100, complete: true, ok: true });
	});

	test('komponen yang sudah bernilai dinonaktifkan (jejak dipertahankan), yang belum bernilai dihapus', async () => {
		const admin = await actor();
		const offering = await createOffering(ctx.db);
		const used = await createComponent(ctx.db, { offeringId: offering.id, code: 'PAKAI' });
		const unused = await createComponent(ctx.db, { offeringId: offering.id, code: 'KOSONG' });
		const enrollment = await createEnrollment(ctx.db, { offeringId: offering.id });
		await ctx.db.insert(assessmentScores).values({ enrollmentId: enrollment.id, componentId: used.id, score: 80 });
		expect(await removeComponent(ctx.db, admin, used.id)).toEqual({ removed: false, deactivated: true });
		expect(await removeComponent(ctx.db, admin, unused.id)).toEqual({ removed: true, deactivated: false });
		const rows = await ctx.db.select().from(assessmentComponents).where(eq(assessmentComponents.offeringId, offering.id));
		expect(rows.map((r) => [r.code, r.isActive])).toEqual([['PAKAI', false]]);
		expect((await listComponents(ctx.db, offering.id)).weights.count).toBe(0);
	});

	test('pemetaan komponen ke CPMK bersifat upsert dan dapat dilepas', async () => {
		const admin = await actor();
		const offering = await createOffering(ctx.db);
		const component = await createComponent(ctx.db, { offeringId: offering.id, code: 'TUGAS' });
		const cpmk = await createCpmk(ctx.db, admin, { courseId: offering.courseId, code: 'CPMK-1' });
		const first = await setAssessmentCpmkMapping(ctx.db, admin, { componentId: component.id, cpmkId: cpmk.id });
		const second = await setAssessmentCpmkMapping(ctx.db, admin, { componentId: component.id, cpmkId: cpmk.id, coefficient: '2' });
		expect([first.coefficient, second.coefficient, second.id === first.id]).toEqual([1, 2, true]);
		expect((await listComponents(ctx.db, offering.id)).components[0].cpmkMappings).toMatchObject([{ cpmkCode: 'CPMK-1', coefficient: 2 }]);
		await removeAssessmentCpmkMapping(ctx.db, admin, first.id);
		expect((await listComponents(ctx.db, offering.id)).components[0].cpmkMappings).toEqual([]);
	});

	test('CPMK dari mata kuliah lain ditolak agar hasil OBE kelas tidak tercemar', async () => {
		const admin = await actor();
		const offering = await createOffering(ctx.db);
		const otherCourse = await createCourse(ctx.db);
		const component = await createComponent(ctx.db, { offeringId: offering.id, code: 'TUGAS' });
		const foreign = await createCpmk(ctx.db, admin, { courseId: otherCourse.id, code: 'CPMK-1' });
		const failure = await setAssessmentCpmkMapping(ctx.db, admin, { componentId: component.id, cpmkId: foreign.id }).catch((e) => e);
		expect(failure).toBeInstanceOf(ValidationError);
		expect(failure.fieldErrors.cpmkId).toEqual(['CPMK bukan milik mata kuliah dari kelas ini']);
		expect((await listComponents(ctx.db, offering.id)).components[0].cpmkMappings).toEqual([]);
		const missingComponent = await setAssessmentCpmkMapping(ctx.db, admin, { componentId: '3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b', cpmkId: foreign.id }).catch((e) => e);
		expect(missingComponent.fieldErrors.componentId).toEqual(['Komponen tidak ditemukan']);
	});
});

describe('kebijakan OBE berversi', () => {
	test('siklus draft, target, aktivasi, salinan; hanya satu aktif dan kebijakan aktif tidak dapat diubah', async () => {
		const admin = await actor();
		const cpl = await createCpl(ctx.db, admin, { code: 'CPL-4', title: 'Target kebijakan' });
		expect(await getActivePolicy(ctx.db)).toBeNull();

		const v1 = await createDraftPolicy(ctx.db, admin, { name: 'Kebijakan 2026', achievementThreshold: '', classAchievementRatio: '' });
		expect(v1).toMatchObject({ version: 1, status: 'draft', achievementThreshold: null, aggregationMethod: 'not_configured' });
		await updateDraftPolicy(ctx.db, admin, v1.id, { name: 'Kebijakan 2026', achievementThreshold: '62', classAchievementRatio: '75', aggregationMethod: 'simple_mean' });
		await setCplTarget(ctx.db, admin, { policyId: v1.id, cplId: cpl.id, target: '70' });
		await setCplTarget(ctx.db, admin, { policyId: v1.id, cplId: cpl.id, target: '72' });

		const active = await activatePolicy(ctx.db, admin, v1.id);
		expect(active).toMatchObject({ status: 'active', approvedBy: admin.id });
		const loaded = await getActivePolicy(ctx.db);
		expect(loaded).toMatchObject({ version: 1, achievementThreshold: 62, classAchievementRatio: 75, aggregationMethod: 'simple_mean' });
		expect(loaded!.targets[cpl.id]).toBe(72);

		await expect(updateDraftPolicy(ctx.db, admin, v1.id, { name: 'Ubah diam-diam' })).rejects.toBeInstanceOf(ConflictError);
		await expect(setCplTarget(ctx.db, admin, { policyId: v1.id, cplId: cpl.id, target: 10 })).rejects.toBeInstanceOf(ConflictError);

		const v2 = await cloneActivePolicyAsDraft(ctx.db, admin);
		expect(v2).toMatchObject({ version: 2, status: 'draft', achievementThreshold: 62 });
		await setCplTarget(ctx.db, admin, { policyId: v2.id, cplId: cpl.id, target: 80 });
		expect((await getActivePolicy(ctx.db))!.targets[cpl.id]).toBe(72);
		await activatePolicy(ctx.db, admin, v2.id);
		const statuses = (await listPolicies(ctx.db)).map((p) => [p.version, p.status]);
		expect(statuses).toEqual([[2, 'active'], [1, 'retired']]);
		expect((await getActivePolicy(ctx.db))!.targets[cpl.id]).toBe(80);
		expect((await ctx.db.select().from(outcomePolicies).where(eq(outcomePolicies.status, 'active'))).length).toBe(1);
		await expect(activatePolicy(ctx.db, admin, v1.id)).rejects.toBeInstanceOf(ConflictError);
		const trail = await ctx.db.select().from(auditLogs).where(eq(auditLogs.action, 'outcome_policy.activate'));
		expect(trail).toHaveLength(2);
	});

	test('target untuk CPL tidak dikenal dan kebijakan tidak dikenal ditolak', async () => {
		const admin = await actor();
		const draft = await createDraftPolicy(ctx.db, admin, { name: 'Kebijakan Uji 2' });
		await expect(setCplTarget(ctx.db, admin, { policyId: draft.id, cplId: '3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b', target: 70 })).rejects.toBeInstanceOf(ValidationError);
		await expect(setCplTarget(ctx.db, admin, { policyId: '3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b', cplId: '3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b', target: 70 })).rejects.toBeInstanceOf(NotFoundError);
		expect((await listCpl(ctx.db)).length).toBeGreaterThan(0);
	});
});
