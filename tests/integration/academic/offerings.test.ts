import { describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { assignLecturer, createOffering, getOffering, listOfferings, removeAssignment } from '#lib/features/academic/index.server.ts';
import { auditLogs, lecturerAssignments } from '#lib/shared/db/schema.ts';
import { NotFoundError, ValidationError } from '#lib/shared/http/errors.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { createCourse, createEnrollment, createLecturer, createTerm, createUser } from '../../support/factories.ts';

const ctx = useIsolatedDatabase('academic_offerings');

async function actor() {
	const user = await createUser(ctx.db, { role: 'super_admin' });
	return { id: user.id, role: 'super_admin' };
}

describe('penawaran kelas', () => {
	test('kelas bawaan A, huruf kecil dinormalisasi, kelas paralel diperbolehkan, duplikat ditolak', async () => {
		const admin = await actor();
		const course = await createCourse(ctx.db);
		const { semester } = await createTerm(ctx.db);
		const a = await createOffering(ctx.db, admin, { courseId: course.id, semesterId: semester.id, section: '' });
		const b = await createOffering(ctx.db, admin, { courseId: course.id, semesterId: semester.id, section: 'b' });
		expect([a.section, b.section]).toEqual(['A', 'B']);
		await expect(createOffering(ctx.db, admin, { courseId: course.id, semesterId: semester.id, section: 'A' })).rejects.toMatchObject({
			fieldErrors: { section: ['Kelas ini sudah ada untuk mata kuliah dan semester tersebut'] }
		});
	});

	test('mata kuliah atau semester yang tidak ada ditolak', async () => {
		const admin = await actor();
		const { semester } = await createTerm(ctx.db);
		await expect(createOffering(ctx.db, admin, { courseId: '3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b', semesterId: semester.id })).rejects.toBeInstanceOf(ValidationError);
	});
});

describe('penugasan dosen', () => {
	test('menugaskan, menolak duplikat, mencabut, dan seluruhnya diaudit', async () => {
		const admin = await actor();
		const { semester } = await createTerm(ctx.db);
		const offering = await createOffering(ctx.db, admin, { courseId: (await createCourse(ctx.db)).id, semesterId: semester.id });
		const { lecturer } = await createLecturer(ctx.db);
		const assignment = await assignLecturer(ctx.db, admin, { offeringId: offering.id, lecturerId: lecturer.id, role: 'coordinator' });
		expect(assignment.role).toBe('coordinator');
		await expect(assignLecturer(ctx.db, admin, { offeringId: offering.id, lecturerId: lecturer.id })).rejects.toMatchObject({ fieldErrors: { lecturerId: ['Dosen sudah ditugaskan pada kelas ini'] } });
		await removeAssignment(ctx.db, admin, assignment.id);
		expect((await ctx.db.select().from(lecturerAssignments).where(eq(lecturerAssignments.offeringId, offering.id))).length).toBe(0);
		await expect(removeAssignment(ctx.db, admin, assignment.id)).rejects.toBeInstanceOf(NotFoundError);
		const trail = await ctx.db.select().from(auditLogs).where(eq(auditLogs.entityId, assignment.id));
		expect(trail.map((l) => l.action).sort()).toEqual(['lecturer_assignment.create', 'lecturer_assignment.delete']);
	});

	test('dosen atau offering fiktif ditolak', async () => {
		const admin = await actor();
		const { semester } = await createTerm(ctx.db);
		const offering = await createOffering(ctx.db, admin, { courseId: (await createCourse(ctx.db)).id, semesterId: semester.id });
		await expect(assignLecturer(ctx.db, admin, { offeringId: offering.id, lecturerId: '3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b' })).rejects.toBeInstanceOf(ValidationError);
	});
});

describe('daftar offering', () => {
	test('memuat mata kuliah, semester, dosen, dan jumlah mahasiswa serta mendukung filter dan paginasi', async () => {
		const admin = await actor();
		const { semester } = await createTerm(ctx.db);
		const other = await createTerm(ctx.db);
		const c1 = await createCourse(ctx.db, { code: 'ZZA1', name: 'Zeta Satu' });
		const c2 = await createCourse(ctx.db, { code: 'ZZB1', name: 'Zeta Dua' });
		const o1 = await createOffering(ctx.db, admin, { courseId: c1.id, semesterId: semester.id });
		const o2 = await createOffering(ctx.db, admin, { courseId: c2.id, semesterId: semester.id });
		await createOffering(ctx.db, admin, { courseId: c1.id, semesterId: other.semester.id });
		const { lecturer, account } = await createLecturer(ctx.db);
		await assignLecturer(ctx.db, admin, { offeringId: o1.id, lecturerId: lecturer.id });
		await createEnrollment(ctx.db, { offeringId: o1.id });
		await createEnrollment(ctx.db, { offeringId: o1.id });

		const list = await listOfferings(ctx.db, { semesterId: semester.id });
		expect(list.total).toBe(2);
		const first = list.rows.find((r) => r.id === o1.id)!;
		expect(first).toMatchObject({ courseCode: 'ZZA1', enrollmentCount: 2, semesterName: semester.name });
		expect(first.lecturers.map((l) => l.name)).toEqual([account.name]);
		expect(list.rows.find((r) => r.id === o2.id)!.lecturers).toEqual([]);
		expect((await listOfferings(ctx.db, { search: 'zeta dua' })).rows.map((r) => r.id)).toEqual([o2.id]);
		expect((await listOfferings(ctx.db, { semesterId: semester.id, pageSize: 1, page: 2 })).rows).toHaveLength(1);
		expect((await getOffering(ctx.db, o1.id))?.id).toBe(o1.id);
		expect(await getOffering(ctx.db, '3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b')).toBeNull();
	});
});
