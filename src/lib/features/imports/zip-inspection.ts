export type ZipLimits = {
	maxEntries: number;
	maxUncompressedBytes: number;
	maxCompressionRatio: number;
};

export type ZipInspection = { entries: number; uncompressedBytes: number; names: string[] };

export type ZipProblem = 'CORRUPT' | 'TOO_MANY_ENTRIES' | 'ZIP_BOMB' | 'PATH_TRAVERSAL' | 'ZIP64_UNSUPPORTED';

export class ZipInspectionError extends Error {
	constructor(
		readonly problem: ZipProblem,
		message: string
	) {
		super(message);
		this.name = 'ZipInspectionError';
	}
}

const eocdSignature = 0x06054b50;
const centralSignature = 0x02014b50;
const minEocdSize = 22;
const maxCommentSize = 0xffff;

function findEndOfCentralDirectory(view: DataView): number {
	const start = Math.max(0, view.byteLength - minEocdSize - maxCommentSize);
	for (let offset = view.byteLength - minEocdSize; offset >= start; offset--) if (view.getUint32(offset, true) === eocdSignature) return offset;
	return -1;
}

export function inspectZip(bytes: Uint8Array, limits: ZipLimits): ZipInspection {
	if (bytes.byteLength < minEocdSize) throw new ZipInspectionError('CORRUPT', 'Arsip terlalu kecil');
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const eocd = findEndOfCentralDirectory(view);
	if (eocd < 0) throw new ZipInspectionError('CORRUPT', 'Direktori arsip tidak ditemukan');
	const totalEntries = view.getUint16(eocd + 10, true);
	const directorySize = view.getUint32(eocd + 12, true);
	const directoryOffset = view.getUint32(eocd + 16, true);
	if (totalEntries === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff)
		throw new ZipInspectionError('ZIP64_UNSUPPORTED', 'Arsip ZIP64 tidak didukung');
	if (totalEntries > limits.maxEntries) throw new ZipInspectionError('TOO_MANY_ENTRIES', `Arsip memuat ${totalEntries} entri`);
	if (directoryOffset + directorySize > bytes.byteLength) throw new ZipInspectionError('CORRUPT', 'Direktori arsip melewati ukuran berkas');

	const decoder = new TextDecoder('utf-8');
	const names: string[] = [];
	let cursor = directoryOffset;
	let uncompressedBytes = 0;
	for (let i = 0; i < totalEntries; i++) {
		if (cursor + 46 > bytes.byteLength || view.getUint32(cursor, true) !== centralSignature) throw new ZipInspectionError('CORRUPT', 'Entri arsip rusak');
		const compressed = view.getUint32(cursor + 20, true);
		const uncompressed = view.getUint32(cursor + 24, true);
		const nameLength = view.getUint16(cursor + 28, true);
		const extraLength = view.getUint16(cursor + 30, true);
		const commentLength = view.getUint16(cursor + 32, true);
		const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
		if (name.includes('..') || name.startsWith('/') || name.startsWith('\\') || /^[a-zA-Z]:/.test(name))
			throw new ZipInspectionError('PATH_TRAVERSAL', 'Nama entri arsip tidak aman');
		if (uncompressed > 1024 * 1024 && compressed > 0 && uncompressed / compressed > limits.maxCompressionRatio)
			throw new ZipInspectionError('ZIP_BOMB', 'Rasio kompresi mencurigakan');
		uncompressedBytes += uncompressed;
		if (uncompressedBytes > limits.maxUncompressedBytes) throw new ZipInspectionError('ZIP_BOMB', 'Ukuran setelah dekompresi melebihi batas');
		names.push(name);
		cursor += 46 + nameLength + extraLength + commentLength;
	}
	return { entries: totalEntries, uncompressedBytes, names };
}
