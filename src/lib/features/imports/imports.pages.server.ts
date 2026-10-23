import { fail, redirect, type ActionFailure } from '@sveltejs/kit';
import type { Database } from '#lib/shared/db/client.server.ts';
import { ValidationError } from '#lib/shared/http/errors.ts';
import { runAction, type FormFailure } from '#lib/shared/http/action.server.ts';
import { accessibleOfferingIds, getActiveSemester, listOfferings } from '#lib/features/academic/index.server.ts';
import { appRoles } from '#lib/features/auth/index.ts';
import { autoMapBatchSheets } from './imports.automap.server.ts';
import { commitBatch, cancelBatch, loadBatch, runDryRun, saveSheetSettings, StagedFileMissingError, stageUpload, type DryRunOptions, type ImportActor } from './imports.batch.server.ts';
import { getBatchDetail } from './imports.queries.server.ts';
import { toDryRunView, toWizardBatch } from './imports.view.server.ts';
import type { DryRunView, OfferingOption, WizardBatch } from './imports.view.ts';
import { importLimits } from './workbook-reader.server.ts';
import { isOwnedFileRef } from './imports.storage.ts';
import { StorageError, type FileStorage } from './imports.storage.server.ts';

export const importBasePath = (role: string) => (role === appRoles.superAdmin ? '/app/admin/imports' : '/app/lecturer/imports');

export async function offeringOptionsFor(db: Database, actor: ImportActor): Promise<OfferingOption[]> {
	const accessible = await accessibleOfferingIds(db, actor);
	const active = await getActiveSemester(db);
	const options: OfferingOption[] = [];
	for (let page = 1; ; page += 1) {
		const list = await listOfferings(db, { accessible, semesterId: active?.id, page, pageSize: 100 });
		options.push(...list.rows.map((row) => ({ id: row.id, label: `${row.courseCode} · ${row.courseName} — Kelas ${row.section}`, semesterName: row.semesterName })));
		if (page >= list.pageCount) return options;
	}
}

export type BatchPage =
	| { mode: 'wizard'; wizard: WizardBatch; offerings: OfferingOption[]; detail: Awaited<ReturnType<typeof getBatchDetail>> }
	| { mode: 'report'; detail: Awaited<ReturnType<typeof getBatchDetail>> };

export async function loadBatchPage(db: Database, actor: ImportActor, batchId: string): Promise<BatchPage> {
	const detail = await getBatchDetail(db, actor, batchId);
	if (detail.batch.status === 'committed' || detail.batch.status === 'cancelled') return { mode: 'report', detail };
	try {
		const loaded = await loadBatch(db, actor, batchId);
		return { mode: 'wizard', wizard: toWizardBatch(loaded), offerings: await offeringOptionsFor(db, actor), detail };
	} catch (error) {
		if (error instanceof StagedFileMissingError) return { mode: 'report', detail };
		throw error;
	}
}

export type AutoMapView = { mapped: number; created: number; semesterName: string; skipped: { sheet: string; reason: string }[] };

type Outcome = ActionFailure<FormFailure> | { success: string; dryRun?: DryRunView; sheet?: string; autoMap?: AutoMapView };

const text = (data: FormData, name: string) => String(data.get(name) ?? '');

function sheetFailure(sheet: string, failure: ActionFailure<FormFailure>) {
	return fail(failure.status, { ...failure.data, sheet });
}

export async function uploadAction(db: Database, actor: ImportActor, request: Request) {
	const data = await request.formData();
	const file = data.get('file');
	if (!(file instanceof File) || file.size === 0) return fail(400, { message: 'Pilih berkas .xlsx atau .csv terlebih dahulu.' });
	if (file.size > importLimits.maxFileBytes) return fail(413, { message: `Ukuran berkas melebihi batas ${Math.round(importLimits.maxFileBytes / 1024 / 1024)} MB.` });
	const result = await stageUpload(db, actor, { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
	if (!result.ok) return fail(400, { message: result.message });
	redirect(303, `${importBasePath(actor.role)}/${result.batchId}${result.duplicates.length ? '?duplikat=1' : ''}`);
}

const storageMessages = {
	NOT_FOUND: 'Berkas yang diunggah tidak ditemukan. Unggah ulang berkas.',
	TOO_LARGE: `Ukuran berkas melebihi batas ${Math.round(importLimits.maxFileBytes / 1024 / 1024)} MB.`,
	UNREACHABLE: 'Berkas tidak dapat diambil dari penyimpanan. Coba lagi.'
} as const;

export async function uploadStoredAction(db: Database, actor: ImportActor, request: Request, storage: FileStorage) {
	const data = await request.formData();
	const ref = text(data, 'fileRef');
	if (!isOwnedFileRef(ref, actor.id)) return fail(400, { message: 'Referensi berkas tidak valid. Unggah ulang berkas.' });
	try {
		const stored = await storage.download(ref, importLimits.maxFileBytes);
		const result = await stageUpload(db, actor, { name: text(data, 'fileName') || 'unggahan.xlsx', bytes: stored.bytes });
		if (!result.ok) return fail(400, { message: result.message });
		redirect(303, `${importBasePath(actor.role)}/${result.batchId}${result.duplicates.length ? '?duplikat=1' : ''}`);
	} catch (error) {
		if (error instanceof StorageError) return fail(error.code === 'TOO_LARGE' ? 413 : 400, { message: storageMessages[error.code] });
		throw error;
	} finally {
		await storage.remove(ref).catch(() => undefined);
	}
}

export function parseRunOptions(data: FormData): DryRunOptions {
	return {
		strategy: text(data, 'strategy') === 'insert_missing' ? 'insert_missing' : 'upsert',
		errorPolicy: text(data, 'errorPolicy') === 'skip_invalid_rows' ? 'skip_invalid_rows' : 'block_on_error',
		confirmations: { scoreUpdates: data.get('confirmScoreUpdates') === 'on', weightChanges: data.get('confirmWeightChanges') === 'on' }
	};
}

export async function saveSheetAction(db: Database, actor: ImportActor, batchId: string, request: Request): Promise<Outcome> {
	const data = await request.formData();
	const sheet = text(data, 'sheetName');
	const offering = text(data, 'offeringId');
	const result = await runAction(() =>
		saveSheetSettings(db, actor, batchId, sheet, {
			offeringId: offering === '' ? null : offering,
			include: data.get('include') === 'on',
			acknowledgeNumericNim: data.get('numericNim') === 'on'
		})
	);
	return result.ok ? { success: `Pengaturan sheet "${sheet}" disimpan.`, sheet } : sheetFailure(sheet, result.failure);
}

export async function saveMappingAction(db: Database, actor: ImportActor, batchId: string, request: Request): Promise<Outcome> {
	const data = await request.formData();
	const sheet = text(data, 'sheetName');
	const entries: Record<string, string> = {};
	for (const [key, value] of data.entries()) if (typeof value === 'string') entries[key] = value;
	const presetName = text(data, 'presetName').trim();
	const result = await runAction(() => saveSheetSettings(db, actor, batchId, sheet, { mappingForm: entries, savePresetName: presetName || undefined }));
	return result.ok ? { success: `Pemetaan kolom sheet "${sheet}" disimpan${presetName ? ` dan dijadikan preset "${presetName}"` : ''}.`, sheet } : sheetFailure(sheet, result.failure);
}

export async function reanalyzeAction(db: Database, actor: ImportActor, batchId: string, request: Request): Promise<Outcome> {
	const data = await request.formData();
	const sheet = text(data, 'sheetName');
	const row = Number(text(data, 'headerRow'));
	if (!Number.isInteger(row) || row < 1) return sheetFailure(sheet, fail(400, { fieldErrors: { headerRow: ['Masukkan nomor baris header berupa bilangan bulat positif'] } }));
	const result = await runAction(() => saveSheetSettings(db, actor, batchId, sheet, { reanalyzeHeaderRow: row }));
	return result.ok ? { success: `Baris header sheet "${sheet}" ditentukan ulang ke baris ${row}.`, sheet } : sheetFailure(sheet, result.failure);
}

export async function autoMapAction(db: Database, actor: ImportActor, batchId: string): Promise<Outcome> {
	const result = await runAction(() => autoMapBatchSheets(db, actor, batchId));
	if (!result.ok) return result.failure;
	const { mapped, skipped, semesterName, alreadyMapped } = result.value;
	const created = mapped.filter((entry) => entry.created).length;
	const parts = [`${mapped.length} sheet dipetakan ke kelas ${semesterName}`];
	if (created) parts.push(`${created} kelas baru dibuka`);
	if (alreadyMapped) parts.push(`${alreadyMapped} sheet sudah terpetakan sebelumnya`);
	if (skipped.length) parts.push(`${skipped.length} sheet perlu dipetakan manual`);
	return { success: `${parts.join('; ')}.`, autoMap: { mapped: mapped.length, created, semesterName, skipped } };
}

export async function dryRunAction(db: Database, actor: ImportActor, batchId: string, request: Request): Promise<Outcome> {
	const options = parseRunOptions(await request.formData());
	const result = await runAction(() => runDryRun(db, actor, batchId, options));
	if (!result.ok) return result.failure;
	return { success: 'Validasi selesai. Tidak ada data yang diubah.', dryRun: toDryRunView(result.value, options) };
}

export async function commitAction(db: Database, actor: ImportActor, batchId: string, request: Request): Promise<Outcome> {
	const options = parseRunOptions(await request.formData());
	const result = await runAction(async () => {
		const outcome = await commitBatch(db, actor, batchId, options);
		if (!outcome.ok) throw new ValidationError({ form: outcome.blockers.map((b) => b.message) }, 'Penyimpanan ditahan.');
		return outcome;
	});
	if (!result.ok) return result.failure;
	redirect(303, `${importBasePath(actor.role)}/${batchId}?selesai=${result.value.recompute === 'done' ? 'ok' : 'hitung'}`);
}

export async function cancelAction(db: Database, actor: ImportActor, batchId: string): Promise<Outcome> {
	const result = await runAction(() => cancelBatch(db, actor, batchId));
	if (!result.ok) return result.failure;
	redirect(303, `${importBasePath(actor.role)}?dibatalkan=1`);
}
