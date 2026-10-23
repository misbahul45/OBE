import { describe, expect, test } from 'bun:test';
import { and, eq } from 'drizzle-orm';
import {
	buildIssuesCsv,
	commitBatch,
	getBatchDetail,
	listBatches,
	runDryRun,
	saveSheetSettings,
	stageUpload,
	type DryRunOptions,
	type UploadResult
} from '#lib/features/imports/index.server.ts';
import { assessmentScores, auditLogs, cpmkResults, importBatches, importRowIssues, importSheetMappings, importStagedFiles, outcomeCalculationRuns, students } from '#lib/shared/db/schema.ts';
import { NotFoundError } from '#lib/shared/http/errors.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { createImportScene, defineCpmk, ensureCpl } from '../../support/import-scene.ts';
import { rowCount } from '../../support/imports.ts';
import { buildSemesterWorkbook } from '../../fixtures/builders/templates.ts';
import { buildVariationsWorkbook } from '../../fixtures/builders/variations.ts';

const ctx = useIsolatedDatabase('imports_report');

const options: DryRunOptions = { strategy: 'upsert', errorPolicy: 'block_on_error', confirmations: { scoreUpdates: true, weightChanges: true } };

const ok = (result: UploadResult) => {
	if (!result.ok) throw new Error(result.message);
	return result.batchId;
};

async function readyBatch() {
	const scene = await createImportScene(ctx.db);
	await ensureCpl(ctx.db, ['CPL-1']);
	await defineCpmk(ctx.db, scene.admin, scene.courseA.id, ['CPMK-1', 'CPMK-2', 'CPMK-3', 'CPMK-4', 'CPMK-5']);
	const batchId = ok(await stageUpload(ctx.db, scene.admin, { name: 'semester.xlsx', bytes: buildSemesterWorkbook() }));
	await saveSheetSettings(ctx.db, scene.admin, batchId, 'Kelas Uji B T1', { offeringId: scene.offeringA.id, acknowledgeNumericNim: true });
	await saveSheetSettings(ctx.db, scene.admin, batchId, 'Mata Kuliah Uji A', { offeringId: scene.offeringB.id, acknowledgeNumericNim: true });
	return { scene, batchId };
}

describe('dry-run', () => {
	test('merangkum perubahan lintas sheet, mencatat isu ke database, dan tidak mengubah data akademik', async () => {
		const { scene, batchId } = await readyBatch();
		const before = [await rowCount(ctx.db, students), await rowCount(ctx.db, assessmentScores)];
		const result = await runDryRun(ctx.db, scene.admin, batchId, options);
		expect(result.blockers).toEqual([]);
		expect(result.summary).toMatchObject({ studentsNew: 29, scoresNew: 15 * 8 + 14 * 7, enrollmentsNew: 29, rowsRejected: 0 });
		expect(result.issueTotals.warning).toBeGreaterThan(0);
		expect([await rowCount(ctx.db, students), await rowCount(ctx.db, assessmentScores)]).toEqual(before);
		const [batch] = await ctx.db.select().from(importBatches).where(eq(importBatches.id, batchId));
		expect(batch).toMatchObject({ status: 'validated', totalRows: 29 });
		const stored = await ctx.db.select().from(importRowIssues).where(eq(importRowIssues.batchId, batchId));
		expect(stored.length).toBe(result.issueTotals.error + result.issueTotals.warning + result.issueTotals.info);
	});

	test('menjalankan ulang dry-run mengganti daftar isu, bukan menumpuknya', async () => {
		const { scene, batchId } = await readyBatch();
		await runDryRun(ctx.db, scene.admin, batchId, options);
		const first = await rowCount(ctx.db, importRowIssues);
		await runDryRun(ctx.db, scene.admin, batchId, options);
		expect(await rowCount(ctx.db, importRowIssues)).toBe(first);
	});

	test('sheet tanpa offering atau tanpa pengakuan NIM numerik menghasilkan penghalang yang dapat dibaca', async () => {
		const scene = await createImportScene(ctx.db);
		const batchId = ok(await stageUpload(ctx.db, scene.admin, { name: 'semester.xlsx', bytes: buildSemesterWorkbook() }));
		await saveSheetSettings(ctx.db, scene.admin, batchId, 'Kelas Uji B T1', { offeringId: scene.offeringA.id });
		const result = await runDryRun(ctx.db, scene.admin, batchId, options);
		const byCode = result.blockers.map((b) => b.code);
		expect(byCode).toContain('OFFERING_NOT_SELECTED');
		expect(byCode).toContain('NIM_NUMERIC_UNACKNOWLEDGED');
		expect(result.blockers.every((b) => b.message.startsWith('Sheet "'))).toBe(true);
	});
});

describe('laporan galat CSV', () => {
	test('memuat kode dan lokasi isu tanpa NIM maupun nama mahasiswa', async () => {
		const scene = await createImportScene(ctx.db);
		const batchId = ok(await stageUpload(ctx.db, scene.admin, { name: 'variasi.xlsx', bytes: buildVariationsWorkbook() }));
		await saveSheetSettings(ctx.db, scene.admin, batchId, 'Variasi Uji', { offeringId: scene.offeringA.id, acknowledgeNumericNim: true });
		await runDryRun(ctx.db, scene.admin, batchId, { ...options, errorPolicy: 'skip_invalid_rows' });
		const csv = await buildIssuesCsv(ctx.db, scene.admin, batchId);
		expect(csv.startsWith('﻿Sheet,Baris,Kolom,Bidang,Tingkat,Kode,Pesan\r\n')).toBe(true);
		for (const code of ['NIM_EMPTY', 'NIM_INVALID_FORMAT', 'NIM_DUPLICATE_IN_SHEET', 'SCORE_OUT_OF_RANGE', 'SCORE_DATE_FORMAT', 'SCORE_FORMULA_ERROR']) expect(csv).toContain(code);
		expect(csv).not.toMatch(/99000000\d{3}/);
		expect(csv).not.toContain('Mahasiswa Uji');
	});

	test('isi yang mengandung pemicu rumus dinetralkan; hanya pengunggah atau Super Admin yang dapat mengunduh', async () => {
		const scene = await createImportScene(ctx.db);
		const batchId = ok(await stageUpload(ctx.db, scene.lecturerA, { name: 'a.xlsx', bytes: buildSemesterWorkbook() }));
		await ctx.db.insert(importRowIssues).values({ batchId, sheetName: '=HYPERLINK("http://x")', severity: 'error', code: 'X', message: '@SUM(1)+cmd' });
		const csv = await buildIssuesCsv(ctx.db, scene.lecturerA, batchId);
		expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`);
		expect(csv).toContain(`"'@SUM(1)+cmd"`);
		await expect(buildIssuesCsv(ctx.db, scene.lecturerB, batchId)).rejects.toBeInstanceOf(NotFoundError);
		await expect(buildIssuesCsv(ctx.db, scene.admin, batchId)).resolves.toContain('X');
	});
});

describe('commit batch', () => {
	test('menyimpan, menghitung ulang CPMK/CPL, menghapus berkas sementara, dan membuat laporan batch', async () => {
		const { scene, batchId } = await readyBatch();
		await runDryRun(ctx.db, scene.admin, batchId, options);
		const result = await commitBatch(ctx.db, scene.admin, batchId, options);
		if (!result.ok) throw new Error(JSON.stringify(result.blockers));
		expect(result.recompute).toBe('done');
		expect(result.summary).toMatchObject({ studentsNew: 29, scoresNew: 218, referencesNew: 99 });
		expect(result.studentIds).toHaveLength(29);

		const [batch] = await ctx.db.select().from(importBatches).where(eq(importBatches.id, batchId));
		expect(batch).toMatchObject({ status: 'committed', studentsInserted: 29, scoresInserted: 218 });
		expect((await ctx.db.select().from(importStagedFiles).where(eq(importStagedFiles.batchId, batchId))).length).toBe(0);
		const sheetStatuses = (await ctx.db.select().from(importSheetMappings).where(eq(importSheetMappings.batchId, batchId))).map((s) => s.status);
		expect(sheetStatuses).toEqual(['committed', 'committed']);
		expect((await ctx.db.select().from(outcomeCalculationRuns).where(eq(outcomeCalculationRuns.offeringId, scene.offeringA.id))).length).toBe(0);

		const refs = await ctx.db.select().from(cpmkResults).where(and(eq(cpmkResults.batchId, batchId), eq(cpmkResults.source, 'imported_reference')));
		expect(refs).toHaveLength(70);

		const detail = await getBatchDetail(ctx.db, scene.admin, batchId);
		expect(detail.sheets.map((s) => [s.sheetName, s.courseName, s.status])).toEqual([
			['Kelas Uji B T1', 'Kelas Uji B', 'committed'],
			['Mata Kuliah Uji A', 'Mata Kuliah Uji A', 'committed']
		]);
		expect(detail.affectedTotal).toBe(29);
		expect(detail.affectedStudents).toHaveLength(29);
		expect(detail.affectedStudents[0].nimMasked).toMatch(/^\*+\d{4}$/);
		const audit = await ctx.db.select().from(auditLogs).where(eq(auditLogs.batchId, batchId));
		expect(audit.map((l) => l.action)).toEqual(expect.arrayContaining(['import.upload', 'import.commit', 'import.commit.sheet']));
	});

	test('penghalang menahan commit tanpa menulis apa pun dan batch tetap dapat dilanjutkan', async () => {
		const scene = await createImportScene(ctx.db);
		const batchId = ok(await stageUpload(ctx.db, scene.admin, { name: 'semester.xlsx', bytes: buildSemesterWorkbook() }));
		await saveSheetSettings(ctx.db, scene.admin, batchId, 'Kelas Uji B T1', { offeringId: scene.offeringA.id });
		await saveSheetSettings(ctx.db, scene.admin, batchId, 'Mata Kuliah Uji A', { include: false });
		const before = await rowCount(ctx.db, students);
		const blocked = await commitBatch(ctx.db, scene.admin, batchId, options);
		expect(blocked).toMatchObject({ ok: false, blockers: [{ code: 'NIM_NUMERIC_UNACKNOWLEDGED' }] });
		expect(await rowCount(ctx.db, students)).toBe(before);
		const [batch] = await ctx.db.select().from(importBatches).where(eq(importBatches.id, batchId));
		expect(batch.status).not.toBe('committed');
		await saveSheetSettings(ctx.db, scene.admin, batchId, 'Kelas Uji B T1', { acknowledgeNumericNim: true });
		expect((await commitBatch(ctx.db, scene.admin, batchId, options)).ok).toBe(true);
	});

	test('pemetaan offering yang dimanipulasi langsung di basis data tetap ditolak saat commit karena otorisasi diperiksa ulang', async () => {
		const scene = await createImportScene(ctx.db);
		const batchId = ok(await stageUpload(ctx.db, scene.lecturerA, { name: 'semester.xlsx', bytes: buildSemesterWorkbook() }));
		await saveSheetSettings(ctx.db, scene.lecturerA, batchId, 'Kelas Uji B T1', { acknowledgeNumericNim: true });
		await saveSheetSettings(ctx.db, scene.lecturerA, batchId, 'Mata Kuliah Uji A', { include: false });
		await ctx.db.update(importSheetMappings).set({ offeringId: scene.offeringB.id }).where(and(eq(importSheetMappings.batchId, batchId), eq(importSheetMappings.sheetName, 'Kelas Uji B T1')));
		const before = await rowCount(ctx.db, students);
		const result = await commitBatch(ctx.db, scene.lecturerA, batchId, options);
		expect(result).toMatchObject({ ok: false, blockers: [{ message: expect.stringContaining('tidak berhak') }] });
		expect(await rowCount(ctx.db, students)).toBe(before);
	});

	test('batch yang sudah disimpan tidak dapat disimpan lagi', async () => {
		const { scene, batchId } = await readyBatch();
		expect((await commitBatch(ctx.db, scene.admin, batchId, options)).ok).toBe(true);
		await expect(commitBatch(ctx.db, scene.admin, batchId, options)).rejects.toMatchObject({ fieldErrors: { form: ['Batch sudah selesai atau dibatalkan'] } });
	});
});

describe('deteksi file duplikat dan idempotensi lintas batch', () => {
	test('mengunggah berkas identik setelah disimpan menandai duplikat dan hasil impor ulang tidak mengubah data', async () => {
		const { scene, batchId } = await readyBatch();
		expect((await commitBatch(ctx.db, scene.admin, batchId, options)).ok).toBe(true);

		const again = await stageUpload(ctx.db, scene.admin, { name: 'semester (1).xlsx', bytes: buildSemesterWorkbook() });
		expect(again.ok).toBe(true);
		if (!again.ok) return;
		expect(again.duplicates.length).toBeGreaterThanOrEqual(1);
		expect(again.duplicates[0]).toMatchObject({ batchId, fileName: 'semester.xlsx' });
		expect(again.duplicates[0].offeringIds.sort()).toEqual([scene.offeringA.id, scene.offeringB.id].sort());
		const [row] = await ctx.db.select().from(importBatches).where(eq(importBatches.id, again.batchId));
		expect(row.duplicateOfBatchId).toBe(batchId);

		for (const [sheet, offering] of [['Kelas Uji B T1', scene.offeringA.id], ['Mata Kuliah Uji A', scene.offeringB.id]] as const)
			await saveSheetSettings(ctx.db, scene.admin, again.batchId, sheet, { offeringId: offering, acknowledgeNumericNim: true });
		const dry = await runDryRun(ctx.db, scene.admin, again.batchId, options);
		expect(dry.summary).toMatchObject({ studentsNew: 0, scoresNew: 0, scoresUpdated: 0, scoresUnchanged: 218 });
		const result = await commitBatch(ctx.db, scene.admin, again.batchId, { ...options, confirmations: { scoreUpdates: false, weightChanges: false } });
		expect(result.ok).toBe(true);
	});

	test('dosen tidak mendapat informasi batch milik pengguna lain meskipun isi berkasnya identik', async () => {
		const { scene, batchId } = await readyBatch();
		expect((await commitBatch(ctx.db, scene.admin, batchId, options)).ok).toBe(true);
		const byLecturer = await stageUpload(ctx.db, scene.lecturerA, { name: 'salinan.xlsx', bytes: buildSemesterWorkbook() });
		expect(byLecturer).toMatchObject({ ok: true, duplicates: [] });
		if (!byLecturer.ok) return;
		const [row] = await ctx.db.select().from(importBatches).where(eq(importBatches.id, byLecturer.batchId));
		expect(row.duplicateOfBatchId).toBeNull();
	});
});

describe('riwayat impor', () => {
	test('dosen hanya melihat batch miliknya, Super Admin melihat semuanya, dengan filter status dan pencarian', async () => {
		const scene = await createImportScene(ctx.db);
		const a = ok(await stageUpload(ctx.db, scene.lecturerA, { name: 'milik-a-unik.xlsx', bytes: buildSemesterWorkbook() }));
		const b = ok(await stageUpload(ctx.db, scene.lecturerB, { name: 'milik-b-unik.xlsx', bytes: buildSemesterWorkbook() }));
		const forA = await listBatches(ctx.db, scene.lecturerA, { search: 'unik' });
		expect(forA.rows.map((r) => r.id)).toEqual([a]);
		expect(forA.rows[0]).toMatchObject({ sheetCount: 2, status: 'uploaded' });
		const forAdmin = await listBatches(ctx.db, scene.admin, { search: 'unik' });
		expect(forAdmin.rows.map((r) => r.id).sort()).toEqual([a, b].sort());
		expect((await listBatches(ctx.db, scene.admin, { search: 'unik', status: 'committed' })).total).toBe(0);
		expect((await listBatches(ctx.db, scene.admin, { search: '%' })).total).toBe(0);
		await expect(getBatchDetail(ctx.db, scene.lecturerA, b)).rejects.toBeInstanceOf(NotFoundError);
	});
});
