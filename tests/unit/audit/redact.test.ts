import { describe, expect, test } from 'bun:test';
import { maskNim, redactSensitive } from '#lib/features/audit/audit.redact.ts';

describe('redactSensitive', () => {
	test('menyamarkan kunci sensitif pada objek bersarang dan larik', () => {
		const result = redactSensitive({
			email: 'a@b.test',
			password: 'rahasia',
			nested: { sessionToken: 'abc', apiSecret: 'x', keep: 1 },
			list: [{ passwordHash: 'h', ok: true }]
		}) as Record<string, unknown>;
		expect(result.email).toBe('a@b.test');
		expect(result.password).toBe('[disamarkan]');
		expect(result.nested).toEqual({ sessionToken: '[disamarkan]', apiSecret: '[disamarkan]', keep: 1 });
		expect(result.list).toEqual([{ passwordHash: '[disamarkan]', ok: true }]);
	});

	test('mengubah tanggal menjadi ISO dan menjaga null/undefined', () => {
		expect(redactSensitive(new Date('2026-01-02T03:04:05Z'))).toBe('2026-01-02T03:04:05.000Z');
		expect(redactSensitive(null)).toBeNull();
		expect(redactSensitive(undefined)).toBeUndefined();
	});

	test('membatasi kedalaman rekursi', () => {
		let deep: Record<string, unknown> = { end: 1 };
		for (let i = 0; i < 12; i++) deep = { child: deep };
		expect(JSON.stringify(redactSensitive(deep))).toContain('[disamarkan]');
	});
});

describe('maskNim', () => {
	test('hanya menampilkan empat digit terakhir', () => {
		expect(maskNim('99012345678')).toBe('*******5678');
		expect(maskNim('1234')).toBe('****');
	});
});
