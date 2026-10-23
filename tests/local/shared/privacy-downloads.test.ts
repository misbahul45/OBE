import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const downloads = join(homedir(), 'Downloads');
const root = resolve(import.meta.dir, '../../..');
const ignored = new Set(['node_modules', '.svelte-kit', 'build', '.git', 'test-results', 'playwright-report', '.e2e-state']);

const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

function walk(directory: string): string[] {
	return readdirSync(directory).flatMap((name) => {
		if (ignored.has(name)) return [];
		const path = join(directory, name);
		return statSync(path).isDirectory() ? walk(path) : [path];
	});
}

describe.skipIf(!existsSync(downloads))('berkas Excel asli di Downloads tidak disalin ke repositori', () => {
	test('tidak ada berkas di repositori yang isinya identik dengan Excel di Downloads', () => {
		const realHashes = new Map(
			readdirSync(downloads)
				.filter((name) => /\.(xlsx|xls|csv)$/i.test(name))
				.map((name) => [sha(join(downloads, name)), name] as const)
		);
		const copies = walk(root)
			.filter((path) => /\.(xlsx|xls|csv)$/i.test(path))
			.filter((path) => realHashes.has(sha(path)))
			.map((path) => path.slice(root.length + 1));
		expect(copies).toEqual([]);
	});

	test('nama berkas asli tidak muncul pada kode, tes, maupun dokumen', () => {
		const names = readdirSync(downloads)
			.filter((name) => /\.(xlsx|xls)$/i.test(name))
			.map((name) => name.replace(/\.(xlsx|xls)$/i, ''))
			.filter((name) => name.length >= 12);
		const hits: string[] = [];
		for (const path of walk(root)) {
			const relPath = path.slice(root.length + 1);
			if (!/\.(ts|svelte|md|json|sql)$/.test(path) || relPath.startsWith('tests/local/') || relPath.startsWith('docs/tracking/')) continue;
			const content = readFileSync(path, 'utf8');
			for (const name of names) if (content.includes(name)) hits.push(`${relPath}: ${name}`);
		}
		expect(hits).toEqual([]);
	});
});
