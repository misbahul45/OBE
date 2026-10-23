import { describe, expect, test } from 'bun:test';
import { assertCanViewStudent, canViewStudent, listCohortYears, listStudents, setStudentCohort } from '#lib/features/students/index.server.ts';
import { assessmentScores } from '#lib/shared/db/schema.ts';
import { NotFoundError } from '#lib/shared/http/errors.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { createComponent, createEnrollment, createOffering, createStudent, createTerm, createUser } from '../../support/factories.ts';

const ctx = useIsolatedDatabase('students_directory');

let sceneCounter = 0;

async function scene() {
	const tag = `S${++sceneCounter}x`;
	const { semester } = await createTerm(ctx.db);
	const other = await createTerm(ctx.db);
	const offeringA = await createOffering(ctx.db, { semesterId: semester.id });
	const offeringB = await createOffering(ctx.db, { semesterId: semester.id });
	const offeringC = await createOffering(ctx.db, { semesterId: other.semester.id, courseId: offeringA.courseId });
	const budi = await createStudent(ctx.db, { name: `Mahasiswa Uji Budi ${tag}`, cohortYear: 2023 });
	const sari = await createStudent(ctx.db, { name: `Mahasiswa Uji Sari ${tag}`, cohortYear: 2024 });
	const tanpa = await createStudent(ctx.db, { name: `Mahasiswa Uji Tanpa ${tag}` });
	const entries = [
		await createEnrollment(ctx.db, { studentId: budi.id, offeringId: offeringA.id }),
		await createEnrollment(ctx.db, { studentId: budi.id, offeringId: offeringC.id }),
		await createEnrollment(ctx.db, { studentId: sari.id, offeringId: offeringA.id }),
		await createEnrollment(ctx.db, { studentId: tanpa.id, offeringId: offeringB.id })
	];
	return { tag, semester, other, offeringA, offeringB, offeringC, budi, sari, tanpa, entries };
}

describe('direktori mahasiswa', () => {
	test('ringkasan jumlah kelas dan semester dihitung per mahasiswa', async () => {
		const s = await scene();
		const result = await listStudents(ctx.db, 'all', { search: `Budi ${s.tag}` });
		expect(result.rows).toMatchObject([{ id: s.budi.id, enrollmentCount: 2, semesterCount: 2 }]);
	});

	test('pencarian NIM/nama aman terhadap wildcard, filter angkatan termasuk "tidak diketahui", paginasi server', async () => {
		const s = await scene();
		expect((await listStudents(ctx.db, 'all', { search: s.sari.nim })).rows.map((r) => r.id)).toEqual([s.sari.id]);
		expect((await listStudents(ctx.db, 'all', { search: '%' })).total).toBe(0);
		expect((await listStudents(ctx.db, 'all', { cohortYear: 2024 })).rows.map((r) => r.id)).toContain(s.sari.id);
		expect((await listStudents(ctx.db, 'all', { cohortYear: 'unknown', search: `Tanpa ${s.tag}` })).rows.map((r) => r.id)).toEqual([s.tanpa.id]);
		const page = await listStudents(ctx.db, 'all', { pageSize: 2, page: 2 });
		expect(page.rows.length).toBeGreaterThan(0);
		expect(page.pageCount).toBeGreaterThan(1);
		expect((await listStudents(ctx.db, 'all', { pageSize: 100000 })).pageSize).toBe(100);
	});

	test('filter semester dan mata kuliah mengubah ringkasan sesuai cakupan filter', async () => {
		const s = await scene();
		const bySemester = await listStudents(ctx.db, 'all', { semesterId: s.other.semester.id });
		expect(bySemester.rows.map((r) => r.id)).toEqual([s.budi.id]);
		expect(bySemester.rows[0].enrollmentCount).toBe(1);
		const byCourse = await listStudents(ctx.db, 'all', { courseId: s.offeringA.courseId });
		expect(byCourse.rows.map((r) => r.id).sort()).toEqual([s.budi.id, s.sari.id].sort());
	});

	test('kelengkapan: kelas lengkap hanya bila semua komponen wajib aktif memiliki nilai', async () => {
		const s = await scene();
		const comp1 = await createComponent(ctx.db, { offeringId: s.offeringB.id, code: 'K1' });
		const comp2 = await createComponent(ctx.db, { offeringId: s.offeringB.id, code: 'K2' });
		await createComponent(ctx.db, { offeringId: s.offeringB.id, code: 'OPSIONAL', isRequired: false });
		const enrollment = s.entries[3];
		await ctx.db.insert(assessmentScores).values({ enrollmentId: enrollment.id, componentId: comp1.id, score: 80 });
		let row = (await listStudents(ctx.db, 'all', { search: `Tanpa ${s.tag}` })).rows[0];
		expect(row.completeEnrollments).toBe(0);
		await ctx.db.insert(assessmentScores).values({ enrollmentId: enrollment.id, componentId: comp2.id, score: 0 });
		row = (await listStudents(ctx.db, 'all', { search: `Tanpa ${s.tag}` })).rows[0];
		expect(row.completeEnrollments).toBe(1);
		expect((await listStudents(ctx.db, 'all', { completeness: 'complete', search: `Tanpa ${s.tag}` })).total).toBe(1);
		expect((await listStudents(ctx.db, 'all', { completeness: 'incomplete', search: `Tanpa ${s.tag}` })).total).toBe(0);
		expect((await listStudents(ctx.db, 'all', { completeness: 'incomplete', search: `Sari ${s.tag}` })).total).toBe(1);
	});
});

describe('cakupan akses dosen', () => {
	test('dosen hanya melihat mahasiswa dari offering yang diakses dan ringkasan dibatasi pada offering itu', async () => {
		const s = await scene();
		const scope = [s.offeringC.id];
		const result = await listStudents(ctx.db, scope, { search: s.tag });
		expect(result.rows.map((r) => r.id)).toEqual([s.budi.id]);
		expect(result.rows[0].enrollmentCount).toBe(1);
		expect((await listStudents(ctx.db, [], {})).total).toBe(0);
	});

	test('mahasiswa di luar cakupan tidak dapat dilihat dan galatnya sama dengan data yang tidak ada', async () => {
		const s = await scene();
		expect(await canViewStudent(ctx.db, [s.offeringC.id], s.budi.id)).toBe(true);
		expect(await canViewStudent(ctx.db, [s.offeringC.id], s.sari.id)).toBe(false);
		expect(await canViewStudent(ctx.db, 'all', s.sari.id)).toBe(true);
		expect(await canViewStudent(ctx.db, 'all', '3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b')).toBe(false);
		const outside = await assertCanViewStudent(ctx.db, [s.offeringC.id], s.sari.id).catch((e) => e);
		const missing = await assertCanViewStudent(ctx.db, [s.offeringC.id], '3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b').catch((e) => e);
		expect(outside).toBeInstanceOf(NotFoundError);
		expect(outside.message).toBe(missing.message);
	});
});

describe('angkatan', () => {
	test('admin dapat menetapkan angkatan dan daftar angkatan tersedia untuk filter', async () => {
		const s = await scene();
		const admin = await createUser(ctx.db, { role: 'super_admin' });
		await setStudentCohort(ctx.db, { id: admin.id, role: 'super_admin' }, s.tanpa.id, 2022);
		expect(await listCohortYears(ctx.db)).toEqual(expect.arrayContaining([2022, 2023, 2024]));
		await setStudentCohort(ctx.db, { id: admin.id, role: 'super_admin' }, s.tanpa.id, null);
		await expect(setStudentCohort(ctx.db, { id: admin.id, role: 'super_admin' }, s.tanpa.id, 1800)).rejects.toBeInstanceOf(NotFoundError);
	});
});
