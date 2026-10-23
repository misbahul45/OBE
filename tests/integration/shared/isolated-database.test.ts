import { describe, expect, test } from 'bun:test';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import {
	assertTestDatabaseUrl,
	cloneTemplateDatabase,
	TestDatabaseGuardError,
	templateDatabaseName
} from '#lib/shared/db/test-database.server.ts';
import { requireTestDatabaseUrl, useIsolatedDatabase } from '../../support/integration.ts';

const first = useIsolatedDatabase('iso_first');
const second = useIsolatedDatabase('iso_second');

describe('database terisolasi per suite', () => {
	test('setiap suite mendapat database sendiri yang lolos guard', () => {
		expect(first.name).not.toBe(second.name);
		expect(assertTestDatabaseUrl(first.url).name).toBe(first.name);
		expect(first.name).toMatch(/^obe_iso_first_[0-9a-f]{6}_test$/);
	});

	test('data satu suite tidak terlihat di suite lain', async () => {
		await first.db.execute(sql`create table probe (id int primary key, label text not null)`);
		await first.db.execute(sql`insert into probe values (1, 'hanya-di-first')`);
		const rows = await first.db.execute(sql`select count(*)::int as count from probe`);
		expect(rows[0].count).toBe(1);
		const readProbe = async () => {
			await second.db.execute(sql`select * from probe`);
		};
		await expect(readProbe()).rejects.toThrow(/probe/);
	});

	test('database klon tidak membawa sisa data suite lain', async () => {
		const rows = await second.db.execute(sql`select count(*)::int as count from information_schema.tables where table_name = 'probe'`);
		expect(rows[0].count).toBe(0);
	});

	test('database template tidak pernah dipakai langsung dan tetap bersih', async () => {
		const templateUrl = requireTestDatabaseUrl().replace(/\/[^/]+$/, `/${templateDatabaseName}`);
		const client = postgres(templateUrl, { max: 1 });
		try {
			const rows = await client`select count(*)::int as count from information_schema.tables where table_name = 'probe'`;
			expect(rows[0].count).toBe(0);
		} finally {
			await client.end();
		}
	});

	test('nama suite tidak valid ditolak', async () => {
		await expect(cloneTemplateDatabase(requireTestDatabaseUrl(), 'Suite Buruk; drop')).rejects.toBeInstanceOf(TestDatabaseGuardError);
	});
});
