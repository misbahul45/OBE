import { describe, expect, test } from 'bun:test';
import { and, eq, sql } from 'drizzle-orm';
import {
	assessmentComponents,
	assessmentScoreRevisions,
	assessmentScores,
	auditLogs,
	cplResults,
	cpmkResults,
	enrollments,
	importBatches,
	studentNameConflicts,
	students
} from '#lib/shared/db/schema.ts';
import { commitImport, ImportStateError, type CommitParams } from '#lib/features/imports/imports.commit.server.ts';
import { ImportBlockedError } from '#lib/features/imports/imports.plan.types.ts';
import { readWorkbook } from '#lib/features/imports/workbook-reader.server.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { createOffering, createStudent, createUser } from '../../support/factories.ts';
import { createBatch, defineOutcomes, inputFor, rowCount, simpleSheet, type SimpleStudent } from '../../support/imports.ts';
import { buildSemesterWorkbook } from '../../fixtures/builders/templates.ts';

const ctx = useIsolatedDatabase('imports_commit');

async function actor() {
	const user = await createUser(ctx.db, { role: 'super_admin' });
	return { id: user.id, role: 'super_admin' };
}

async function run(offeringId: string, rows: SimpleStudent[], overrides: Partial<CommitParams> = {}, sheetName = 'Sheet Uji') {
	const who = overrides.actor ?? (await actor());
	const batch = await createBatch(ctx.db, who.id);
	const params: CommitParams = {
		batchId: batch.id,
		actor: who,
		sheets: [inputFor(simpleSheet(sheetName, rows), offeringId)],
		strategy: 'upsert',
		errorPolicy: 'block_on_error',
		confirmations: { scoreUpdates: true, weightChanges: true },
		...overrides
	};
	return { batch, result: await commitImport(ctx.db, params), params };
}

const scoreOf = async (nim: string, offeringId: string, code: string) => {
	const rows = await ctx.db
		.select({ score: assessmentScores.score })
		.from(assessmentScores)
		.innerJoin(enrollments, eq(enrollments.id, assessmentScores.enrollmentId))
		.innerJoin(students, eq(students.id, enrollments.studentId))
		.innerJoin(assessmentComponents, eq(assessmentComponents.id, assessmentScores.componentId))
		.where(and(eq(students.nim, nim), eq(enrollments.offeringId, offeringId), eq(assessmentComponents.code, code)));
	return rows[0]?.score ?? 'tidak-ada';
};

describe('impor pertama', () => {
	test('membuat mahasiswa, enrollment, komponen, nilai, revisi awal, dan audit', async () => {
		const offering = await createOffering(ctx.db);
		const { result, batch } = await run(offering.id, [
			{ nim: 99020000001, name: 'Mahasiswa Uji 001', uts: 80, uas: 90 },
			{ nim: 99020000002, name: 'Mahasiswa Uji 002', uts: 70, uas: 60 }
		]);
		expect(result.summary).toMatchObject({ studentsNew: 2, enrollmentsNew: 2, scoresNew: 4, scoresUpdated: 0, componentsNew: 2 });
		expect(await scoreOf('99020000001', offering.id, 'UTS-1')).toBe(80);
		expect(await scoreOf('99020000002', offering.id, 'UAS-1')).toBe(60);

		const [stored] = await ctx.db.select().from(importBatches).where(eq(importBatches.id, batch.id));
		expect(stored).toMatchObject({ status: 'committed', studentsInserted: 2, scoresInserted: 4, errorMessage: null });
		expect(stored.finishedAt).not.toBeNull();

		const revisions = await ctx.db.select().from(assessmentScoreRevisions).where(eq(assessmentScoreRevisions.batchId, batch.id));
		expect(revisions).toHaveLength(4);
		expect(revisions.every((r) => r.changeType === 'import_initial' && r.oldScore === null && r.actorId !== null)).toBe(true);

		const logs = await ctx.db.select().from(auditLogs).where(eq(auditLogs.batchId, batch.id));
		expect(logs.map((l) => l.action)).toContain('import.commit');
		expect(JSON.stringify(logs)).not.toContain('99020000001');
	});

	test('NIM dengan nol di depan tersimpan utuh dan berbeda dari NIM tanpa nol', async () => {
		const offering = await createOffering(ctx.db);
		await run(offering.id, [
			{ nim: '0099020000', name: 'Mahasiswa Uji 003', uts: 50, uas: 50 },
			{ nim: '99020000', name: 'Mahasiswa Uji 004', uts: 60, uas: 60 }
		]);
		const found = await ctx.db.select({ nim: students.nim }).from(students).where(sql`${students.nim} in ('0099020000', '99020000')`);
		expect(found.map((f) => f.nim).sort()).toEqual(['0099020000', '99020000']);
	});

	test('referensi CPMK/CPL dari Excel disimpan sebagai imported_reference, bukan nilai komponen', async () => {
		const offering = await createOffering(ctx.db);
		await defineOutcomes(ctx.db, offering.courseId, ['CPMK-1', 'CPMK-2', 'CPMK-3', 'CPMK-4', 'CPMK-5'], ['CPL-1']);
		const [grid] = readWorkbook(buildSemesterWorkbook(), 's.xlsx').sheets;
		const who = await actor();
		const batch = await createBatch(ctx.db, who.id);
		const result = await commitImport(ctx.db, {
			batchId: batch.id,
			actor: who,
			sheets: [inputFor(grid, offering.id)],
			strategy: 'upsert',
			errorPolicy: 'block_on_error',
			confirmations: { scoreUpdates: true, weightChanges: true }
		});
		expect(result.summary).toMatchObject({ studentsNew: 15, scoresNew: 120, componentsNew: 8, referencesNew: 90 });
		const components = await ctx.db.select().from(assessmentComponents).where(eq(assessmentComponents.offeringId, offering.id));
		expect(components).toHaveLength(8);
		expect(components.some((c) => /^cp(mk|l)/i.test(c.code))).toBe(false);
		const cpmk = await ctx.db.select().from(cpmkResults).where(eq(cpmkResults.batchId, batch.id));
		const cpl = await ctx.db.select().from(cplResults).where(eq(cplResults.batchId, batch.id));
		expect(cpmk).toHaveLength(75);
		expect(cpl).toHaveLength(15);
		expect([...cpmk, ...cpl].every((r) => r.source === 'imported_reference' && r.formulaVersion === 'excel')).toBe(true);
	});
});

describe('mahasiswa existing dan konflik nama', () => {
	test('NIM yang sudah ada memakai student ID yang sama dan nama master tidak ditimpa', async () => {
		const offering = await createOffering(ctx.db);
		const master = await createStudent(ctx.db, { nim: '99020001001', name: 'Nama Master' });
		const { result, batch } = await run(offering.id, [{ nim: 99020001001, name: 'Nama Berbeda Di File', uts: 80, uas: 80 }]);
		expect(result.summary).toMatchObject({ studentsNew: 0, studentsExisting: 1, nameConflicts: 1 });
		const [after] = await ctx.db.select().from(students).where(eq(students.id, master.id));
		expect(after.name).toBe('Nama Master');
		expect((await ctx.db.select().from(students).where(eq(students.nim, '99020001001'))).length).toBe(1);
		const conflicts = await ctx.db.select().from(studentNameConflicts).where(eq(studentNameConflicts.batchId, batch.id));
		expect(conflicts).toMatchObject([{ studentId: master.id, masterName: 'Nama Master', sourceName: 'Nama Berbeda Di File', status: 'open' }]);
	});
});

describe('pembaruan nilai', () => {
	test('pembaruan tanpa konfirmasi ditahan dan tidak mengubah apa pun', async () => {
		const offering = await createOffering(ctx.db);
		await run(offering.id, [{ nim: 99020002001, name: 'Mahasiswa Uji 021', uts: 70, uas: 70 }]);
		const before = await rowCount(ctx.db, assessmentScoreRevisions);
		const attempt = run(offering.id, [{ nim: 99020002001, name: 'Mahasiswa Uji 021', uts: 95, uas: 70 }], { confirmations: { scoreUpdates: false, weightChanges: true } });
		await expect(attempt).rejects.toBeInstanceOf(ImportBlockedError);
		expect(await scoreOf('99020002001', offering.id, 'UTS-1')).toBe(70);
		expect(await rowCount(ctx.db, assessmentScoreRevisions)).toBe(before);
	});

	test('pembaruan terkonfirmasi mencatat revisi dan audit sebelum/sesudah yang menaut ke batch, tanpa menyentuh offering lain', async () => {
		const offeringA = await createOffering(ctx.db);
		const offeringB = await createOffering(ctx.db);
		const row = { nim: 99020002101, name: 'Mahasiswa Uji 022' };
		await run(offeringA.id, [{ ...row, uts: 70, uas: 70 }]);
		await run(offeringB.id, [{ ...row, uts: 55, uas: 65 }]);

		const { batch, result } = await run(offeringA.id, [{ ...row, uts: 88.5, uas: 70 }]);
		expect(result.summary).toMatchObject({ scoresUpdated: 1, scoresUnchanged: 1, scoresNew: 0 });
		expect(await scoreOf(row.nim.toString(), offeringA.id, 'UTS-1')).toBe(88.5);
		expect(await scoreOf(row.nim.toString(), offeringB.id, 'UTS-1')).toBe(55);
		expect(await scoreOf(row.nim.toString(), offeringB.id, 'UAS-1')).toBe(65);

		const revisions = await ctx.db.select().from(assessmentScoreRevisions).where(eq(assessmentScoreRevisions.batchId, batch.id));
		expect(revisions).toMatchObject([{ oldScore: 70, newScore: 88.5, changeType: 'import_update' }]);
		const audit = await ctx.db.select().from(auditLogs).where(and(eq(auditLogs.batchId, batch.id), eq(auditLogs.action, 'assessment_score.update')));
		expect(audit).toHaveLength(1);
		expect(audit[0].before).toEqual({ score: 70 });
		expect(audit[0].after).toEqual({ score: 88.5 });
	});

	test('nilai kosong di file baru tidak menghapus nilai lama, tetapi 0 adalah nilai nyata yang menimpa', async () => {
		const offering = await createOffering(ctx.db);
		const row = { nim: 99020002201, name: 'Mahasiswa Uji 023' };
		await run(offering.id, [{ ...row, uts: 80, uas: 90 }]);
		await run(offering.id, [{ ...row, uts: null, uas: 0 }]);
		expect(await scoreOf(row.nim.toString(), offering.id, 'UTS-1')).toBe(80);
		expect(await scoreOf(row.nim.toString(), offering.id, 'UAS-1')).toBe(0);
	});

	test('baris yang hilang dari file baru tidak menghapus mahasiswa, enrollment, atau nilainya', async () => {
		const offering = await createOffering(ctx.db);
		await run(offering.id, [
			{ nim: 99020002301, name: 'Mahasiswa Uji 024', uts: 80, uas: 80 },
			{ nim: 99020002302, name: 'Mahasiswa Uji 025', uts: 70, uas: 70 }
		]);
		await run(offering.id, [{ nim: 99020002301, name: 'Mahasiswa Uji 024', uts: 80, uas: 80 }]);
		expect(await scoreOf('99020002302', offering.id, 'UTS-1')).toBe(70);
		expect((await ctx.db.select().from(students).where(eq(students.nim, '99020002302'))).length).toBe(1);
	});

	test('strategi tambahkan-yang-belum-ada tidak menimpa nilai lama namun menambah yang baru', async () => {
		const offering = await createOffering(ctx.db);
		const row = { nim: 99020002401, name: 'Mahasiswa Uji 026' };
		await run(offering.id, [{ ...row, uts: 80, uas: null }]);
		const { result } = await run(offering.id, [{ ...row, uts: 99, uas: 77 }], { strategy: 'insert_missing' });
		expect(await scoreOf(row.nim.toString(), offering.id, 'UTS-1')).toBe(80);
		expect(await scoreOf(row.nim.toString(), offering.id, 'UAS-1')).toBe(77);
		expect(result.summary).toMatchObject({ scoresNew: 1, scoresUpdated: 0 });
		expect(result.sheets[0].skippedUpdates).toBe(1);
	});
});

describe('baris bermasalah dan sheet bermasalah', () => {
	const mixed: SimpleStudent[] = [
		{ nim: 99020003001, name: 'Mahasiswa Uji 031', uts: 80, uas: 80 },
		{ nim: 99020003002, name: 'Mahasiswa Uji 032', uts: 150, uas: 80 }
	];

	test('kebijakan blokir menahan seluruh sheet tanpa menulis apa pun', async () => {
		const offering = await createOffering(ctx.db);
		const before = await rowCount(ctx.db, students);
		await expect(run(offering.id, mixed)).rejects.toBeInstanceOf(ImportBlockedError);
		expect(await rowCount(ctx.db, students)).toBe(before);
	});

	test('kebijakan lewati hanya menulis baris valid dan batas baris bergalat tercatat di batch', async () => {
		const offering = await createOffering(ctx.db);
		const { batch } = await run(offering.id, mixed, { errorPolicy: 'skip_invalid_rows' });
		expect(await scoreOf('99020003001', offering.id, 'UTS-1')).toBe(80);
		expect((await ctx.db.select().from(students).where(eq(students.nim, '99020003002'))).length).toBe(0);
		const [stored] = await ctx.db.select().from(importBatches).where(eq(importBatches.id, batch.id));
		expect(stored).toMatchObject({ validRows: 1, errorRows: 1, status: 'committed' });
	});

	test('satu sheet bermasalah menahan seluruh workbook sehingga sheet lain tidak sebagian tertulis', async () => {
		const good = await createOffering(ctx.db);
		const who = await actor();
		const batch = await createBatch(ctx.db, who.id);
		const before = await rowCount(ctx.db, students);
		const attempt = commitImport(ctx.db, {
			batchId: batch.id,
			actor: who,
			sheets: [
				inputFor(simpleSheet('Baik', [{ nim: 99020003101, name: 'Mahasiswa Uji 033', uts: 80, uas: 80 }]), good.id),
				inputFor(simpleSheet('Tanpa Offering', [{ nim: 99020003102, name: 'Mahasiswa Uji 034', uts: 80, uas: 80 }]), null)
			],
			strategy: 'upsert',
			errorPolicy: 'block_on_error',
			confirmations: { scoreUpdates: true, weightChanges: true }
		});
		await expect(attempt).rejects.toBeInstanceOf(ImportBlockedError);
		expect(await rowCount(ctx.db, students)).toBe(before);
	});

	test('sheet yang tidak disertakan dilewati sepenuhnya', async () => {
		const offering = await createOffering(ctx.db);
		const who = await actor();
		const batch = await createBatch(ctx.db, who.id);
		const result = await commitImport(ctx.db, {
			batchId: batch.id,
			actor: who,
			sheets: [
				inputFor(simpleSheet('Ikut', [{ nim: 99020003201, name: 'Mahasiswa Uji 035', uts: 80, uas: 80 }]), offering.id),
				inputFor(simpleSheet('Lewati', [{ nim: 99020003202, name: 'Mahasiswa Uji 036', uts: 80, uas: 80 }]), null, { include: false })
			],
			strategy: 'upsert',
			errorPolicy: 'block_on_error',
			confirmations: { scoreUpdates: true, weightChanges: true }
		});
		expect(result.sheets.map((s) => s.sheet)).toEqual(['Ikut']);
		expect((await ctx.db.select().from(students).where(eq(students.nim, '99020003202'))).length).toBe(0);
	});
});

describe('status batch', () => {
	test('batch yang sudah committed tidak dapat dikomit lagi', async () => {
		const offering = await createOffering(ctx.db);
		const { batch, params } = await run(offering.id, [{ nim: 99020004001, name: 'Mahasiswa Uji 041', uts: 80, uas: 80 }]);
		expect(batch.id).toBe(params.batchId);
		await expect(commitImport(ctx.db, params)).rejects.toBeInstanceOf(ImportStateError);
	});

	test('batch yang tidak ada ditolak', async () => {
		const who = await actor();
		await expect(commitImport(ctx.db, { batchId: '00000000-0000-4000-8000-000000000000', actor: who, sheets: [], strategy: 'upsert', errorPolicy: 'block_on_error', confirmations: { scoreUpdates: true, weightChanges: true } })).rejects.toBeInstanceOf(ImportStateError);
	});
});

describe('atomisitas saat kegagalan di tengah transaksi', () => {
	test('galat database membatalkan seluruh sheet, batch ditandai failed dengan pesan aman', async () => {
		await ctx.db.execute(sql`
			create function reject_marker_score() returns trigger as $$
			begin
				if new.score = 13.37 then raise exception 'uji kegagalan sengaja'; end if;
				return new;
			end $$ language plpgsql`);
		await ctx.db.execute(sql`create trigger reject_marker before insert on assessment_scores for each row execute function reject_marker_score()`);

		const offering = await createOffering(ctx.db);
		const who = await actor();
		const batch = await createBatch(ctx.db, who.id);
		const before = await Promise.all([students, enrollments, assessmentScores, assessmentComponents, auditLogs].map((t) => rowCount(ctx.db, t)));
		const attempt = commitImport(ctx.db, {
			batchId: batch.id,
			actor: who,
			sheets: [
				inputFor(
					simpleSheet('Gagal', [
						{ nim: 99020005001, name: 'Mahasiswa Uji 051', uts: 80, uas: 80 },
						{ nim: 99020005002, name: 'Mahasiswa Uji 052', uts: 13.37, uas: 80 }
					]),
					offering.id
				)
			],
			strategy: 'upsert',
			errorPolicy: 'block_on_error',
			confirmations: { scoreUpdates: true, weightChanges: true }
		});
		await expect(attempt).rejects.toThrow();

		const after = await Promise.all([students, enrollments, assessmentScores, assessmentComponents, auditLogs].map((t) => rowCount(ctx.db, t)));
		expect(after).toEqual(before);
		const [stored] = await ctx.db.select().from(importBatches).where(eq(importBatches.id, batch.id));
		expect(stored.status).toBe('failed');
		expect(stored.errorMessage).toContain('Tidak ada data akademik yang berubah');
		expect(stored.errorMessage).not.toContain('uji kegagalan sengaja');
		expect(stored.errorMessage).not.toMatch(/insert|select|trigger/i);
		await ctx.db.execute(sql`drop trigger reject_marker on assessment_scores`);
	});
});
