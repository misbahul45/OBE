import { describe, expect, test } from 'bun:test';
import { generateTemporaryPassword, isStrongPassword, passwordIssues } from '#lib/features/auth/password-policy.ts';

describe('passwordIssues', () => {
	test('password kuat tidak memiliki isu', () => {
		expect(passwordIssues('TestAdmin#2026-synthetic')).toEqual([]);
	});

	test('melaporkan setiap kelemahan secara terpisah', () => {
		expect(passwordIssues('pendek')).toContain('Minimal 10 karakter');
		expect(passwordIssues('semuahurufkecil1!')).toContain('Harus memuat huruf besar');
		expect(passwordIssues('SEMUAHURUFBESAR1!')).toContain('Harus memuat huruf kecil');
		expect(passwordIssues('TanpaAngka!!!!')).toContain('Harus memuat angka');
		expect(passwordIssues('TanpaSimbol1234')).toContain('Harus memuat simbol');
		expect(passwordIssues('A1!a'.repeat(40))).toContain('Maksimal 128 karakter');
	});
});

describe('generateTemporaryPassword', () => {
	test('selalu memenuhi kebijakan dan berpanjang sesuai permintaan', () => {
		for (let i = 0; i < 200; i++) {
			const password = generateTemporaryPassword();
			expect(password.length).toBe(16);
			expect(isStrongPassword(password)).toBe(true);
		}
		expect(generateTemporaryPassword(24).length).toBe(24);
		expect(generateTemporaryPassword(4).length).toBe(12);
	});

	test('tidak menghasilkan nilai yang sama berulang kali dan tanpa karakter ambigu', () => {
		const values = new Set(Array.from({ length: 100 }, () => generateTemporaryPassword()));
		expect(values.size).toBe(100);
		for (const value of values) expect(value).not.toMatch(/[0O1lIo]/);
	});
});
