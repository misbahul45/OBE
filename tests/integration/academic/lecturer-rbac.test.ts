import { describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { accessibleOfferingIds, assertOfferingAccess, assignLecturer, canAccessOffering, createOffering, listOfferings, removeAssignment } from '#lib/features/academic/index.server.ts';
import { lecturerAssignments } from '#lib/shared/db/schema.ts';
import { NotFoundError } from '#lib/shared/http/errors.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { createCourse, createLecturer, createTerm, createUser } from '../../support/factories.ts';

const ctx = useIsolatedDatabase('academic_rbac');

async function scene() {
	const admin = await createUser(ctx.db, { role: 'super_admin' });
	const adminActor = { id: admin.id, role: 'super_admin' };
	const { semester } = await createTerm(ctx.db);
	const offeringA = await createOffering(ctx.db, adminActor, { courseId: (await createCourse(ctx.db)).id, semesterId: semester.id });
	const offeringB = await createOffering(ctx.db, adminActor, { courseId: (await createCourse(ctx.db)).id, semesterId: semester.id });
	const a = await createLecturer(ctx.db);
	const b = await createLecturer(ctx.db);
	await assignLecturer(ctx.db, adminActor, { offeringId: offeringA.id, lecturerId: a.lecturer.id });
	await assignLecturer(ctx.db, adminActor, { offeringId: offeringB.id, lecturerId: b.lecturer.id });
	return { adminActor, offeringA, offeringB, lecturerA: { id: a.account.id, role: 'lecturer' }, lecturerB: { id: b.account.id, role: 'lecturer' } };
}

describe('akses offering berbasis penugasan', () => {
	test('dosen hanya mengakses offering miliknya; Super Admin mengakses semuanya', async () => {
		const s = await scene();
		expect(await canAccessOffering(ctx.db, s.lecturerA, s.offeringA.id)).toBe(true);
		expect(await canAccessOffering(ctx.db, s.lecturerA, s.offeringB.id)).toBe(false);
		expect(await canAccessOffering(ctx.db, s.lecturerB, s.offeringA.id)).toBe(false);
		expect(await canAccessOffering(ctx.db, s.adminActor, s.offeringA.id)).toBe(true);
		expect(await canAccessOffering(ctx.db, s.adminActor, s.offeringB.id)).toBe(true);
	});

	test('peran tidak dikenal atau dosen tanpa profil ditolak (default-deny)', async () => {
		const s = await scene();
		const orphan = await createUser(ctx.db, { role: 'lecturer' });
		expect(await canAccessOffering(ctx.db, { id: orphan.id, role: 'lecturer' }, s.offeringA.id)).toBe(false);
		expect(await canAccessOffering(ctx.db, { id: s.lecturerA.id, role: 'student' }, s.offeringA.id)).toBe(false);
		expect(await canAccessOffering(ctx.db, { id: s.lecturerA.id, role: '' }, s.offeringA.id)).toBe(false);
	});

	test('offering milik orang lain dan offering yang tidak ada menghasilkan galat yang sama (tanpa membocorkan keberadaan)', async () => {
		const s = await scene();
		const forbidden = await assertOfferingAccess(ctx.db, s.lecturerA, s.offeringB.id).catch((e) => e);
		const missing = await assertOfferingAccess(ctx.db, s.lecturerA, '3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b').catch((e) => e);
		expect(forbidden).toBeInstanceOf(NotFoundError);
		expect(missing).toBeInstanceOf(NotFoundError);
		expect(forbidden.message).toBe(missing.message);
		await expect(assertOfferingAccess(ctx.db, s.lecturerA, s.offeringA.id)).resolves.toBeUndefined();
	});

	test('daftar offering yang diakses dan pembatasan kueri mengabaikan ID offering yang dimanipulasi', async () => {
		const s = await scene();
		expect(await accessibleOfferingIds(ctx.db, s.adminActor)).toBe('all');
		expect(await accessibleOfferingIds(ctx.db, s.lecturerA)).toEqual([s.offeringA.id]);
		expect(await accessibleOfferingIds(ctx.db, { id: 'tidak-ada', role: 'lecturer' })).toEqual([]);
		const scoped = await listOfferings(ctx.db, { accessible: await accessibleOfferingIds(ctx.db, s.lecturerA) });
		expect(scoped.rows.map((r) => r.id)).toEqual([s.offeringA.id]);
		const tampered = await listOfferings(ctx.db, { accessible: [s.offeringA.id], search: '' });
		expect(tampered.rows.some((r) => r.id === s.offeringB.id)).toBe(false);
		expect((await listOfferings(ctx.db, { accessible: [] })).rows).toEqual([]);
	});

	test('pencabutan penugasan langsung menghilangkan akses hanya untuk dosen yang dicabut', async () => {
		const s = await scene();
		const [row] = await ctx.db.select().from(lecturerAssignments).where(eq(lecturerAssignments.offeringId, s.offeringA.id));
		await removeAssignment(ctx.db, s.adminActor, row.id);
		expect(await canAccessOffering(ctx.db, s.lecturerA, s.offeringA.id)).toBe(false);
		expect(await canAccessOffering(ctx.db, s.lecturerB, s.offeringB.id)).toBe(true);
	});
});
