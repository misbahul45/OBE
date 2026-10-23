import { describe, expect, test } from 'bun:test';
import { applySecurityHeaders, securityHeaders } from '#lib/shared/http/security-headers.ts';

describe('securityHeaders', () => {
	test('selalu memuat proteksi dasar', () => {
		const headers = securityHeaders({ secure: false });
		expect(headers['X-Content-Type-Options']).toBe('nosniff');
		expect(headers['X-Frame-Options']).toBe('DENY');
		expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
		expect(headers['Permissions-Policy']).toContain('camera=()');
		expect(headers['Strict-Transport-Security']).toBeUndefined();
	});

	test('HSTS hanya untuk koneksi aman', () => {
		expect(securityHeaders({ secure: true })['Strict-Transport-Security']).toContain('max-age=31536000');
	});
});

describe('applySecurityHeaders', () => {
	test('tidak menimpa header yang sudah diatur oleh respons', () => {
		const headers = new Headers({ 'X-Frame-Options': 'SAMEORIGIN' });
		applySecurityHeaders(headers, { secure: false });
		expect(headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
		expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
	});
});
