import { describe, expect, test } from 'bun:test';
import { evaluateRouteAccess, sanitizeNextPath } from '#lib/features/auth/route-access.ts';

const admin = { role: 'super_admin', mustChangePassword: false } as const;
const lecturer = { role: 'lecturer', mustChangePassword: false } as const;

describe('evaluateRouteAccess', () => {
	test('halaman publik terbuka tanpa sesi', () => {
		for (const path of ['/', '/login', '/api/auth/sign-in/email', '/favicon.svg'])
			expect(evaluateRouteAccess(path, null)).toEqual({ kind: 'allow' });
	});

	test('rute /app tanpa sesi diarahkan ke login membawa tujuan', () => {
		expect(evaluateRouteAccess('/app/lecturer/courses', null)).toEqual({ kind: 'redirect', location: '/login?next=%2Fapp%2Flecturer%2Fcourses' });
		expect(evaluateRouteAccess('/app', null).kind).toBe('redirect');
	});

	test('/app diarahkan ke beranda sesuai peran', () => {
		expect(evaluateRouteAccess('/app', admin)).toEqual({ kind: 'redirect', location: '/app/admin' });
		expect(evaluateRouteAccess('/app', lecturer)).toEqual({ kind: 'redirect', location: '/app/lecturer' });
	});

	test('dosen tidak boleh masuk area admin dan sebaliknya', () => {
		expect(evaluateRouteAccess('/app/admin', lecturer)).toEqual({ kind: 'forbidden' });
		expect(evaluateRouteAccess('/app/admin/students', lecturer)).toEqual({ kind: 'forbidden' });
		expect(evaluateRouteAccess('/app/lecturer', admin)).toEqual({ kind: 'forbidden' });
		expect(evaluateRouteAccess('/app/lecturer/import', admin)).toEqual({ kind: 'forbidden' });
	});

	test('awalan serupa bukan bagian dari area admin', () => {
		expect(evaluateRouteAccess('/app/administrator', lecturer)).toEqual({ kind: 'allow' });
		expect(evaluateRouteAccess('/app/lecturers-guide', admin)).toEqual({ kind: 'allow' });
	});

	test('rute bersama dapat diakses kedua peran', () => {
		for (const user of [admin, lecturer]) {
			expect(evaluateRouteAccess('/app/students/abc', user)).toEqual({ kind: 'allow' });
			expect(evaluateRouteAccess('/app/account/password', user)).toEqual({ kind: 'allow' });
		}
	});

	test('pengguna login yang membuka /login dikembalikan ke beranda', () => {
		expect(evaluateRouteAccess('/login', lecturer)).toEqual({ kind: 'redirect', location: '/app/lecturer' });
	});

	test('wajib ganti password memblokir semua rute /app kecuali halaman ganti password dan logout', () => {
		const forced = { role: 'lecturer', mustChangePassword: true } as const;
		expect(evaluateRouteAccess('/app/lecturer/import', forced)).toEqual({ kind: 'redirect', location: '/app/account/password' });
		expect(evaluateRouteAccess('/app/students/x/transcript.pdf', forced).kind).toBe('redirect');
		expect(evaluateRouteAccess('/app/account/password', forced)).toEqual({ kind: 'allow' });
		expect(evaluateRouteAccess('/app/logout', forced)).toEqual({ kind: 'allow' });
	});

	test('pengguna tanpa peran dikenal diperlakukan seperti belum login', () => {
		expect(evaluateRouteAccess('/app/admin', { role: null, mustChangePassword: false }).kind).toBe('redirect');
	});
});

describe('sanitizeNextPath', () => {
	test('hanya menerima path internal di bawah /app', () => {
		expect(sanitizeNextPath('/app/lecturer/courses?x=1')).toBe('/app/lecturer/courses?x=1');
		for (const bad of ['//evil.test', 'https://evil.test/app', '/\\evil', '/login', '', null, undefined, '/apple'])
			expect(sanitizeNextPath(bad)).toBeNull();
	});
});
