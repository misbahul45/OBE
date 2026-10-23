import { afterAll, describe, expect, test } from 'bun:test';
import postgres from 'postgres';
import {
	assertTestDatabaseUrl,
	dropDatabaseIfExists,
	resetTestDatabase,
	TestDatabaseGuardError,
	withDatabaseName
} from '#lib/shared/db/test-database.server.ts';
import { requireTestDatabaseUrl } from '../../support/integration.ts';

const baseUrl = requireTestDatabaseUrl();
const probeUrl = withDatabaseName(baseUrl, 'obe_guard_probe_test');
const devUrl = withDatabaseName(baseUrl, 'obe_dev');
const admin = postgres(assertTestDatabaseUrl(baseUrl).adminUrl, { max: 1, onnotice: () => {} });

afterAll(async () => {
	await dropDatabaseIfExists(probeUrl);
	await admin.end();
});

describe('assertTestDatabaseUrl', () => {
	test('menerima database berakhiran _test di loopback', () => {
		expect(assertTestDatabaseUrl(baseUrl).name).toBe('obe_test');
		expect(assertTestDatabaseUrl('postgres://u:p@localhost:5432/x_test').name).toBe('x_test');
	});

	test('menolak database dev dan database sistem', () => {
		expect(() => assertTestDatabaseUrl(devUrl)).toThrow(TestDatabaseGuardError);
		expect(() => assertTestDatabaseUrl('postgresql://u:p@127.0.0.1:5432/postgres')).toThrow(TestDatabaseGuardError);
	});

	test('menolak host non-loopback', () => {
		expect(() => assertTestDatabaseUrl('postgresql://u:p@db.example.com:5432/obe_test')).toThrow(/loopback/);
	});

	test('menolak nama berbahaya dan huruf besar', () => {
		expect(() => assertTestDatabaseUrl('postgresql://u:p@127.0.0.1:5432/OBE_test')).toThrow(TestDatabaseGuardError);
		expect(() => assertTestDatabaseUrl(`postgresql://u:p@127.0.0.1:5432/${encodeURIComponent('a_test"; DROP DATABASE obe_dev; --')}`)).toThrow(TestDatabaseGuardError);
	});

	test('menolak URL rusak dan protokol salah', () => {
		expect(() => assertTestDatabaseUrl('bukan-url')).toThrow(TestDatabaseGuardError);
		expect(() => assertTestDatabaseUrl('mysql://u:p@127.0.0.1:3306/obe_test')).toThrow(TestDatabaseGuardError);
	});
});

describe('resetTestDatabase', () => {
	test('menolak mereset database dev dan database dev tetap ada', async () => {
		await expect(resetTestDatabase(devUrl)).rejects.toBeInstanceOf(TestDatabaseGuardError);
		const rows = await admin`select datname from pg_database where datname = 'obe_dev'`;
		expect(rows.length).toBe(1);
	});

	test('membuat ulang database probe dari nol lalu menerapkan migrasi', async () => {
		await resetTestDatabase(probeUrl);
		const seeding = postgres(probeUrl, { max: 1 });
		try {
			await seeding`create table sisa_data_lama (id int)`;
		} finally {
			await seeding.end();
		}
		await resetTestDatabase(probeUrl);
		const fresh = postgres(probeUrl, { max: 1 });
		try {
			const [{ stale }] = await fresh`select count(*)::int as stale from information_schema.tables where table_name = 'sisa_data_lama'`;
			const [{ migrated }] = await fresh`select count(*)::int as migrated from information_schema.tables where table_name = 'students'`;
			expect(stale).toBe(0);
			expect(migrated).toBe(1);
		} finally {
			await fresh.end();
		}
	});
});
