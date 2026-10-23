import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { is, sql } from 'drizzle-orm';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import * as schema from '#lib/shared/db/schema.ts';
import { createDb } from '#lib/shared/db/client.server.ts';
import { dropDatabaseIfExists, migrateDatabase, resetTestDatabase, withDatabaseName } from '#lib/shared/db/test-database.server.ts';
import { requireTestDatabaseUrl } from '../../support/integration.ts';
import { createStudent } from '../../support/factories.ts';

const probeUrl = withDatabaseName(requireTestDatabaseUrl(), 'obe_migration_probe_test');
const declared = (Object.values(schema) as unknown[]).filter((value): value is PgTable => is(value, PgTable)).map((table) => getTableConfig(table));
let connection: ReturnType<typeof createDb>;

async function names(query: ReturnType<typeof sql>): Promise<string[]> {
	const rows = (await connection.db.execute(query)) as unknown as { name: string }[];
	return rows.map((row) => row.name);
}

beforeAll(async () => {
	await resetTestDatabase(probeUrl);
	connection = createDb(probeUrl, { max: 3, onnotice: () => {} });
});

afterAll(async () => {
	await connection.client.end();
	await dropDatabaseIfExists(probeUrl);
});

describe('instalasi bersih dari migrasi', () => {
	test('setiap tabel di schema hadir di database dan tidak ada tabel liar', async () => {
		const actual = await names(sql`select table_name as name from information_schema.tables where table_schema = 'public'`);
		expect(actual.sort()).toEqual(declared.map((table) => table.name).sort());
		expect(declared.length).toBe(41);
	});

	test('seluruh index dan unique constraint yang dideklarasikan hadir', async () => {
		const actual = new Set(await names(sql`select indexname as name from pg_indexes where schemaname = 'public'`));
		const expected = declared.flatMap((table) => [
			...table.indexes.map((index) => index.config.name),
			...table.uniqueConstraints.map((constraint) => constraint.name ?? '')
		]);
		const missing = expected.filter((name) => name && !actual.has(name));
		expect(missing).toEqual([]);
	});

	test('jumlah foreign key dan check constraint sama dengan deklarasi', async () => {
		const [{ fks }] = (await connection.db.execute(sql`select count(*)::int as fks from pg_constraint where contype = 'f' and connamespace = 'public'::regnamespace`)) as unknown as { fks: number }[];
		const [{ checks }] = (await connection.db.execute(sql`select count(*)::int as checks from pg_constraint where contype = 'c' and connamespace = 'public'::regnamespace`)) as unknown as { checks: number }[];
		expect(fks).toBe(declared.reduce((sum, table) => sum + table.foreignKeys.length, 0));
		expect(checks).toBe(declared.reduce((sum, table) => sum + table.checks.length, 0));
	});

	test('tidak ada identifier yang terpotong (maksimal 63 karakter)', () => {
		const files = readdirSync('drizzle').filter((file) => file.endsWith('.sql'));
		const long = files.flatMap((file) => [...readFileSync(`drizzle/${file}`, 'utf8').matchAll(/"([a-z0-9_]{64,})"/g)].map((m) => m[1]));
		expect(long).toEqual([]);
	});

	test('migrasi dapat dijalankan ulang tanpa perubahan', async () => {
		expect(await migrateDatabase(probeUrl)).toBe(true);
		const actual = await names(sql`select table_name as name from information_schema.tables where table_schema = 'public'`);
		expect(actual.length).toBe(41);
	});
});

describe('transaksi', () => {
	test('kegagalan di tengah transaksi membatalkan seluruh perubahan', async () => {
		const failing = connection.db.transaction(async (tx) => {
			await createStudent(tx as never, { nim: '99099999999' });
			throw new Error('gagal sengaja');
		});
		await expect(failing).rejects.toThrow('gagal sengaja');
		const rows = (await connection.db.execute(sql`select count(*)::int as n from students where nim = '99099999999'`)) as unknown as { n: number }[];
		expect(rows[0].n).toBe(0);
	});
});
