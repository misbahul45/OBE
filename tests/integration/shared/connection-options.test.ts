import { describe, expect, test } from 'bun:test';
import { connectionOptionsFor } from '#lib/shared/db/client.server.ts';

describe('connectionOptionsFor', () => {
	test('pooler PgBouncer (Neon) mematikan prepared statement', () => {
		expect(connectionOptionsFor('postgresql://u:p@ep-abc-123-pooler.contoh.invalid/neondb?sslmode=require')).toEqual({ prepare: false });
	});

	test('koneksi langsung dan lokal memakai pengaturan bawaan', () => {
		expect(connectionOptionsFor('postgresql://u:p@ep-abc-123.contoh.invalid/neondb?sslmode=require')).toEqual({});
		expect(connectionOptionsFor('postgres://obe:x@127.0.0.1:55432/obe_dev')).toEqual({});
	});

	test('URL tidak valid gagal dengan jelas, bukan menghasilkan konfigurasi diam-diam', () => {
		expect(() => connectionOptionsFor('bukan-url')).toThrow();
	});
});
