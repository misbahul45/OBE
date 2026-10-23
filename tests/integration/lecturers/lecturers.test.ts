import { describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { attemptLogin } from '#lib/features/auth/login.service.server.ts';
import { isStrongPassword } from '#lib/features/auth/index.ts';
import { createLecturerAccount, deactivateLecturer, listLecturers, reactivateLecturer, resetLecturerPassword, updateLecturer } from '#lib/features/lecturers/index.server.ts';
import { assignLecturer, createOffering } from '#lib/features/academic/index.server.ts';
import { account, auditLogs, lecturers, session, user } from '#lib/shared/db/schema.ts';
import { NotFoundError, ValidationError } from '#lib/shared/http/errors.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { buildAuth, signInViaHandler } from '../../support/auth.ts';
import { createCourse, createTerm, createUser } from '../../support/factories.ts';

const ctx = useIsolatedDatabase('lecturers_service');
const auth = () => buildAuth(ctx.db);
const deps = () => ({ auth: auth(), db: ctx.db });
const login = (email: string, password: string) => attemptLogin(deps(), { email, password }, { headers: new Headers(), ip: null, rateLimit: false });

async function admin() {
	const created = await createUser(ctx.db, { role: 'super_admin' });
	return { id: created.id, role: 'super_admin' };
}

const input = (n: number, extra: Record<string, unknown> = {}) => ({ name: `Dosen Uji ${n}`, email: `dosen${n}@kampus.invalid`, lecturerCode: `DSN${n}`, nidn: `0012345${String(n).padStart(3, '0')}`, ...extra });

describe('pembuatan akun dosen', () => {
	test('membuat user berperan dosen, profil, password sementara kuat yang bisa dipakai login dan wajib diganti', async () => {
		const actor = await admin();
		const created = await createLecturerAccount(deps(), actor, input(1));
		expect(isStrongPassword(created.temporaryPassword)).toBe(true);
		const [stored] = await ctx.db.select().from(user).where(eq(user.id, created.userId));
		expect(stored).toMatchObject({ role: 'lecturer', mustChangePassword: true, email: 'dosen1@kampus.invalid' });
		const [profile] = await ctx.db.select().from(lecturers).where(eq(lecturers.id, created.lecturerId));
		expect(profile).toMatchObject({ userId: created.userId, lecturerCode: 'DSN1', nidn: '0012345001' });
		expect(await login('dosen1@kampus.invalid', created.temporaryPassword)).toMatchObject({ status: 'success', role: 'lecturer', mustChangePassword: true });
	});

	test('password sementara hanya dikembalikan sekali: tidak ada di audit, basis data, maupun daftar', async () => {
		const actor = await admin();
		const created = await createLecturerAccount(deps(), actor, input(2));
		const [credential] = await ctx.db.select().from(account).where(eq(account.userId, created.userId));
		expect(credential.password).not.toContain(created.temporaryPassword);
		const logs = await ctx.db.select().from(auditLogs);
		expect(JSON.stringify(logs)).not.toContain(created.temporaryPassword);
		expect(JSON.stringify(await listLecturers(ctx.db))).not.toContain(created.temporaryPassword);
		expect(logs.some((l) => l.action === 'lecturer.create' && l.entityId === created.lecturerId)).toBe(true);
	});

	test('peran dari input formulir diabaikan sehingga tidak ada eskalasi hak', async () => {
		const actor = await admin();
		const created = await createLecturerAccount(deps(), actor, input(3, { role: 'super_admin', banned: false }));
		const [stored] = await ctx.db.select().from(user).where(eq(user.id, created.userId));
		expect(stored.role).toBe('lecturer');
	});

	test('email, kode dosen, dan NIDN duplikat ditolak tanpa membuat akun setengah jadi', async () => {
		const actor = await admin();
		await createLecturerAccount(deps(), actor, input(4));
		const before = (await ctx.db.select().from(user)).length;
		await expect(createLecturerAccount(deps(), actor, input(5, { email: 'DOSEN4@kampus.invalid' }))).rejects.toMatchObject({ fieldErrors: { email: ['Email sudah terdaftar'] } });
		await expect(createLecturerAccount(deps(), actor, input(5, { lecturerCode: 'dsn4' }))).rejects.toMatchObject({ fieldErrors: { lecturerCode: ['Kode dosen sudah dipakai'] } });
		await expect(createLecturerAccount(deps(), actor, input(5, { nidn: '0012345004' }))).rejects.toMatchObject({ fieldErrors: { nidn: ['NIDN sudah terdaftar'] } });
		expect((await ctx.db.select().from(user)).length).toBe(before);
	});

	test('input tidak valid ditolak', async () => {
		const actor = await admin();
		await expect(createLecturerAccount(deps(), actor, { name: 'x', email: 'bukan-email' })).rejects.toBeInstanceOf(ValidationError);
	});
});

describe('menonaktifkan dan mengaktifkan kembali', () => {
	test('penonaktifan mencabut seluruh sesi dan memblokir login; pengaktifan kembali memulihkan akses', async () => {
		const actor = await admin();
		const created = await createLecturerAccount(deps(), actor, input(10));
		const signedIn = await signInViaHandler(auth(), 'dosen10@kampus.invalid', created.temporaryPassword);
		expect(signedIn.cookie).toContain('session_token');
		expect((await ctx.db.select().from(session).where(eq(session.userId, created.userId))).length).toBeGreaterThan(0);

		await deactivateLecturer(deps(), actor, created.lecturerId);
		expect((await ctx.db.select().from(session).where(eq(session.userId, created.userId))).length).toBe(0);
		expect(await login('dosen10@kampus.invalid', created.temporaryPassword)).toMatchObject({ status: 'disabled' });
		expect((await listLecturers(ctx.db, { status: 'inactive', search: 'dosen10' })).rows).toHaveLength(1);

		await reactivateLecturer(deps(), actor, created.lecturerId);
		expect(await login('dosen10@kampus.invalid', created.temporaryPassword)).toMatchObject({ status: 'success' });
		const actions = (await ctx.db.select().from(auditLogs).where(eq(auditLogs.entityId, created.lecturerId))).map((l) => l.action);
		expect(actions).toEqual(expect.arrayContaining(['lecturer.deactivate', 'lecturer.reactivate']));
	});

	test('tidak dapat menonaktifkan akun sendiri dan ID tidak dikenal ditolak', async () => {
		const actor = await admin();
		const own = await createLecturerAccount(deps(), actor, input(11));
		await expect(deactivateLecturer(deps(), { id: own.userId, role: 'lecturer' }, own.lecturerId)).rejects.toBeInstanceOf(ValidationError);
		await expect(deactivateLecturer(deps(), actor, '3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b')).rejects.toBeInstanceOf(NotFoundError);
	});
});

describe('reset password dan pembaruan data', () => {
	test('reset menerbitkan password sementara baru, mencabut sesi, dan mewajibkan penggantian', async () => {
		const actor = await admin();
		const created = await createLecturerAccount(deps(), actor, input(20));
		await signInViaHandler(auth(), 'dosen20@kampus.invalid', created.temporaryPassword);
		const reset = await resetLecturerPassword(deps(), actor, created.lecturerId);
		expect(reset.temporaryPassword).not.toBe(created.temporaryPassword);
		expect(await login('dosen20@kampus.invalid', created.temporaryPassword)).toEqual({ status: 'invalid_credentials' });
		expect(await login('dosen20@kampus.invalid', reset.temporaryPassword)).toMatchObject({ status: 'success', mustChangePassword: true });
		expect(JSON.stringify(await ctx.db.select().from(auditLogs))).not.toContain(reset.temporaryPassword);
	});

	test('pembaruan mengubah nama dan kode, menolak kode milik dosen lain, dan menolak ID tak dikenal', async () => {
		const actor = await admin();
		const a = await createLecturerAccount(deps(), actor, input(30));
		await createLecturerAccount(deps(), actor, input(31));
		await updateLecturer(ctx.db, actor, a.lecturerId, { name: 'Nama Baru Dosen', lecturerCode: 'baru30', nidn: '' });
		const [row] = await ctx.db.select({ name: user.name, code: lecturers.lecturerCode, nidn: lecturers.nidn }).from(lecturers).innerJoin(user, eq(user.id, lecturers.userId)).where(eq(lecturers.id, a.lecturerId));
		expect(row).toEqual({ name: 'Nama Baru Dosen', code: 'BARU30', nidn: null });
		await expect(updateLecturer(ctx.db, actor, a.lecturerId, { name: 'Nama Baru Dosen', lecturerCode: 'DSN31' })).rejects.toBeInstanceOf(ValidationError);
		await expect(updateLecturer(ctx.db, actor, '3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b', { name: 'Nama Baru Dosen' })).rejects.toBeInstanceOf(NotFoundError);
	});
});

describe('daftar dosen', () => {
	test('pencarian, filter status, paginasi, dan jumlah penugasan dihitung di server', async () => {
		const actor = await admin();
		const created = await createLecturerAccount(deps(), actor, input(40, { name: 'Cari Aku Dosen' }));
		const { semester } = await createTerm(ctx.db);
		const offering = await createOffering(ctx.db, actor, { courseId: (await createCourse(ctx.db)).id, semesterId: semester.id });
		await assignLecturer(ctx.db, actor, { offeringId: offering.id, lecturerId: created.lecturerId });
		const found = await listLecturers(ctx.db, { search: 'cari aku' });
		expect(found.rows).toMatchObject([{ id: created.lecturerId, assignmentCount: 1, banned: false, mustChangePassword: true }]);
		expect((await listLecturers(ctx.db, { pageSize: 2 })).rows.length).toBeLessThanOrEqual(2);
		expect((await listLecturers(ctx.db, { search: '%' })).total).toBe(0);
	});
});

describe('pembuatan akun dosen dengan kata sandi yang ditentukan', () => {
	test('kata sandi lemah ditolak sebelum akun dibuat', async () => {
		const actor = await admin();
		const failure = await createLecturerAccount(deps(), actor, input(901), { password: 'biomedi_unair_132!' }).catch((error) => error);
		expect(failure).toBeInstanceOf(ValidationError);
		expect(failure.fieldErrors.password).toContain('Harus memuat huruf besar');
		expect(await ctx.db.select().from(user).where(eq(user.email, 'dosen901@kampus.invalid'))).toHaveLength(0);
	});

	test('kata sandi kuat dipakai apa adanya, tetap wajib diganti saat masuk pertama, dan boleh sama antar dosen', async () => {
		const actor = await admin();
		const shared = 'Biomedi_unair_132!';
		const first = await createLecturerAccount(deps(), actor, input(902), { password: shared });
		const second = await createLecturerAccount(deps(), actor, input(903), { password: shared });
		expect(first.temporaryPassword).toBe(shared);
		expect(await login('dosen902@kampus.invalid', shared)).toMatchObject({ status: 'success', role: 'lecturer', mustChangePassword: true });
		expect(await login('dosen903@kampus.invalid', shared)).toMatchObject({ status: 'success', role: 'lecturer', mustChangePassword: true });
		expect(second.userId).not.toBe(first.userId);
	});
});
