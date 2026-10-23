import { describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { getOwnProfile, updateOwnName } from '#lib/features/auth/profile.service.server.ts';
import type { SessionUser } from '#lib/features/auth/auth.types.ts';
import { assignLecturer } from '#lib/features/academic/index.server.ts';
import { auditLogs, lecturers, session, user } from '#lib/shared/db/schema.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { createLecturer, createOffering, createTerm, createUser } from '../../support/factories.ts';

const ctx = useIsolatedDatabase('auth_profile');

const actorOf = (account: { id: string; name: string; email: string; role: string | null }, role: 'lecturer' | 'super_admin'): SessionUser => ({
	id: account.id,
	name: account.name,
	email: account.email,
	role,
	mustChangePassword: false
});

async function openSession(userId: string, expiresInMs: number) {
	await ctx.db.insert(session).values({ id: `ses_${crypto.randomUUID()}`, token: crypto.randomUUID(), userId, expiresAt: new Date(Date.now() + expiresInMs), updatedAt: new Date() });
}

describe('getOwnProfile', () => {
	test('akun admin: identitas, tanpa data dosen, dan hanya sesi yang belum kedaluwarsa dihitung', async () => {
		const admin = await createUser(ctx.db, { role: 'super_admin', name: 'Admin Uji Profil' });
		await openSession(admin.id, 60_000);
		await openSession(admin.id, 120_000);
		await openSession(admin.id, -60_000);
		const profile = await getOwnProfile(ctx.db, actorOf(admin, 'super_admin'));
		expect(profile).toMatchObject({ name: 'Admin Uji Profil', email: admin.email, role: 'super_admin', mustChangePassword: false, activeSessions: 2, lecturer: null });
	});

	test('akun dosen: kode, NIDN, dan jumlah kelas aktif hanya dari semester aktif', async () => {
		const { account, lecturer } = await createLecturer(ctx.db);
		await ctx.db.update(lecturers).set({ nidn: 'NIDN-UJI-001' }).where(eq(lecturers.id, lecturer.id));
		const admin = await createUser(ctx.db, { role: 'super_admin' });
		const active = await createTerm(ctx.db, { status: 'active', startYear: 2041 });
		const planned = await createTerm(ctx.db, { status: 'planned', startYear: 2043 });
		const inActive = await createOffering(ctx.db, { semesterId: active.semester.id });
		const inPlanned = await createOffering(ctx.db, { semesterId: planned.semester.id });
		await assignLecturer(ctx.db, { id: admin.id, role: 'super_admin' }, { offeringId: inActive.id, lecturerId: lecturer.id, role: 'member' });
		await assignLecturer(ctx.db, { id: admin.id, role: 'super_admin' }, { offeringId: inPlanned.id, lecturerId: lecturer.id, role: 'member' });
		const profile = await getOwnProfile(ctx.db, actorOf(account, 'lecturer'));
		expect(profile?.lecturer).toEqual({ lecturerCode: lecturer.lecturerCode, nidn: 'NIDN-UJI-001', activeClasses: 1 });
	});

	test('pengguna yang sudah dihapus menghasilkan null', async () => {
		const profile = await getOwnProfile(ctx.db, { id: 'usr_tidak-ada', name: 'x', email: 'x@uji.invalid', role: 'lecturer', mustChangePassword: false });
		expect(profile).toBeNull();
	});
});

describe('updateOwnName', () => {
	test('menyimpan nama yang dirapikan dan mencatat audit sebelum dan sesudah', async () => {
		const account = await createUser(ctx.db, { name: 'Nama Lama' });
		const result = await updateOwnName(ctx.db, actorOf(account, 'lecturer'), { name: '  Nama   Baru  ' });
		expect(result).toEqual({ status: 'success', name: 'Nama Baru' });
		const [row] = await ctx.db.select({ name: user.name }).from(user).where(eq(user.id, account.id));
		expect(row.name).toBe('Nama Baru');
		const logs = await ctx.db.select().from(auditLogs).where(eq(auditLogs.entityId, account.id));
		const entry = logs.find((log) => log.action === 'auth.profile.update');
		expect(entry).toMatchObject({ actorId: account.id, entityType: 'user' });
		expect(JSON.stringify(entry)).toContain('Nama Lama');
		expect(JSON.stringify(entry)).toContain('Nama Baru');
	});

	test('nama yang sama tidak menulis ulang dan tidak mencatat audit', async () => {
		const account = await createUser(ctx.db, { name: 'Nama Tetap' });
		expect(await updateOwnName(ctx.db, actorOf(account, 'lecturer'), { name: 'Nama Tetap' })).toEqual({ status: 'success', name: 'Nama Tetap' });
		const logs = await ctx.db.select().from(auditLogs).where(eq(auditLogs.entityId, account.id));
		expect(logs.filter((log) => log.action === 'auth.profile.update')).toHaveLength(0);
	});

	test('input tidak valid ditolak per bidang tanpa mengubah data', async () => {
		const account = await createUser(ctx.db, { name: 'Tidak Berubah' });
		const result = await updateOwnName(ctx.db, actorOf(account, 'lecturer'), { name: ' ' });
		expect(result).toMatchObject({ status: 'invalid_input', fieldErrors: { name: ['Nama minimal 2 karakter'] } });
		const [row] = await ctx.db.select({ name: user.name }).from(user).where(eq(user.id, account.id));
		expect(row.name).toBe('Tidak Berubah');
	});

	test('hanya mengubah akun pemanggil, bukan akun lain', async () => {
		const mine = await createUser(ctx.db, { name: 'Milik Saya' });
		const other = await createUser(ctx.db, { name: 'Milik Orang Lain' });
		await updateOwnName(ctx.db, actorOf(mine, 'lecturer'), { name: 'Saya Ubah' });
		const [row] = await ctx.db.select({ name: user.name }).from(user).where(eq(user.id, other.id));
		expect(row.name).toBe('Milik Orang Lain');
	});
});
