import { beforeAll, describe, expect, test } from 'bun:test';
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

describe('pencarian, urutan, dan paginasi yang dioptimalkan', () => {
	let semesterId = '';
	beforeAll(async () => {
		semesterId = (await createOffering(ctx.db)).semesterId;
	});
	const named = async (name: string, nim: string, cohortYear?: number) => {
		const student = await createStudent(ctx.db, { name, nim, cohortYear });
		await createEnrollment(ctx.db, { studentId: student.id, offeringId: (await createOffering(ctx.db, { semesterId })).id });
		return student;
	};

	test('beberapa kata dicocokkan dengan urutan bebas dan setiap kata wajib ada pada nama atau NIM', async () => {
		const tag = `Q${++sceneCounter}`;
		const a = await named(`Rahmat Hidayat ${tag}`, `9905${String(sceneCounter).padStart(4, '0')}001`);
		await named(`Rahmat Pratama ${tag}`, `9905${String(sceneCounter).padStart(4, '0')}002`);
		expect((await listStudents(ctx.db, 'all', { search: `hidayat rahmat ${tag}` })).rows.map((r) => r.id)).toEqual([a.id]);
		expect((await listStudents(ctx.db, 'all', { search: `  RAHMAT   hidayat  ${tag}  ` })).rows.map((r) => r.id)).toEqual([a.id]);
		expect((await listStudents(ctx.db, 'all', { search: `rahmat tidak-ada ${tag}` })).total).toBe(0);
		expect((await listStudents(ctx.db, 'all', { search: `rahmat ${tag}` })).total).toBe(2);
	});

	test('frasa utuh didahulukan agar kata yang kebetulan ada di NIM orang lain tidak ikut tampil', async () => {
		const tag = `F${++sceneCounter}`;
		const base = `9909${String(sceneCounter).padStart(4, '0')}`;
		const target = await named(`Frasa Uji ${tag} 001`, `${base}900`);
		await named(`Frasa Uji ${tag} 002`, `${base}001`);
		const phrase = await listStudents(ctx.db, 'all', { search: `Frasa Uji ${tag} 001` });
		expect(phrase.rows.map((r) => r.id)).toEqual([target.id]);
		expect(phrase.matched).toBe('phrase');
		const fallback = await listStudents(ctx.db, 'all', { search: `001 frasa ${tag}` });
		expect(fallback.matched).toBe('tokens');
		expect(fallback.total).toBe(2);
	});

	test('urutan relevansi: NIM persis, awalan NIM, awalan nama, lalu kata di tengah nama', async () => {
		const tag = `R${++sceneCounter}`.toLowerCase();
		const exact = await named(`Zzz Bukan ${tag}`, `9906${String(sceneCounter).padStart(4, '0')}001`);
		const nimPrefix = await named(`Aaa Bukan ${tag}`, `${exact.nim}9`);
		const namePrefix = await named(`${exact.nim}x Nama ${tag}`, `9906${String(sceneCounter).padStart(4, '0')}003`);
		const middle = await named(`Ahmad ${exact.nim} Tengah ${tag}`, `9906${String(sceneCounter).padStart(4, '0')}004`);
		const result = await listStudents(ctx.db, 'all', { search: exact.nim });
		expect(result.rows.map((r) => r.id)).toEqual([exact.id, nimPrefix.id, namePrefix.id, middle.id]);
	});

	test('urutan manual menurut NIM, angkatan dengan nilai kosong di akhir, dan jumlah mata kuliah, naik atau turun', async () => {
		const tag = `U${++sceneCounter}`;
		const base = `9907${String(sceneCounter).padStart(4, '0')}`;
		const x = await named(`Urut ${tag} A`, `${base}001`, 2022);
		const y = await named(`Urut ${tag} B`, `${base}002`, 2024);
		const z = await named(`Urut ${tag} C`, `${base}003`);
		const ids = (rows: { id: string }[]) => rows.map((r) => r.id);
		expect(ids((await listStudents(ctx.db, 'all', { search: `urut ${tag}`, sort: 'nim', direction: 'turun' })).rows)).toEqual([z.id, y.id, x.id]);
		expect(ids((await listStudents(ctx.db, 'all', { search: `urut ${tag}`, sort: 'angkatan', direction: 'naik' })).rows)).toEqual([x.id, y.id, z.id]);
		expect(ids((await listStudents(ctx.db, 'all', { search: `urut ${tag}`, sort: 'angkatan', direction: 'turun' })).rows)).toEqual([y.id, x.id, z.id]);
		await createEnrollment(ctx.db, { studentId: z.id, offeringId: (await createOffering(ctx.db, { semesterId })).id });
		expect((await listStudents(ctx.db, 'all', { search: `urut ${tag}`, sort: 'matkul', direction: 'turun' })).rows[0].id).toBe(z.id);
	});

	test('halaman di luar jangkauan dipangkas ke halaman terakhir dan total tetap benar', async () => {
		const tag = `P${++sceneCounter}`;
		const base = `9908${String(sceneCounter).padStart(4, '0')}`;
		for (let i = 1; i <= 7; i++) await named(`Halaman ${tag} ${String(i).padStart(2, '0')}`, `${base}${String(i).padStart(3, '0')}`);
		const first = await listStudents(ctx.db, 'all', { search: `halaman ${tag}`, pageSize: 3, page: 1 });
		expect(first).toMatchObject({ total: 7, pageCount: 3, page: 1 });
		expect(first.rows).toHaveLength(3);
		const beyond = await listStudents(ctx.db, 'all', { search: `halaman ${tag}`, pageSize: 3, page: 99 });
		expect(beyond).toMatchObject({ total: 7, pageCount: 3, page: 3 });
		expect(beyond.rows).toHaveLength(1);
		const none = await listStudents(ctx.db, 'all', { search: `tidak-ada-${tag}`, page: 5 });
		expect(none).toMatchObject({ total: 0, page: 1, pageCount: 1, rows: [] });
		const seen = new Set<string>();
		for (const page of [1, 2, 3]) for (const row of (await listStudents(ctx.db, 'all', { search: `halaman ${tag}`, pageSize: 3, page })).rows) seen.add(row.id);
		expect(seen.size).toBe(7);
	});

	test('jumlah kelas lengkap sama dengan atau tanpa penyaring kelengkapan', async () => {
		const s = await scene();
		await createComponent(ctx.db, { offeringId: s.offeringA.id, code: 'UTS', weightPercent: 100 });
		await ctx.db.insert(assessmentScores).values({ enrollmentId: s.entries[0].id, componentId: (await ctx.db.query.assessmentComponents.findFirst({ where: (t, { eq }) => eq(t.offeringId, s.offeringA.id) }))!.id, score: 80 });
		const plain = await listStudents(ctx.db, 'all', { search: `Budi ${s.tag}` });
		const filtered = await listStudents(ctx.db, 'all', { search: `Budi ${s.tag}`, completeness: 'incomplete' });
		expect(plain.rows[0].completeEnrollments).toBe(1);
		expect(filtered.rows[0].completeEnrollments).toBe(plain.rows[0].completeEnrollments);
	});
});
