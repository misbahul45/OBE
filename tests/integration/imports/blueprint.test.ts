import { describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { auditLogs, cplResults, cpmkDefinitions, cpmkResults, importSheetMappings } from '#lib/shared/db/schema.ts';
import { commitImport, type CommitParams } from '#lib/features/imports/imports.commit.server.ts';
import { planSheet } from '#lib/features/imports/imports.plan.server.ts';
import { allIssues } from '#lib/features/imports/validation.ts';
import { getOfferingAnalytics, getOfferingRoster, getProgramAnalytics, loadBlueprints } from '#lib/features/outcomes/index.server.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { createCourse, createOffering, createTerm, createUser } from '../../support/factories.ts';
import { blueprintSheet } from '../../support/blueprint.ts';
import { createBatch, defineOutcomes, inputFor } from '../../support/imports.ts';

const ctx = useIsolatedDatabase('imports_blueprint');
let yearSeed = 2051;

async function scene(sheetName = 'Sheet Cetak Biru') {
	const user = await createUser(ctx.db, { role: 'super_admin' });
	const actor = { id: user.id, role: 'super_admin' };
	const term = await createTerm(ctx.db, { startYear: yearSeed });
	yearSeed += 1;
	const course = await createCourse(ctx.db, { name: 'Mata Kuliah Cetak Biru', credits: 3 });
	const offering = await createOffering(ctx.db, { courseId: course.id, semesterId: term.semester.id });
	await defineOutcomes(ctx.db, course.id, [], ['CPL-1']);
	const batch = await createBatch(ctx.db, actor.id);
	await ctx.db.insert(importSheetMappings).values({ batchId: batch.id, sheetName, offeringId: offering.id, fingerprint: `fp-${yearSeed}`, mapping: { mapping: null, source: 'auto' } });
	const params: CommitParams = {
		batchId: batch.id,
		actor,
		sheets: [inputFor(blueprintSheet(sheetName), offering.id)],
		strategy: 'upsert',
		errorPolicy: 'block_on_error',
		confirmations: { scoreUpdates: true, weightChanges: true }
	};
	return { actor, term, course, offering, batch, params, sheetName };
}

describe('impor menyimpan CPMK dari Excel tanpa kurikulum yang disiapkan lebih dulu', () => {
	test('rencana tidak lagi membuang kolom CPMK untuk mata kuliah tanpa definisi CPMK', async () => {
		const s = await scene();
		const plan = await planSheet(ctx.db, s.params.sheets[0]);
		expect(allIssues(plan.validation).map((i) => i.code)).not.toContain('CPMK_UNKNOWN');
		const kinds = plan.rows.flatMap((r) => r.references.map((x) => `${x.kind}:${x.code}:${x.action}`));
		expect(kinds.filter((k) => k.startsWith('cpmk:CPMK-1')).length).toBe(3);
		expect(kinds.filter((k) => k.startsWith('cpmk:CPMK-2')).length).toBe(3);
		expect(plan.summary.referencesNew).toBe(9);
	});

	test('commit membuat definisi CPMK otomatis, menulis referensi CPMK dan CPL, dan mencatat audit', async () => {
		const s = await scene();
		await commitImport(ctx.db, s.params);
		const defs = await ctx.db.select().from(cpmkDefinitions).where(eq(cpmkDefinitions.courseId, s.course.id));
		expect(defs.map((d) => d.code).sort()).toEqual(['CPMK-1', 'CPMK-2']);
		const cpmk = await ctx.db.select().from(cpmkResults);
		const cpl = await ctx.db.select().from(cplResults);
		expect(cpmk.filter((r) => r.source === 'imported_reference')).toHaveLength(6);
		expect(cpl.filter((r) => r.source === 'imported_reference')).toHaveLength(3);
		const logs = await ctx.db.select().from(auditLogs).where(eq(auditLogs.entityId, s.course.id));
		expect(logs.find((l) => l.action === 'cpmk.auto_create')?.summary).toContain('CPMK-1, CPMK-2');
	});

	test('impor ulang tidak menggandakan definisi atau referensi dan tetap idempoten', async () => {
		const s = await scene();
		await commitImport(ctx.db, s.params);
		const second = await createBatch(ctx.db, s.actor.id, { fileSha256: 'c'.repeat(64) });
		await ctx.db.insert(importSheetMappings).values({ batchId: second.id, sheetName: s.sheetName, offeringId: s.offering.id, fingerprint: 'fp-ulang', mapping: { mapping: null, source: 'auto' } });
		const again = await commitImport(ctx.db, { ...s.params, batchId: second.id });
		expect(again.summary).toMatchObject({ referencesNew: 0, referencesUpdated: 0, referencesUnchanged: 9 });
		expect(await ctx.db.select().from(cpmkDefinitions).where(eq(cpmkDefinitions.courseId, s.course.id))).toHaveLength(2);
	});
});

describe('cetak biru tersimpan bersama jejak batch', () => {
	test('disimpan pada pemetaan sheet berstatus tersimpan dan dapat dimuat per kelas dengan nama berkas sumber', async () => {
		const s = await scene();
		await commitImport(ctx.db, s.params);
		const found = (await loadBlueprints(ctx.db, [s.offering.id])).get(s.offering.id)!;
		expect(found.batchId).toBe(s.batch.id);
		expect(found.sheetName).toBe(s.sheetName);
		expect(found.fileName).toBe('uji.xlsx');
		expect(found.blueprint.thresholds).toEqual({ studentScore: 62, classRatioPercent: 75 });
		expect(found.blueprint.cpl[0].links).toHaveLength(2);
		expect(JSON.stringify(found.blueprint)).not.toContain('Mahasiswa Cetak Biru');
	});

	test('sheet tanpa baris pemetaan tidak menimbulkan kegagalan dan tidak memiliki cetak biru', async () => {
		const s = await scene();
		await ctx.db.delete(importSheetMappings).where(eq(importSheetMappings.batchId, s.batch.id));
		await commitImport(ctx.db, s.params);
		expect((await loadBlueprints(ctx.db, [s.offering.id])).size).toBe(0);
		expect(await loadBlueprints(ctx.db, [])).toEqual(new Map());
	});
});

describe('analitik membaca nilai Excel bila sistem belum menghitung', () => {
	test('kelas: CPMK dan CPL memakai kolom Excel, ambang dan rasio dari Excel, serta jejak tersusun', async () => {
		const s = await scene();
		await commitImport(ctx.db, s.params);
		const analytics = await getOfferingAnalytics(ctx.db, s.offering.id);
		expect(analytics.thresholds).toEqual({ studentScore: 62, classRatio: 75, source: 'excel' });
		const cpmk1 = analytics.cpmk.find((c) => c.code === 'CPMK-1')!;
		expect(cpmk1).toMatchObject({ basis: 'imported_reference', target: 62, targetSource: 'excel', classRatio: 75, mean: 76.67 });
		expect(cpmk1.distribution).toMatchObject({ achieved: 2, notAchieved: 1, insufficient: 0 });
		expect(cpmk1.meetsClassRatio).toBe(false);
		const cpmk2 = analytics.cpmk.find((c) => c.code === 'CPMK-2')!;
		expect(cpmk2.distribution).toMatchObject({ achieved: 2, notAchieved: 1 });
		const cpl = analytics.cpl[0];
		expect(cpl).toMatchObject({ code: 'CPL-1', basis: 'imported_reference', target: 62, targetSource: 'excel' });
		expect(cpl.distribution).toMatchObject({ achieved: 2, notAchieved: 1 });
		expect(analytics.warnings.join(' ')).toContain('ambang dari Excel');
		expect(analytics.trace).not.toBeNull();
		expect(analytics.trace!.source).toEqual({ fileName: 'uji.xlsx', sheetName: s.sheetName });
		expect(analytics.trace!.nodes.filter((n) => n.column === 0).map((n) => n.code)).toEqual(['UTS-1', 'UAS-1']);
		expect(analytics.trace!.nodes.find((n) => n.id === 'm:CPMK-1')).toMatchObject({ reached: false, ratio: 66.6667 });
		expect(analytics.trace!.links).toHaveLength(4);
	});

	test('daftar mahasiswa memuat nilai CPMK dari Excel beserta basisnya', async () => {
		const s = await scene();
		await commitImport(ctx.db, s.params);
		const roster = await getOfferingRoster(ctx.db, s.offering.id);
		const first = roster.find((r) => r.name === 'Mahasiswa Cetak Biru 001')!;
		const cpmkId = (await ctx.db.select().from(cpmkDefinitions).where(eq(cpmkDefinitions.courseId, s.course.id))).find((d) => d.code === 'CPMK-1')!.id;
		expect(first.cpmk[cpmkId]).toBe(80);
		expect(first.cpmkBasis[cpmkId]).toBe('imported_reference');
	});

	test('program: CPL per kelas memakai Excel, memuat sebaran mahasiswa, dan agregasi tidak dikarang', async () => {
		const s = await scene();
		await commitImport(ctx.db, s.params);
		const program = await getProgramAnalytics(ctx.db, s.term.semester.id);
		const cpl = program.cpl.find((c) => c.code === 'CPL-1')!;
		expect(cpl).toMatchObject({ target: 62, targetSource: 'excel' });
		expect(cpl.offerings).toHaveLength(1);
		expect(cpl.offerings[0]).toMatchObject({ basis: 'imported_reference', students: 3, complete: 3, ratioAchieved: 66.6667 });
		expect(cpl.offerings[0].distribution).toMatchObject({ achieved: 2, notAchieved: 1 });
		expect(cpl.distribution).toMatchObject({ achieved: 2, notAchieved: 1, total: 3 });
		expect(cpl.aggregate.status).toBe('not_configured');
		expect(program.attention.map((a) => a.reason)).not.toContain('Nilai ada tetapi hasil CPL belum terhitung; periksa komponen, bobot, dan pemetaan CPMK');
	});

	test('tanpa cetak biru, ambang tidak dikarang dan ketercapaian tidak diklaim', async () => {
		const s = await scene();
		await ctx.db.delete(importSheetMappings).where(eq(importSheetMappings.batchId, s.batch.id));
		await commitImport(ctx.db, s.params);
		const analytics = await getOfferingAnalytics(ctx.db, s.offering.id);
		expect(analytics.thresholds).toEqual({ studentScore: null, classRatio: null, source: null });
		expect(analytics.cpmk[0]).toMatchObject({ target: null, targetSource: null, meetsClassRatio: null, basis: 'imported_reference' });
		expect(analytics.cpmk[0].distribution.unconfigured).toBe(3);
		expect(analytics.trace).toBeNull();
	});
});
