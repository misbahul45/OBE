import { describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import {
	assertBatchAccess,
	cancelBatch,
	loadBatch,
	purgeExpiredStagedFiles,
	StagedFileMissingError,
	stageUpload,
	type UploadResult
} from '#lib/features/imports/index.server.ts';
import { importBatches, importSheetMappings, importStagedFiles } from '#lib/shared/db/schema.ts';
import { NotFoundError, ValidationError } from '#lib/shared/http/errors.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { createImportScene } from '../../support/import-scene.ts';
import { rowCount } from '../../support/imports.ts';
import { createCourse } from '../../support/factories.ts';
import { createOffering } from '#lib/features/academic/index.server.ts';
import { workbookBuffer, writeSheet } from '../../fixtures/builders/sheet-writer.ts';
import { buildSemesterWorkbook } from '../../fixtures/builders/templates.ts';
import { buildCorruptWorkbook, buildNoStudentIdWorkbook, buildZipBombLike } from '../../fixtures/builders/variations.ts';

const ctx = useIsolatedDatabase('imports_upload');

const ok = (result: UploadResult) => {
	if (!result.ok) throw new Error(`unggahan gagal: ${result.message}`);
	return result;
};

describe('stageUpload', () => {
	test('membuat batch, menyimpan berkas di staging privat, dan satu pemetaan per sheet', async () => {
		const scene = await createImportScene(ctx.db);
		const bytes = buildSemesterWorkbook();
		const result = ok(await stageUpload(ctx.db, scene.lecturerA, { name: 'Semester 1.xlsx', bytes }));
		expect(result.sheets).toEqual(['Mata Kuliah Uji A', 'Kelas Uji B T1']);
		const [batch] = await ctx.db.select().from(importBatches).where(eq(importBatches.id, result.batchId));
		expect(batch).toMatchObject({ uploaderId: scene.lecturerA.id, fileName: 'Semester 1.xlsx', status: 'uploaded', fileKind: 'xlsx', fileSize: bytes.byteLength });
		expect(batch.fileSha256).toMatch(/^[0-9a-f]{64}$/);
		const [staged] = await ctx.db.select().from(importStagedFiles).where(eq(importStagedFiles.batchId, result.batchId));
		expect(Buffer.compare(staged.content, bytes)).toBe(0);
		expect(staged.expiresAt.getTime()).toBeGreaterThan(Date.now());
		const sheets = await ctx.db.select().from(importSheetMappings).where(eq(importSheetMappings.batchId, result.batchId));
		expect(sheets.every((s) => s.include && s.status === 'pending' && s.rowCount > 0)).toBe(true);
	});

	test('saran offering dibatasi pada kelas yang diampu pengunggah dan hanya diberikan bila unik', async () => {
		const scene = await createImportScene(ctx.db);
		const bytes = buildSemesterWorkbook();
		const forA = ok(await stageUpload(ctx.db, scene.lecturerA, { name: 'a.xlsx', bytes }));
		const forB = ok(await stageUpload(ctx.db, scene.lecturerB, { name: 'b.xlsx', bytes }));
		const suggestion = async (batchId: string) =>
			Object.fromEntries((await ctx.db.select().from(importSheetMappings).where(eq(importSheetMappings.batchId, batchId))).map((s) => [s.sheetName, s.offeringId]));
		expect(await suggestion(forA.batchId)).toEqual({ 'Mata Kuliah Uji A': null, 'Kelas Uji B T1': scene.offeringA.id });
		expect(await suggestion(forB.batchId)).toEqual({ 'Mata Kuliah Uji A': scene.offeringB.id, 'Kelas Uji B T1': null });
	});

	test('Super Admin mendapat saran hanya bila satu offering cocok; beberapa kandidat berarti tanpa saran', async () => {
		const scene = await createImportScene(ctx.db);
		const second = await createImportScene(ctx.db);
		const ambiguous = ok(await stageUpload(ctx.db, scene.admin, { name: 'a.xlsx', bytes: buildSemesterWorkbook() }));
		const rows = await ctx.db.select().from(importSheetMappings).where(eq(importSheetMappings.batchId, ambiguous.batchId));
		expect(rows.every((r) => r.offeringId === null)).toBe(true);
		expect(second.offeringA.id).not.toBe(scene.offeringA.id);

		const unique = await createCourse(ctx.db, { name: 'Genetika Medis Uji' });
		const offering = await createOffering(ctx.db, scene.admin, { courseId: unique.id, semesterId: scene.semester.id, section: 'T2' });
		const sheet = writeSheet([['No', 'NIM', 'Nama', 'UTS (100 %)'], [1, 99000000601, 'Mahasiswa Uji 601', 80]]);
		const bytes = workbookBuffer([{ name: 'Genetika Medis Uji T2', sheet }]);
		const result = ok(await stageUpload(ctx.db, scene.admin, { name: 'genetika.xlsx', bytes }));
		const [row] = await ctx.db.select().from(importSheetMappings).where(eq(importSheetMappings.batchId, result.batchId));
		expect(row.offeringId).toBe(offering.id);
	});

	test('nama berkas disanitasi dari path dan karakter berbahaya', async () => {
		const scene = await createImportScene(ctx.db);
		const result = ok(await stageUpload(ctx.db, scene.admin, { name: '../../etc/Berkas Uji 7(1).XLSX', bytes: buildSemesterWorkbook() }));
		const [batch] = await ctx.db.select().from(importBatches).where(eq(importBatches.id, result.batchId));
		expect(batch.fileName).toBe('Berkas Uji 7(1).xlsx');
	});

	test('berkas tidak valid ditolak dengan kode yang jelas dan tidak membuat batch atau berkas staging', async () => {
		const scene = await createImportScene(ctx.db);
		const before = [await rowCount(ctx.db, importBatches), await rowCount(ctx.db, importStagedFiles)];
		const cases: [string, Uint8Array, string][] = [
			['rusak.xlsx', buildCorruptWorkbook(), 'CORRUPT_FILE'],
			['bom.xlsx', buildZipBombLike(), 'ZIP_BOMB'],
			['lama.xls', buildSemesterWorkbook(), 'UNSUPPORTED_TYPE'],
			['kosong.xlsx', new Uint8Array(0), 'EMPTY_FILE'],
			['dokumen.pdf', new Uint8Array([37, 80, 68, 70]), 'UNSUPPORTED_TYPE']
		];
		for (const [name, bytes, code] of cases) {
			const result = await stageUpload(ctx.db, scene.admin, { name, bytes });
			expect(result).toMatchObject({ ok: false, code });
		}
		expect([await rowCount(ctx.db, importBatches), await rowCount(ctx.db, importStagedFiles)]).toEqual(before);
	});

	test('workbook tanpa kolom NIM diterima untuk dipetakan manual tetapi tidak disertakan otomatis', async () => {
		const scene = await createImportScene(ctx.db);
		const result = ok(await stageUpload(ctx.db, scene.admin, { name: 'tanpa-nim.xlsx', bytes: buildNoStudentIdWorkbook() }));
		const [sheet] = await ctx.db.select().from(importSheetMappings).where(eq(importSheetMappings.batchId, result.batchId));
		expect(sheet).toMatchObject({ include: false, headerRow: null, offeringId: null });
	});
});

describe('akses dan siklus hidup batch', () => {
	test('batch hanya dapat dibuka pengunggahnya dan Super Admin; yang lain mendapat galat tidak ditemukan', async () => {
		const scene = await createImportScene(ctx.db);
		const { batchId } = ok(await stageUpload(ctx.db, scene.lecturerA, { name: 'a.xlsx', bytes: buildSemesterWorkbook() }));
		await expect(assertBatchAccess(ctx.db, scene.lecturerA, batchId)).resolves.toMatchObject({ id: batchId });
		await expect(assertBatchAccess(ctx.db, scene.admin, batchId)).resolves.toMatchObject({ id: batchId });
		const other = await assertBatchAccess(ctx.db, scene.lecturerB, batchId).catch((e) => e);
		const missing = await assertBatchAccess(ctx.db, scene.lecturerB, '3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b').catch((e) => e);
		expect(other).toBeInstanceOf(NotFoundError);
		expect(other.message).toBe(missing.message);
		await expect(loadBatch(ctx.db, scene.lecturerB, batchId)).rejects.toBeInstanceOf(NotFoundError);
	});

	test('loadBatch membaca ulang berkas staging dan menghasilkan masukan per sheet', async () => {
		const scene = await createImportScene(ctx.db);
		const { batchId } = ok(await stageUpload(ctx.db, scene.lecturerA, { name: 'a.xlsx', bytes: buildSemesterWorkbook() }));
		const loaded = await loadBatch(ctx.db, scene.lecturerA, batchId);
		expect(loaded.sheets.map((s) => s.input.sheetName)).toEqual(['Mata Kuliah Uji A', 'Kelas Uji B T1']);
		expect(loaded.sheets[1].input).toMatchObject({ offeringId: scene.offeringA.id, include: true });
		expect(loaded.sheets[0].input.mapping.components).toHaveLength(8);
		expect(loaded.sheets[0].settings.numericNim).toBe(false);
	});

	test('berkas staging kedaluwarsa tidak dapat dipakai dan dibersihkan oleh purge', async () => {
		const scene = await createImportScene(ctx.db);
		const { batchId } = ok(await stageUpload(ctx.db, scene.admin, { name: 'a.xlsx', bytes: buildSemesterWorkbook() }));
		await ctx.db.update(importStagedFiles).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(importStagedFiles.batchId, batchId));
		await expect(loadBatch(ctx.db, scene.admin, batchId)).rejects.toBeInstanceOf(StagedFileMissingError);
		expect(await purgeExpiredStagedFiles(ctx.db)).toBeGreaterThanOrEqual(1);
		expect((await ctx.db.select().from(importStagedFiles).where(eq(importStagedFiles.batchId, batchId))).length).toBe(0);
	});

	test('unggahan baru membersihkan berkas sementara yang sudah kedaluwarsa tanpa menyentuh yang masih berlaku', async () => {
		const scene = await createImportScene(ctx.db);
		const stale = ok(await stageUpload(ctx.db, scene.admin, { name: 'lama.xlsx', bytes: buildSemesterWorkbook() }));
		const fresh = ok(await stageUpload(ctx.db, scene.admin, { name: 'baru.xlsx', bytes: buildSemesterWorkbook() }));
		await ctx.db.update(importStagedFiles).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(importStagedFiles.batchId, stale.batchId));
		const trigger = ok(await stageUpload(ctx.db, scene.admin, { name: 'pemicu.xlsx', bytes: buildSemesterWorkbook() }));
		const remaining = (await ctx.db.select({ batchId: importStagedFiles.batchId }).from(importStagedFiles)).map((r) => r.batchId);
		expect(remaining).not.toContain(stale.batchId);
		expect(remaining).toContain(fresh.batchId);
		expect(remaining).toContain(trigger.batchId);
	});

	test('pembatalan menghapus berkas sementara dan menandai batch cancelled', async () => {
		const scene = await createImportScene(ctx.db);
		const { batchId } = ok(await stageUpload(ctx.db, scene.lecturerA, { name: 'a.xlsx', bytes: buildSemesterWorkbook() }));
		await cancelBatch(ctx.db, scene.lecturerA, batchId);
		const [batch] = await ctx.db.select().from(importBatches).where(eq(importBatches.id, batchId));
		expect(batch.status).toBe('cancelled');
		expect((await ctx.db.select().from(importStagedFiles).where(eq(importStagedFiles.batchId, batchId))).length).toBe(0);
		await ctx.db.update(importBatches).set({ status: 'committed' }).where(eq(importBatches.id, batchId));
		await expect(cancelBatch(ctx.db, scene.lecturerA, batchId)).rejects.toBeInstanceOf(ValidationError);
	});
});
