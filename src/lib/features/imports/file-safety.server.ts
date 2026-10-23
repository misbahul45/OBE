import { createHash } from 'node:crypto';

export function sha256Hex(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

export function sanitizeFileName(raw: string): string {
	const base = raw.split(/[\\/]/).pop() ?? '';
	const cleaned = base
		.normalize('NFKC')
		.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '')
		.replace(/\s+/g, ' ')
		.replace(/^\.+/, '')
		.trim();
	const dot = cleaned.lastIndexOf('.');
	const stem = dot > 0 ? cleaned.slice(0, dot) : cleaned;
	const extension = dot > 0 ? cleaned.slice(dot).toLowerCase() : '';
	const safeStem = stem.slice(0, 100).replace(/[^\p{L}\p{N} ._()\-]/gu, '_').trim();
	return `${safeStem || 'berkas'}${extension}`;
}
