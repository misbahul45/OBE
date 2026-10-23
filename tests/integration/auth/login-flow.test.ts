import { describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { attemptLogin } from '#lib/features/auth/login.service.server.ts';
import { changeOwnPassword } from '#lib/features/auth/password.service.server.ts';
import type { SessionUser } from '#lib/features/auth/auth.types.ts';
import { auditLogs, user } from '#lib/shared/db/schema.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { buildAuth, signInViaHandler, strongPassword } from '../../support/auth.ts';

const ctx = useIsolatedDatabase('auth_login');
const auth = () => buildAuth(ctx.db);
const noHeaders = () => new Headers();
const login = (input: unknown, ip: string | null = null, rateLimit: false | { perIp: { windowSeconds: number; max: number }; perEmail: { windowSeconds: number; max: number } } = false) =>
	attemptLogin({ auth: auth(), db: ctx.db }, input, { headers: noHeaders(), ip, rateLimit });

async function account(email: string, role: 'lecturer' | 'super_admin', mustChangePassword = false) {
	const { user: created } = await auth().api.createUser({ body: { email, password: strongPassword, name: `Uji ${email}`, role, data: { mustChangePassword } } });
	return created.id;
}

describe('attemptLogin', () => {
	test('berhasil untuk kedua peran dan email dinormalisasi', async () => {
		await account('kaprodi@uji.invalid', 'super_admin');
		await account('dosen@uji.invalid', 'lecturer');
		expect(await login({ email: '  Kaprodi@Uji.Invalid ', password: strongPassword })).toEqual({ status: 'success', role: 'super_admin', mustChangePassword: false });
		expect(await login({ email: 'dosen@uji.invalid', password: strongPassword })).toMatchObject({ status: 'success', role: 'lecturer' });
	});

	test('akun dengan password sementara ditandai wajib ganti password', async () => {
		await account('sementara@uji.invalid', 'lecturer', true);
		expect(await login({ email: 'sementara@uji.invalid', password: strongPassword })).toMatchObject({ status: 'success', mustChangePassword: true });
	});

	test('input kosong atau email tidak valid menghasilkan pesan per bidang', async () => {
		const empty = await login({ email: '', password: '' });
		expect(empty).toMatchObject({ status: 'invalid_input', fieldErrors: { email: ['Email wajib diisi'], password: ['Password wajib diisi'] } });
		const badEmail = await login({ email: 'bukan-email', password: 'x' });
		expect(badEmail).toMatchObject({ status: 'invalid_input', fieldErrors: { email: ['Format email tidak valid'] } });
		expect(await login(null)).toMatchObject({ status: 'invalid_input' });
	});

	test('password salah dan email tidak dikenal menghasilkan hasil identik (tanpa enumerasi akun)', async () => {
		await account('ada@uji.invalid', 'lecturer');
		const wrongPassword = await login({ email: 'ada@uji.invalid', password: 'Salah#Password99' });
		const unknownEmail = await login({ email: 'tidak-ada@uji.invalid', password: strongPassword });
		expect(wrongPassword).toEqual({ status: 'invalid_credentials' });
		expect(unknownEmail).toEqual(wrongPassword);
	});

	test('akun dinonaktifkan menampilkan pesan khusus setelah kredensial benar', async () => {
		const id = await account('nonaktif@uji.invalid', 'lecturer');
		await ctx.db.update(user).set({ banned: true }).where(eq(user.id, id));
		expect(await login({ email: 'nonaktif@uji.invalid', password: strongPassword })).toMatchObject({ status: 'disabled', message: expect.stringContaining('dinonaktifkan') });
		expect(await login({ email: 'nonaktif@uji.invalid', password: 'Salah#Password99' })).toEqual({ status: 'invalid_credentials' });
	});

	test('percobaan berulang dibatasi per email lewat jalur server action (bukan hanya lapisan HTTP)', async () => {
		const config = { perIp: { windowSeconds: 60, max: 50 }, perEmail: { windowSeconds: 60, max: 3 } };
		const results: string[] = [];
		for (let i = 0; i < 5; i++) results.push((await login({ email: 'ada@uji.invalid', password: 'Salah#Password99' }, '198.51.100.23', config)).status);
		expect(results).toEqual(['invalid_credentials', 'invalid_credentials', 'invalid_credentials', 'rate_limited', 'rate_limited']);
		const correctButLimited = await login({ email: 'ada@uji.invalid', password: strongPassword }, '198.51.100.23', config);
		expect(correctButLimited.status).toBe('rate_limited');
	});

	test('pembatasan per IP melindungi dari penyemprotan banyak email, dan IP/email lain tidak ikut terblokir', async () => {
		const config = { perIp: { windowSeconds: 60, max: 2 }, perEmail: { windowSeconds: 60, max: 50 } };
		const statuses: string[] = [];
		for (const email of ['a1@uji.invalid', 'a2@uji.invalid', 'a3@uji.invalid']) statuses.push((await login({ email, password: 'Salah#Password99' }, '203.0.113.50', config)).status);
		expect(statuses).toEqual(['invalid_credentials', 'invalid_credentials', 'rate_limited']);
		expect((await login({ email: 'dosen@uji.invalid', password: strongPassword }, '203.0.113.51', config)).status).toBe('success');
	});

	test('jendela waktu berakhir lalu hitungan mulai dari awal', async () => {
		const { consumeRateLimit } = await import('#lib/features/auth/login-rate-limit.server.ts');
		const window = { windowSeconds: 10, max: 2 };
		const t0 = 1_000_000_000_000;
		expect((await consumeRateLimit(ctx.db, 'uji:jendela', window, t0)).allowed).toBe(true);
		expect((await consumeRateLimit(ctx.db, 'uji:jendela', window, t0 + 1000)).allowed).toBe(true);
		const blocked = await consumeRateLimit(ctx.db, 'uji:jendela', window, t0 + 2000);
		expect(blocked).toMatchObject({ allowed: false, count: 3 });
		expect(blocked.retryAfterSeconds).toBe(8);
		expect(await consumeRateLimit(ctx.db, 'uji:jendela', window, t0 + 11_000)).toMatchObject({ allowed: true, count: 1 });
	});
});

describe('changeOwnPassword', () => {
	async function sessionFor(email: string, mustChangePassword = true) {
		const id = await account(email, 'lecturer', mustChangePassword);
		const { cookie } = await signInViaHandler(auth(), email, strongPassword);
		const actor: SessionUser = { id, name: 'Uji', email, role: 'lecturer', mustChangePassword };
		return { id, actor, headers: new Headers({ cookie, origin: 'http://127.0.0.1:4173' }) };
	}
	const deps = () => ({ auth: auth(), db: ctx.db });
	const valid = { currentPassword: strongPassword, newPassword: 'Baru#Password2026', confirmPassword: 'Baru#Password2026' };

	test('berhasil: password baru berlaku, lama tidak, bendera wajib-ganti dibersihkan, audit tanpa password', async () => {
		const { id, actor, headers } = await sessionFor('ganti@uji.invalid');
		expect(await changeOwnPassword(deps(), actor, valid, headers)).toEqual({ status: 'success' });
		const [stored] = await ctx.db.select().from(user).where(eq(user.id, id));
		expect(stored.mustChangePassword).toBe(false);
		expect(await login({ email: 'ganti@uji.invalid', password: 'Baru#Password2026' })).toMatchObject({ status: 'success', mustChangePassword: false });
		expect(await login({ email: 'ganti@uji.invalid', password: strongPassword })).toEqual({ status: 'invalid_credentials' });
		const logs = await ctx.db.select().from(auditLogs).where(eq(auditLogs.entityId, id));
		expect(logs.map((l) => l.action)).toContain('auth.password.change');
		expect(JSON.stringify(logs)).not.toContain('Baru#Password2026');
	});

	test('password saat ini salah ditolak', async () => {
		const { actor, headers } = await sessionFor('salah@uji.invalid');
		expect(await changeOwnPassword(deps(), actor, { ...valid, currentPassword: 'Bukan#Password99' }, headers)).toEqual({ status: 'wrong_current' });
	});

	test('password baru lemah, tidak cocok, atau sama dengan lama ditolak dengan pesan per bidang', async () => {
		const { actor, headers } = await sessionFor('lemah@uji.invalid');
		const weak = await changeOwnPassword(deps(), actor, { ...valid, newPassword: 'pendek', confirmPassword: 'pendek' }, headers);
		expect(weak).toMatchObject({ status: 'invalid_input' });
		expect((weak as { fieldErrors: Record<string, string[]> }).fieldErrors.newPassword).toContain('Minimal 10 karakter');
		const mismatch = await changeOwnPassword(deps(), actor, { ...valid, confirmPassword: 'Beda#Password2026' }, headers);
		expect((mismatch as { fieldErrors: Record<string, string[]> }).fieldErrors.confirmPassword).toEqual(['Konfirmasi tidak sama dengan password baru']);
		const same = await changeOwnPassword(deps(), actor, { currentPassword: strongPassword, newPassword: strongPassword, confirmPassword: strongPassword }, headers);
		expect((same as { fieldErrors: Record<string, string[]> }).fieldErrors.newPassword).toEqual(['Password baru harus berbeda dari password saat ini']);
	});

	test('tanpa sesi yang sah perubahan password ditolak', async () => {
		const { actor } = await sessionFor('tanpasesi@uji.invalid');
		expect(await changeOwnPassword(deps(), actor, valid, new Headers({ origin: 'http://127.0.0.1:4173' }))).toMatchObject({ status: expect.stringMatching(/wrong_current|error/) });
		expect(await login({ email: 'tanpasesi@uji.invalid', password: strongPassword })).toMatchObject({ status: 'success' });
	});
});
