import { describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { enrollments, students } from '#lib/shared/db/schema.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { createEnrollment, createOffering, createStudent } from '../../support/factories.ts';
import { expectDatabaseRejection, pgCodes } from '../../support/postgres-error.ts';

const ctx = useIsolatedDatabase('enrollments_schema');

describe('enrollments', () => {
	test('satu mahasiswa tidak terdaftar ganda pada offering yang sama', async () => {
		const student = await createStudent(ctx.db);
		const offering = await createOffering(ctx.db);
		await createEnrollment(ctx.db, { studentId: student.id, offeringId: offering.id });
		const failure = await expectDatabaseRejection(() => createEnrollment(ctx.db, { studentId: student.id, offeringId: offering.id }));
		expect(failure.code).toBe(pgCodes.uniqueViolation);
	});

	test('mahasiswa yang sama boleh mengambil mata kuliah di offering dan semester berbeda', async () => {
		const student = await createStudent(ctx.db);
		const first = await createOffering(ctx.db);
		const second = await createOffering(ctx.db, { courseId: first.courseId });
		await createEnrollment(ctx.db, { studentId: student.id, offeringId: first.id });
		await createEnrollment(ctx.db, { studentId: student.id, offeringId: second.id });
		const rows = await ctx.db.select().from(enrollments).where(eq(enrollments.studentId, student.id));
		expect(rows.length).toBe(2);
	});

	test('mahasiswa yang sudah punya enrollment tidak dapat dihapus', async () => {
		const enrollment = await createEnrollment(ctx.db);
		const failure = await expectDatabaseRejection(() => ctx.db.delete(students).where(eq(students.id, enrollment.studentId)));
		expect(failure.code).toBe(pgCodes.foreignKeyViolation);
	});

	test('enrollment ke offering yang tidak ada ditolak', async () => {
		const student = await createStudent(ctx.db);
		const failure = await expectDatabaseRejection(() =>
			ctx.db.insert(enrollments).values({ studentId: student.id, offeringId: '00000000-0000-4000-8000-000000000000' })
		);
		expect(failure.code).toBe(pgCodes.foreignKeyViolation);
	});
});
