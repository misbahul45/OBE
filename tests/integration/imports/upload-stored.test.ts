import { describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { isRedirect } from '@sveltejs/kit';
import { uploadStoredAction, StorageError, type FileStorage } from '#lib/features/imports/index.server.ts';
import { importBatches, importStagedFiles } from '#lib/shared/db/schema.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { createImportScene } from '../../support/import-scene.ts';
import { rowCount } from '../../support/imports.ts';
import { buildCorruptWorkbook } from '../../fixtures/builders/variations.ts';
import { buildSemesterWorkbook } from '../../fixtures/builders/templates.ts';

const ctx = useIsolatedDatabase('imports_stored');

const refOf = (actorId: string) => `${actorId}:3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b`;

function fakeStorage(behavior: { bytes?: Uint8Array; failure?: StorageError }) {
	const calls = { download: [] as string[], remove: [] as string[] };
	const storage: FileStorage = {
		async download(ref, maxBytes) {
			calls.download.push(ref);
			if (behavior.failure) throw behavior.failure;
			expect(maxBytes).toBe(10 * 1024 * 1024);
			return { bytes: behavior.bytes ?? new Uint8Array() };
		},
		async remove(ref) {
			calls.remove.push(ref);
		}
	};
	return { storage, calls };
}

const requestOf = (fields: Record<string, string>) => {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) data.set(key, value);
	return new Request('http://localhost/app/lecturer/import?/uploadStored', { method: 'POST', body: data });
};

async function run(action: Promise<unknown>) {
	try {
		return { result: await action, redirect: null as string | null };
	} catch (error) {
		if (isRedirect(error)) return { result: null, redirect: error.location };
		throw error;
	}
}

describe('uploadStoredAction', () => {
	test('mengambil berkas dari penyimpanan, membuat batch, mengalihkan ke wizard, lalu menghapus berkas luar', async () => {
		const scene = await createImportScene(ctx.db);
		const { storage, calls } = fakeStorage({ bytes: buildSemesterWorkbook() });
		const ref = refOf(scene.lecturerA.id);
		const { redirect } = await run(uploadStoredAction(ctx.db, scene.lecturerA, requestOf({ fileRef: ref, fileName: '../Nilai Semester 3.xlsx' }), storage));
		expect(redirect).toMatch(/^\/app\/lecturer\/imports\/[0-9a-f-]{36}$/);
		const batchId = redirect!.split('/').pop()!;
		const [batch] = await ctx.db.select().from(importBatches).where(eq(importBatches.id, batchId));
		expect(batch).toMatchObject({ uploaderId: scene.lecturerA.id, fileName: 'Nilai Semester 3.xlsx', status: 'uploaded' });
		expect((await ctx.db.select().from(importStagedFiles).where(eq(importStagedFiles.batchId, batchId))).length).toBe(1);
		expect(calls).toEqual({ download: [ref], remove: [ref] });
	});

	test('referensi milik pengguna lain atau berbentuk salah ditolak tanpa menyentuh penyimpanan', async () => {
		const scene = await createImportScene(ctx.db);
		const { storage, calls } = fakeStorage({ bytes: buildSemesterWorkbook() });
		const before = await rowCount(ctx.db, importBatches);
		for (const ref of [refOf(scene.lecturerB.id), 'bukan-referensi', '', `${scene.lecturerA.id}:../../x`]) {
			const { result } = await run(uploadStoredAction(ctx.db, scene.lecturerA, requestOf({ fileRef: ref, fileName: 'a.xlsx' }), storage));
			expect(result, ref).toMatchObject({ status: 400 });
		}
		expect(calls).toEqual({ download: [], remove: [] });
		expect(await rowCount(ctx.db, importBatches)).toBe(before);
	});

	test('berkas rusak ditolak dengan pesan jelas, tidak membuat batch, dan tetap dihapus dari penyimpanan luar', async () => {
		const scene = await createImportScene(ctx.db);
		const { storage, calls } = fakeStorage({ bytes: buildCorruptWorkbook() });
		const ref = refOf(scene.admin.id);
		const before = await rowCount(ctx.db, importBatches);
		const { result } = await run(uploadStoredAction(ctx.db, scene.admin, requestOf({ fileRef: ref, fileName: 'rusak.xlsx' }), storage));
		expect(result).toMatchObject({ status: 400, data: { message: expect.stringMatching(/rusak|bukan workbook|tidak valid/i) } });
		expect(calls.remove).toEqual([ref]);
		expect(await rowCount(ctx.db, importBatches)).toBe(before);
	});

	test('kegagalan penyimpanan dipetakan ke pesan yang dapat dibaca dan berkas tetap dibersihkan', async () => {
		const scene = await createImportScene(ctx.db);
		const cases: [StorageError, number, RegExp][] = [
			[new StorageError('TOO_LARGE', 'x'), 413, /10 MB/],
			[new StorageError('NOT_FOUND', 'x'), 400, /tidak ditemukan/],
			[new StorageError('UNREACHABLE', 'x'), 400, /tidak dapat diambil/]
		];
		for (const [failure, status, message] of cases) {
			const { storage, calls } = fakeStorage({ failure });
			const ref = refOf(scene.lecturerA.id);
			const { result } = await run(uploadStoredAction(ctx.db, scene.lecturerA, requestOf({ fileRef: ref, fileName: 'a.xlsx' }), storage));
			expect(result).toMatchObject({ status, data: { message: expect.stringMatching(message) } });
			expect(calls.remove).toEqual([ref]);
		}
	});

	test('kegagalan menghapus berkas luar tidak menggagalkan unggahan yang sudah berhasil', async () => {
		const scene = await createImportScene(ctx.db);
		const storage: FileStorage = {
			download: async () => ({ bytes: buildSemesterWorkbook() }),
			remove: async () => {
				throw new Error('layanan luar tidak tersedia');
			}
		};
		const { redirect } = await run(uploadStoredAction(ctx.db, scene.lecturerA, requestOf({ fileRef: refOf(scene.lecturerA.id), fileName: 'a.xlsx' }), storage));
		expect(redirect).toMatch(/\/app\/lecturer\/imports\//);
	});
});
