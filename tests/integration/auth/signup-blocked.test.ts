import { describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { account, user } from '#lib/shared/db/schema.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { buildAuth, jsonRequest, signInViaHandler, strongPassword } from '../../support/auth.ts';

const ctx = useIsolatedDatabase('auth_signup');
const auth = () => buildAuth(ctx.db);

async function countUsers(): Promise<number> {
	return (await ctx.db.select().from(user)).length;
}

describe('pendaftaran publik', () => {
	test('API server signUpEmail ditolak dan tidak membuat pengguna', async () => {
		const attempt = async () => {
			await auth().api.signUpEmail({ body: { email: 'penyusup@uji.invalid', password: strongPassword, name: 'Penyusup' } });
		};
		await expect(attempt()).rejects.toThrow();
		expect(await countUsers()).toBe(0);
	});

	test('endpoint HTTP /sign-up/email ditolak di backend', async () => {
		const response = await auth().handler(jsonRequest('/sign-up/email', { email: 'penyusup2@uji.invalid', password: strongPassword, name: 'Penyusup' }));
		expect(response.status).toBeGreaterThanOrEqual(400);
		expect(await countUsers()).toBe(0);
	});
});

describe('pembuatan akun oleh sistem', () => {
	test('createUser server-side membuat dosen dengan peran bawaan dan password ter-hash', async () => {
		const { user: created } = await auth().api.createUser({ body: { email: 'dosen.satu@uji.invalid', password: strongPassword, name: 'Dosen Satu', data: { mustChangePassword: true } } });
		const [stored] = await ctx.db.select().from(user).where(eq(user.id, created.id));
		expect(stored.role).toBe('lecturer');
		expect(stored.mustChangePassword).toBe(true);
		const [credential] = await ctx.db.select().from(account).where(eq(account.userId, created.id));
		expect(credential.providerId).toBe('credential');
		expect(credential.password).not.toBe(strongPassword);
		expect(credential.password).not.toContain(strongPassword);
		expect(credential.password!.length).toBeGreaterThan(40);
	});

	test('login berhasil dengan password benar dan gagal dengan password salah', async () => {
		await auth().api.createUser({ body: { email: 'login@uji.invalid', password: strongPassword, name: 'Pengguna Login' } });
		const ok = await signInViaHandler(auth(), 'login@uji.invalid', strongPassword);
		expect(ok.response.status).toBe(200);
		expect(ok.cookie).toContain('session_token');
		const bad = await signInViaHandler(auth(), 'login@uji.invalid', 'Salah#Password99');
		expect(bad.response.status).toBe(401);
	});

	test('akun yang dinonaktifkan tidak dapat masuk', async () => {
		const { user: created } = await auth().api.createUser({ body: { email: 'nonaktif@uji.invalid', password: strongPassword, name: 'Nonaktif' } });
		await ctx.db.update(user).set({ banned: true, banReason: 'uji' }).where(eq(user.id, created.id));
		const result = await signInViaHandler(auth(), 'nonaktif@uji.invalid', strongPassword);
		expect(result.response.status).toBeGreaterThanOrEqual(400);
		expect(result.cookie).not.toContain('session_token');
	});
});

describe('eskalasi hak', () => {
	test('pembuatan pengguna lewat HTTP tanpa sesi ditolak', async () => {
		const response = await auth().handler(jsonRequest('/admin/create-user', { email: 'x@uji.invalid', password: strongPassword, name: 'X', role: 'super_admin' }));
		expect(response.status).toBe(401);
	});

	test('dosen yang login tidak dapat membuat Super Admin lewat HTTP', async () => {
		await auth().api.createUser({ body: { email: 'dosen.dua@uji.invalid', password: strongPassword, name: 'Dosen Dua' } });
		const { cookie } = await signInViaHandler(auth(), 'dosen.dua@uji.invalid', strongPassword);
		const before = await countUsers();
		const response = await auth().handler(
			jsonRequest('/admin/create-user', { email: 'admin.palsu@uji.invalid', password: strongPassword, name: 'Admin Palsu', role: 'super_admin' }, { cookie })
		);
		expect(response.status).toBe(403);
		expect(await countUsers()).toBe(before);
	});

	test('dosen tidak dapat mengubah perannya sendiri lewat HTTP', async () => {
		const { user: created } = await auth().api.createUser({ body: { email: 'dosen.tiga@uji.invalid', password: strongPassword, name: 'Dosen Tiga' } });
		const { cookie } = await signInViaHandler(auth(), 'dosen.tiga@uji.invalid', strongPassword);
		const response = await auth().handler(jsonRequest('/admin/set-role', { userId: created.id, role: 'super_admin' }, { cookie }));
		expect(response.status).toBeGreaterThanOrEqual(400);
		const [stored] = await ctx.db.select().from(user).where(eq(user.id, created.id));
		expect(stored.role).toBe('lecturer');
	});
});
