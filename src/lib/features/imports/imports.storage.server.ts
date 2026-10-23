import { UTApi } from 'uploadthing/server';

export type StorageFailureCode = 'NOT_FOUND' | 'TOO_LARGE' | 'UNREACHABLE';

export class StorageError extends Error {
	constructor(
		readonly code: StorageFailureCode,
		message: string
	) {
		super(message);
		this.name = 'StorageError';
	}
}

export type StoredFile = { bytes: Uint8Array };

export type FileStorage = {
	download: (ref: string, maxBytes: number) => Promise<StoredFile>;
	remove: (ref: string) => Promise<void>;
};

export async function readLimited(response: Response, maxBytes: number): Promise<Uint8Array> {
	const declared = Number(response.headers.get('content-length'));
	if (Number.isFinite(declared) && declared > maxBytes) throw new StorageError('TOO_LARGE', 'Ukuran berkas melebihi batas.');
	if (!response.body) throw new StorageError('NOT_FOUND', 'Isi berkas tidak tersedia.');
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > maxBytes) {
			await reader.cancel();
			throw new StorageError('TOO_LARGE', 'Ukuran berkas melebihi batas.');
		}
		chunks.push(value);
	}
	const bytes = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return bytes;
}

export function createUploadThingStorage(options: { token: string; fetch?: typeof fetch }): FileStorage {
	const api = new UTApi({ token: options.token });
	const request = options.fetch ?? fetch;
	return {
		async download(ref, maxBytes) {
			const lookup = await api.getFileUrls(ref, { keyType: 'customId' }).catch(() => null);
			const entry = lookup?.data[0];
			if (!entry) throw new StorageError('NOT_FOUND', 'Berkas yang diunggah tidak ditemukan.');
			const signed = await api.generateSignedURL(entry.key, { expiresIn: 120 }).then((r) => r.ufsUrl).catch(() => null);
			for (const url of [signed, entry.url]) {
				if (!url) continue;
				const response = await request(url).catch(() => null);
				if (response?.ok) return { bytes: await readLimited(response, maxBytes) };
			}
			throw new StorageError('UNREACHABLE', 'Berkas yang diunggah tidak dapat diambil.');
		},
		async remove(ref) {
			await api.deleteFiles(ref, { keyType: 'customId' });
		}
	};
}
