import { describe, expect, test } from 'bun:test';
import { isOwnedFileRef, newFileRef } from '#lib/features/imports/imports.storage.ts';
import { readLimited, StorageError } from '#lib/features/imports/imports.storage.server.ts';
import { createImportUploadHandler } from '#lib/features/imports/imports.uploadthing.server.ts';

const streamOf = (...chunks: number[][]) =>
	new ReadableStream<Uint8Array>({
		start(controller) {
			for (const chunk of chunks) controller.enqueue(new Uint8Array(chunk));
			controller.close();
		}
	});

describe('referensi berkas', () => {
	test('hanya referensi yang diawali ID pengguna sendiri dan berbentuk benar yang diterima', () => {
		const ref = newFileRef('usr_abc123', '3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b');
		expect(isOwnedFileRef(ref, 'usr_abc123')).toBe(true);
		expect(isOwnedFileRef(ref, 'usr_abc12')).toBe(false);
		expect(isOwnedFileRef(ref, 'usr_other')).toBe(false);
		expect(isOwnedFileRef(`usr_abc123:${'x'.repeat(100)}`, 'usr_abc123')).toBe(false);
		expect(isOwnedFileRef('usr_abc123:../../etc/passwd', 'usr_abc123')).toBe(false);
		expect(isOwnedFileRef('usr_abc123', 'usr_abc123')).toBe(false);
		expect(isOwnedFileRef('', 'usr_abc123')).toBe(false);
	});

	test('ID pengguna yang memuat titik dua tidak dapat meniru milik orang lain', () => {
		expect(isOwnedFileRef('a:b:3f2b8c1e-5a4d', 'a')).toBe(false);
		expect(isOwnedFileRef(newFileRef('a', '3f2b8c1e-5a4d-4e6f'), 'a:b')).toBe(false);
	});
});

describe('readLimited', () => {
	test('membaca seluruh isi bila di bawah batas', async () => {
		const bytes = await readLimited(new Response(streamOf([1, 2, 3], [4, 5])), 10);
		expect(Array.from(bytes)).toEqual([1, 2, 3, 4, 5]);
	});

	test('menolak lebih awal bila content-length melebihi batas', async () => {
		const response = new Response(streamOf([1]), { headers: { 'content-length': '500' } });
		await expect(readLimited(response, 100)).rejects.toMatchObject({ code: 'TOO_LARGE' });
	});

	test('menghentikan pembacaan bila aliran melebihi batas walau tanpa content-length', async () => {
		const failure = await readLimited(new Response(streamOf([1, 2, 3, 4], [5, 6, 7, 8])), 6).catch((e) => e);
		expect(failure).toBeInstanceOf(StorageError);
		expect(failure.code).toBe('TOO_LARGE');
	});

	test('isi kosong tanpa badan dilaporkan sebagai tidak ditemukan', async () => {
		await expect(readLimited(new Response(null), 10)).rejects.toMatchObject({ code: 'NOT_FOUND' });
	});
});

describe('handler unggahan', () => {
	const token = btoa(JSON.stringify({ apiKey: 'sk_test_contoh', appId: 'appcontoh', regions: ['sea1'] }));
	const file = { name: 'nilai.xlsx', size: 1000, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
	const call = async (actor: unknown, files: { name: string; size: number; type: string }[]) => {
		const handler = createImportUploadHandler({ token, authenticate: () => actor as never });
		const response = await handler(
			new Request('http://127.0.0.1/api/uploadthing?actionType=upload&slug=importWorkbook', {
				method: 'POST',
				headers: { 'content-type': 'application/json', 'x-uploadthing-package': 'uploadthing', 'x-uploadthing-version': '7.7.4' },
				body: JSON.stringify({ files, input: null })
			})
		);
		return { status: response.status, body: await response.text() };
	};

	test('tamu dan akun yang wajib ganti password ditolak dengan 403 sebelum menghubungi layanan luar', async () => {
		expect((await call(null, [file])).status).toBe(403);
		expect((await call({ id: 'u1', role: 'lecturer', mustChangePassword: true }, [file])).status).toBe(403);
	});

	test('hanya ekstensi xlsx dan csv yang diterima', async () => {
		const actor = { id: 'u1', role: 'lecturer', mustChangePassword: false };
		for (const name of ['nilai.pdf', 'nilai.xls', 'nilai.xlsx.exe', 'nilai']) {
			const result = await call(actor, [{ ...file, name }]);
			expect(result.status, name).toBe(400);
		}
	});

	test('konfigurasi rute hanya mengizinkan satu berkas dan membatasi ukuran', async () => {
		const handler = createImportUploadHandler({ token, authenticate: () => null });
		const response = await handler(new Request('http://127.0.0.1/api/uploadthing'));
		const config = (await response.json()) as { slug: string; config: Record<string, { maxFileSize: string; maxFileCount: number }> }[];
		expect(config[0].slug).toBe('importWorkbook');
		expect(config[0].config.blob).toMatchObject({ maxFileSize: '16MB', maxFileCount: 1 });
	});
});
