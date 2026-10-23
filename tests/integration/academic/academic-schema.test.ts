import { describe, expect, test } from 'bun:test';
import { academicYears, courseOfferings, lecturerAssignments, semesters } from '#lib/shared/db/schema.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { createCourse, createLecturer, createOffering, createTerm } from '../../support/factories.ts';
import { expectDatabaseRejection, pgCodes } from '../../support/postgres-error.ts';

const ctx = useIsolatedDatabase('academic_schema');

describe('courses', () => {
	test('kode mata kuliah unik dan ternormalisasi huruf besar', async () => {
		await createCourse(ctx.db, { code: 'BME101' });
		const duplicate = await expectDatabaseRejection(() => createCourse(ctx.db, { code: 'BME101' }));
		expect(duplicate.code).toBe(pgCodes.uniqueViolation);
		const lower = await expectDatabaseRejection(() => createCourse(ctx.db, { code: 'bme102' }));
		expect(lower.constraint).toBe('courses_code_normalized');
	});

	test('SKS di luar 1 sampai 12 ditolak', async () => {
		for (const credits of [0, 13, -1]) {
			const failure = await expectDatabaseRejection(() => createCourse(ctx.db, { credits }));
			expect(failure.constraint).toBe('courses_credits_range');
		}
	});
});

describe('tahun akademik dan semester', () => {
	test('hanya satu tahun akademik aktif', async () => {
		await ctx.db.insert(academicYears).values({ code: '2031/2032', startYear: 2031, isActive: true });
		const failure = await expectDatabaseRejection(() => ctx.db.insert(academicYears).values({ code: '2032/2033', startYear: 2032, isActive: true }));
		expect(failure.constraint).toBe('academic_years_single_active');
	});

	test('hanya satu semester aktif, tetapi banyak semester non-aktif boleh', async () => {
		await createTerm(ctx.db, { status: 'active' });
		await createTerm(ctx.db, { status: 'closed' });
		await createTerm(ctx.db, { status: 'closed' });
		const failure = await expectDatabaseRejection(() => createTerm(ctx.db, { status: 'active' }));
		expect(failure.constraint).toBe('semesters_single_active');
	});

	test('tanggal akhir tidak boleh sebelum tanggal mulai', async () => {
		const { year } = await createTerm(ctx.db);
		const failure = await expectDatabaseRejection(() =>
			ctx.db.insert(semesters).values({ academicYearId: year.id, term: 'genap', name: 'Terbalik', startDate: '2040-02-01', endDate: '2040-01-01' })
		);
		expect(failure.constraint).toBe('semesters_date_order');
	});

	test('satu tahun hanya punya satu semester per jenis', async () => {
		const { year } = await createTerm(ctx.db, { term: 'ganjil' });
		const failure = await expectDatabaseRejection(() =>
			ctx.db.insert(semesters).values({ academicYearId: year.id, term: 'ganjil', name: 'Dobel', startDate: '2040-08-01', endDate: '2041-01-31' })
		);
		expect(failure.code).toBe(pgCodes.uniqueViolation);
	});
});

describe('offering dan penugasan', () => {
	test('kombinasi mata kuliah, semester, dan kelas unik; kelas paralel boleh', async () => {
		const offering = await createOffering(ctx.db, { section: 'A' });
		await ctx.db.insert(courseOfferings).values({ courseId: offering.courseId, semesterId: offering.semesterId, section: 'B' });
		const failure = await expectDatabaseRejection(() =>
			ctx.db.insert(courseOfferings).values({ courseId: offering.courseId, semesterId: offering.semesterId, section: 'A' })
		);
		expect(failure.code).toBe(pgCodes.uniqueViolation);
	});

	test('kode kelas harus huruf besar', async () => {
		const offering = await createOffering(ctx.db);
		const failure = await expectDatabaseRejection(() =>
			ctx.db.insert(courseOfferings).values({ courseId: offering.courseId, semesterId: offering.semesterId, section: 't1' })
		);
		expect(failure.constraint).toBe('course_offerings_section_normalized');
	});

	test('dosen tidak dapat ditugaskan dua kali pada offering yang sama', async () => {
		const offering = await createOffering(ctx.db);
		const { lecturer } = await createLecturer(ctx.db);
		await ctx.db.insert(lecturerAssignments).values({ offeringId: offering.id, lecturerId: lecturer.id });
		const failure = await expectDatabaseRejection(() => ctx.db.insert(lecturerAssignments).values({ offeringId: offering.id, lecturerId: lecturer.id }));
		expect(failure.code).toBe(pgCodes.uniqueViolation);
	});
});
