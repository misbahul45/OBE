import { describe, expect, test } from 'bun:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { readWorkbook } from '#lib/features/imports/workbook-reader.server.ts';
import { analyzeSheet } from '#lib/features/imports/sheet-analysis.ts';

const root = resolve(import.meta.dir, '../../..');
const ignoredDirectories = new Set(['node_modules', '.svelte-kit', 'build', '.git', 'test-results', 'playwright-report', '.playwright-mcp', '.e2e-state', 'drizzle', '.data', '.output']);
const textExtensions = new Set(['.ts', '.svelte', '.json', '.md', '.sql', '.yml', '.yaml', '.css', '.html', '.js']);

function walk(directory: string): string[] {
	return readdirSync(directory).flatMap((name) => {
		if (ignoredDirectories.has(name)) return [];
		const path = join(directory, name);
		return statSync(path).isDirectory() ? walk(path) : [path];
	});
}

const numericConstantFiles = new Set(['src/lib/shared/format/hash.ts', 'tests/fixtures/builders/prng.ts']);
const syntheticNim = /^(0{0,2}99\d{6,}|0012345\d+|9\.9\d+E\+\d+)$|^$/;
const files = walk(root);
const rel = (path: string) => relative(root, path);

describe('fixture sintetis', () => {
	const workbooks = files.filter((f) => rel(f).startsWith('tests/fixtures/workbooks/') && f.endsWith('.xlsx') && !rel(f).includes('invalid-corrupt'));

	test('semua workbook fixture hanya berisi NIM dan nama sintetis', () => {
		expect(workbooks.length).toBeGreaterThanOrEqual(6);
		let checkedRows = 0;
		for (const path of workbooks) {
			const { sheets } = readWorkbook(new Uint8Array(readFileSync(path)), path);
			for (const grid of sheets) {
				const analysis = analyzeSheet(grid);
				if (analysis.nimColumn === null) continue;
				for (const row of analysis.rows) {
					if (row.kind !== 'student') continue;
					const nim = String(grid.rows[row.row - 1]?.[analysis.nimColumn]?.display ?? '').trim();
					const nameColumn = analysis.nameColumn;
					const name = nameColumn === null ? '' : String(grid.rows[row.row - 1]?.[nameColumn]?.display ?? '').trim();
					if (/^\d+$/.test(nim)) expect(nim, `${rel(path)} sheet ${grid.name} baris ${row.row}`).toMatch(syntheticNim);
					if (name) expect(name, `${rel(path)} sheet ${grid.name} baris ${row.row}`).toMatch(/^Mahasiswa Uji \d{3}$/);
					checkedRows++;
				}
			}
		}
		expect(checkedRows).toBeGreaterThan(60);
	});

	test('tidak ada berkas spreadsheet di luar folder fixture sintetis', () => {
		const spreadsheets = files.filter((f) => ['.xlsx', '.xls', '.xlsm', '.csv', '.ods'].includes(extname(f).toLowerCase()));
		const outside = spreadsheets.map(rel).filter((f) => !f.startsWith('tests/fixtures/workbooks/'));
		expect(outside).toEqual([]);
	});

	test('nama berkas fixture menandai sifat sintetis atau invalid', () => {
		const names = files.filter((f) => rel(f).startsWith('tests/fixtures/workbooks/')).map((f) => rel(f).split('/').pop()!);
		for (const name of names) expect(name, name).toMatch(/\.synthetic\.xlsx$|^invalid-.*\.xlsx$/);
	});
});

describe('pemindaian teks repositori', () => {
	const textFiles = files.filter((f) => textExtensions.has(extname(f)) && !rel(f).startsWith('docs/tracking/') && !rel(f).endsWith('package.json') && !rel(f).endsWith('bun.lock'));

	test('tidak ada deretan angka menyerupai NIM selain NIM sintetis berawalan 99', () => {
		const offenders: string[] = [];
		for (const path of textFiles) {
			if (numericConstantFiles.has(rel(path))) continue;
			const content = readFileSync(path, 'utf8');
			for (const match of content.matchAll(/(?<![\w.#/-])(\d{9,12})(?![\w.-])/g)) {
				const value = match[1];
				if (syntheticNim.test(value)) continue;
				offenders.push(`${rel(path)}: ${value}`);
			}
		}
		expect(offenders.slice(0, 15)).toEqual([]);
	});

	test('tidak ada alamat surel atau kata sandi nyata pada kode, tes, dan dokumen', () => {
		const emailPattern = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
		const allowedDomains = /@([a-z0-9-]+\.)*(invalid|test|example|e2e\.invalid|kampus\.ac\.id|contoh\.id)$|@(.+\.)?example\.(com|org)$|@\d+\.\d+\.\d+$/i;
		const offenders: string[] = [];
		for (const path of textFiles) {
			if (rel(path).startsWith('src/lib/components/ui/')) continue;
			for (const match of readFileSync(path, 'utf8').matchAll(emailPattern)) {
				if (!allowedDomains.test(match[0]) && !/\.(png|svg|css|ts|js|json)$/.test(match[0])) offenders.push(`${rel(path)}: ${match[0]}`);
			}
		}
		expect(offenders.slice(0, 15)).toEqual([]);
	});

	test('artefak yang dapat memuat data tampilan tidak ikut ke repositori', () => {
		const gitignore = readFileSync(join(root, '.gitignore'), 'utf8');
		for (const entry of ['test-results', 'playwright-report', '.playwright-mcp', '.e2e-state', '.env']) expect(gitignore, entry).toContain(entry);
	});

	test('berkas lingkungan yang dilacak hanya memuat contoh dan nilai uji lokal', () => {
		const example = readFileSync(join(root, '.env.example'), 'utf8');
		expect(example).not.toMatch(/postgres(ql)?:\/\/[^:\s]+:(?!ganti|password|changeme|<)[^@\s]{8,}@(?!localhost|127\.0\.0\.1)/i);
	});
});
