import { describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { cancelBatch, loadBatch, saveSheetSettings, stageUpload, type UploadResult } from '#lib/features/imports/index.server.ts';
import { importBatches, importMappingPresets, importSheetMappings } from '#lib/shared/db/schema.ts';
import { ValidationError } from '#lib/shared/http/errors.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { createImportScene } from '../../support/import-scene.ts';
import { buildSemesterWorkbook } from '../../fixtures/builders/templates.ts';
import { buildMultiHeaderWorkbook, buildNoStudentIdWorkbook } from '../../fixtures/builders/variations.ts';

const ctx = useIsolatedDatabase('imports_mapping');

const ok = (result: UploadResult) => {
	if (!result.ok) throw new Error(result.message);
	return result.batchId;
};

const sheetRow = async (batchId: string, sheetName: string) => {
	const [row] = await ctx.db.select().from(importSheetMappings).where(eq(importSheetMappings.batchId, batchId));
	void sheetName;
	return row;
};

const formFor = async (actor: { id: string; role: string }, batchId: string, sheetName: string) => {
	const sheet = (await loadBatch(ctx.db, actor, batchId)).sheets.find((s) => s.row.sheetName === sheetName)!;
	const mapping = sheet.input.mapping;
	const entries: Record<string, string> = { headerRow: String(mapping.headerRow), nimColumn: String(mapping.nimColumn), nameColumn: String(mapping.nameColumn ?? ''), firstDataRow: String(mapping.firstDataRow), excludedRows: '' };
	for (const c of mapping.components) Object.assign(entries, { [`col_${c.column}_role`]: 'component', [`col_${c.column}_code`]: c.code, [`col_${c.column}_name`]: c.name, [`col_${c.column}_type`]: c.type, [`col_${c.column}_weight`]: String(c.weightPercent ?? ''), [`col_${c.column}_max`]: String(c.maxScore) });
	for (const c of mapping.cpmkColumns) Object.assign(entries, { [`col_${c.column}_role`]: 'cpmk', [`col_${c.column}_code`]: c.code });
	for (const c of mapping.cplColumns) Object.assign(entries, { [`col_${c.column}_role`]: 'cpl', [`col_${c.column}_code`]: c.code });
	return entries;
};

describe('pemilihan target offering', () => {
	test('dosen hanya boleh memilih offering yang ditugaskan kepadanya; Super Admin boleh semuanya', async () => {
		const scene = await createImportScene(ctx.db);
		const batchId = ok(await stageUpload(ctx.db, scene.lecturerA, { name: 'a.xlsx', bytes: buildSemesterWorkbook() }));
		await saveSheetSettings(ctx.db, scene.lecturerA, batchId, 'Mata Kuliah Uji A', { offeringId: scene.offeringA.id });
		const rows = await ctx.db.select().from(importSheetMappings).where(eq(importSheetMappings.batchId, batchId));
		expect(rows.find((r) => r.sheetName === 'Mata Kuliah Uji A')?.offeringId).toBe(scene.offeringA.id);

		await expect(saveSheetSettings(ctx.db, scene.lecturerA, batchId, 'Mata Kuliah Uji A', { offeringId: scene.offeringB.id })).rejects.toMatchObject({ fieldErrors: { offeringId: [expect.stringContaining('tidak ditugaskan')] } });
		await expect(saveSheetSettings(ctx.db, scene.lecturerA, batchId, 'Mata Kuliah Uji A', { offeringId: '3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b' })).rejects.toBeInstanceOf(ValidationError);
		const unchanged = (await ctx.db.select().from(importSheetMappings).where(eq(importSheetMappings.batchId, batchId))).find((r) => r.sheetName === 'Mata Kuliah Uji A');
		expect(unchanged?.offeringId).toBe(scene.offeringA.id);

		await saveSheetSettings(ctx.db, scene.lecturerA, batchId, 'Mata Kuliah Uji A', { offeringId: null });
		const adminBatch = ok(await stageUpload(ctx.db, scene.admin, { name: 'b.xlsx', bytes: buildSemesterWorkbook() }));
		await saveSheetSettings(ctx.db, scene.admin, adminBatch, 'Kelas Uji B T1', { offeringId: scene.offeringB.id });
	});

	test('status batch berubah menjadi mapped, dan batch yang dibatalkan menolak perubahan', async () => {
		const scene = await createImportScene(ctx.db);
		const batchId = ok(await stageUpload(ctx.db, scene.admin, { name: 'a.xlsx', bytes: buildSemesterWorkbook() }));
		await saveSheetSettings(ctx.db, scene.admin, batchId, 'Kelas Uji B T1', { include: false });
		expect((await ctx.db.select().from(importBatches).where(eq(importBatches.id, batchId)))[0].status).toBe('mapped');
		await cancelBatch(ctx.db, scene.admin, batchId);
		await expect(saveSheetSettings(ctx.db, scene.admin, batchId, 'Kelas Uji B T1', { include: true })).rejects.toBeInstanceOf(ValidationError);
	});

	test('sheet tanpa pemetaan tidak dapat disertakan sebelum header ditentukan', async () => {
		const scene = await createImportScene(ctx.db);
		const batchId = ok(await stageUpload(ctx.db, scene.admin, { name: 'n.xlsx', bytes: buildNoStudentIdWorkbook() }));
		await saveSheetSettings(ctx.db, scene.admin, batchId, 'Tanpa NIM', { include: true });
		expect((await sheetRow(batchId, 'Tanpa NIM')).include).toBe(false);
		await expect(saveSheetSettings(ctx.db, scene.admin, batchId, 'Tanpa NIM', { reanalyzeHeaderRow: 1 })).rejects.toMatchObject({ fieldErrors: { headerRow: [expect.any(String)] } });
	});

	test('pengakuan NIM bertipe angka tersimpan per sheet', async () => {
		const scene = await createImportScene(ctx.db);
		const batchId = ok(await stageUpload(ctx.db, scene.admin, { name: 'a.xlsx', bytes: buildSemesterWorkbook() }));
		await saveSheetSettings(ctx.db, scene.admin, batchId, 'Kelas Uji B T1', { acknowledgeNumericNim: true });
		const loaded = await loadBatch(ctx.db, scene.admin, batchId);
		expect(loaded.sheets.map((s) => [s.row.sheetName, s.settings.numericNim])).toEqual([['Mata Kuliah Uji A', false], ['Kelas Uji B T1', true]]);
	});
});

describe('pemetaan kolom manual', () => {
	test('mengubah bobot dan peran kolom tersimpan sebagai pemetaan manual dan tervalidasi', async () => {
		const scene = await createImportScene(ctx.db);
		const batchId = ok(await stageUpload(ctx.db, scene.admin, { name: 'a.xlsx', bytes: buildSemesterWorkbook() }));
		const entries = await formFor(scene.admin, batchId, 'Mata Kuliah Uji A');
		entries.col_3_weight = '10';
		entries.col_4_role = 'ignore';
		await saveSheetSettings(ctx.db, scene.admin, batchId, 'Mata Kuliah Uji A', { mappingForm: entries });
		const loaded = (await loadBatch(ctx.db, scene.admin, batchId)).sheets[0];
		expect(loaded.stored.source).toBe('manual');
		expect(loaded.input.mapping.components).toHaveLength(7);
		expect(loaded.input.mapping.components.find((c) => c.column === 3)?.weightPercent).toBe(10);
		expect(loaded.input.mapping.components.some((c) => c.column === 4)).toBe(false);
	});

	test('pemetaan yang tidak konsisten ditolak dengan pesan per bidang dan tidak mengubah data', async () => {
		const scene = await createImportScene(ctx.db);
		const batchId = ok(await stageUpload(ctx.db, scene.admin, { name: 'a.xlsx', bytes: buildSemesterWorkbook() }));
		const before = (await sheetRow(batchId, 'Mata Kuliah Uji A')).mapping;
		const entries = await formFor(scene.admin, batchId, 'Mata Kuliah Uji A');
		entries.col_4_code = entries.col_3_code;
		const failure = await saveSheetSettings(ctx.db, scene.admin, batchId, 'Mata Kuliah Uji A', { mappingForm: entries }).catch((e) => e);
		expect(failure).toBeInstanceOf(ValidationError);
		expect(JSON.stringify(failure.fieldErrors)).toContain('dipakai lebih dari sekali');
		const badRole = { ...(await formFor(scene.admin, batchId, 'Mata Kuliah Uji A')), col_5_role: 'component', col_5_code: 'X', col_5_name: '', col_5_weight: 'abc' };
		await expect(saveSheetSettings(ctx.db, scene.admin, batchId, 'Mata Kuliah Uji A', { mappingForm: badRole })).rejects.toBeInstanceOf(ValidationError);
		expect((await sheetRow(batchId, 'Mata Kuliah Uji A')).mapping).toEqual(before);
	});

	test('menentukan ulang baris header memperbarui analisis untuk header bertingkat', async () => {
		const scene = await createImportScene(ctx.db);
		const batchId = ok(await stageUpload(ctx.db, scene.admin, { name: 'm.xlsx', bytes: buildMultiHeaderWorkbook() }));
		await saveSheetSettings(ctx.db, scene.admin, batchId, 'Header Bertingkat', { reanalyzeHeaderRow: 4 });
		const sheet = (await loadBatch(ctx.db, scene.admin, batchId)).sheets[0];
		expect(sheet.input.mapping).toMatchObject({ headerRow: 4, firstDataRow: 6 });
		expect(sheet.input.mapping.components.map((c) => c.weightPercent)).toEqual([40, 60]);
		await expect(saveSheetSettings(ctx.db, scene.admin, batchId, 'Header Bertingkat', { reanalyzeHeaderRow: 1 })).rejects.toBeInstanceOf(ValidationError);
	});
});

describe('preset pemetaan berdasarkan struktur sheet', () => {
	test('preset yang disimpan dipakai otomatis pada unggahan berstruktur sama, bukan berdasarkan nama berkas', async () => {
		const scene = await createImportScene(ctx.db);
		const first = ok(await stageUpload(ctx.db, scene.admin, { name: 'semester-3.xlsx', bytes: buildSemesterWorkbook() }));
		const entries = await formFor(scene.admin, first, 'Mata Kuliah Uji A');
		entries.col_3_name = 'Nama Khusus Preset';
		await saveSheetSettings(ctx.db, scene.admin, first, 'Mata Kuliah Uji A', { mappingForm: entries, savePresetName: 'Template Uji' });
		const [preset] = await ctx.db.select().from(importMappingPresets).where(eq(importMappingPresets.name, 'Template Uji'));
		expect(preset.useCount).toBe(0);

		const second = ok(await stageUpload(ctx.db, scene.lecturerA, { name: 'nama-lain-sama-sekali.xlsx', bytes: buildSemesterWorkbook() }));
		const loaded = await loadBatch(ctx.db, scene.lecturerA, second);
		const used = loaded.sheets.find((s) => s.row.sheetName === 'Mata Kuliah Uji A')!;
		expect(used.stored.source).toBe('preset');
		expect(used.input.mapping.components.find((c) => c.column === 3)?.name).toBe('Nama Khusus Preset');
		expect(loaded.sheets.find((s) => s.row.sheetName === 'Kelas Uji B T1')!.stored.source).toBe('auto');
		const [after] = await ctx.db.select().from(importMappingPresets).where(eq(importMappingPresets.id, preset.id));
		expect(after.useCount).toBe(1);
	});

	test('preset diperbarui (bukan digandakan) bila disimpan ulang untuk struktur yang sama', async () => {
		const scene = await createImportScene(ctx.db);
		const batchId = ok(await stageUpload(ctx.db, scene.admin, { name: 'a.xlsx', bytes: buildSemesterWorkbook() }));
		await saveSheetSettings(ctx.db, scene.admin, batchId, 'Kelas Uji B T1', { savePresetName: 'Nama Pertama' });
		await saveSheetSettings(ctx.db, scene.admin, batchId, 'Kelas Uji B T1', { savePresetName: 'Nama Kedua' });
		const presets = await ctx.db.select().from(importMappingPresets).where(eq(importMappingPresets.createdBy, scene.admin.id));
		expect(presets.map((p) => p.name)).toEqual(['Nama Kedua']);
	});

	test('struktur berbeda tidak memakai preset', async () => {
		const scene = await createImportScene(ctx.db);
		const batchId = ok(await stageUpload(ctx.db, scene.admin, { name: 'm.xlsx', bytes: buildMultiHeaderWorkbook() }));
		expect((await loadBatch(ctx.db, scene.admin, batchId)).sheets[0].stored.source).toBe('auto');
	});
});
