import { describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { activateSemester, closeSemester, createAcademicYear, createSemester, getActiveSemester, listAcademicYears } from '#lib/features/academic/index.server.ts';
import { academicYears, auditLogs, semesters } from '#lib/shared/db/schema.ts';
import { NotFoundError, ValidationError } from '#lib/shared/http/errors.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { createUser } from '../../support/factories.ts';

const ctx = useIsolatedDatabase('academic_terms');

async function actor() {
	const user = await createUser(ctx.db, { role: 'super_admin' });
	return { id: user.id, role: 'super_admin' };
}

const semesterInput = (academicYearId: string, term: 'ganjil' | 'genap' | 'pendek', year: number) => ({
	academicYearId,
	term,
	startDate: term === 'ganjil' ? `${year}-08-01` : `${year + 1}-02-01`,
	endDate: term === 'ganjil' ? `${year + 1}-01-15` : `${year + 1}-06-30`
});

describe('tahun akademik', () => {
	test('kode dibentuk dari tahun mulai, tercatat di audit, dan duplikat ditolak dengan pesan yang jelas', async () => {
		const admin = await actor();
		const year = await createAcademicYear(ctx.db, admin, { startYear: '2040' });
		expect(year.code).toBe('2040/2041');
		const logs = await ctx.db.select().from(auditLogs).where(eq(auditLogs.entityId, year.id));
		expect(logs.map((l) => l.action)).toEqual(['academic_year.create']);
		await expect(createAcademicYear(ctx.db, admin, { startYear: 2040 })).rejects.toMatchObject({ fieldErrors: { startYear: ['Tahun akademik 2040/2041 sudah ada'] } });
		await expect(createAcademicYear(ctx.db, admin, { startYear: 1999 })).rejects.toBeInstanceOf(ValidationError);
	});
});

describe('semester', () => {
	test('nama semester menyertakan jenis dan tahun akademik; duplikat jenis ditolak', async () => {
		const admin = await actor();
		const year = await createAcademicYear(ctx.db, admin, { startYear: 2041 });
		const semester = await createSemester(ctx.db, admin, semesterInput(year.id, 'ganjil', 2041));
		expect(semester).toMatchObject({ name: 'Ganjil 2041/2042', status: 'planned' });
		await expect(createSemester(ctx.db, admin, semesterInput(year.id, 'ganjil', 2041))).rejects.toMatchObject({ fieldErrors: { term: [expect.stringContaining('sudah ada')] } });
		await createSemester(ctx.db, admin, semesterInput(year.id, 'genap', 2041));
	});

	test('tahun akademik yang tidak ada dan rentang tanggal terbalik ditolak', async () => {
		const admin = await actor();
		const year = await createAcademicYear(ctx.db, admin, { startYear: 2042 });
		await expect(createSemester(ctx.db, admin, { ...semesterInput('3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b', 'ganjil', 2042) })).rejects.toMatchObject({ fieldErrors: { academicYearId: ['Tahun akademik tidak ditemukan'] } });
		await expect(createSemester(ctx.db, admin, { academicYearId: year.id, term: 'ganjil', startDate: '2042-08-01', endDate: '2042-07-01' })).rejects.toMatchObject({ fieldErrors: { endDate: [expect.any(String)] } });
	});

	test('mengaktifkan semester menutup semester aktif sebelumnya sehingga hanya satu yang aktif', async () => {
		const admin = await actor();
		const year = await createAcademicYear(ctx.db, admin, { startYear: 2043 });
		const first = await createSemester(ctx.db, admin, semesterInput(year.id, 'ganjil', 2043));
		const second = await createSemester(ctx.db, admin, semesterInput(year.id, 'genap', 2043));
		await activateSemester(ctx.db, admin, first.id);
		expect((await getActiveSemester(ctx.db))?.id).toBe(first.id);
		await activateSemester(ctx.db, admin, second.id);
		expect((await getActiveSemester(ctx.db))?.id).toBe(second.id);
		const all = await ctx.db.select().from(semesters).where(eq(semesters.academicYearId, year.id));
		expect(Object.fromEntries(all.map((s) => [s.term, s.status]))).toEqual({ ganjil: 'closed', genap: 'active' });
		const [yearRow] = await ctx.db.select().from(academicYears).where(eq(academicYears.id, year.id));
		expect(yearRow.isActive).toBe(true);
		const trail = await ctx.db.select().from(auditLogs).where(eq(auditLogs.entityId, second.id));
		expect(trail.map((l) => l.action)).toContain('semester.activate');
	});

	test('aktivasi pindah tahun akademik membuat hanya satu tahun aktif', async () => {
		const admin = await actor();
		const yearA = await createAcademicYear(ctx.db, admin, { startYear: 2044 });
		const yearB = await createAcademicYear(ctx.db, admin, { startYear: 2045 });
		const a = await createSemester(ctx.db, admin, semesterInput(yearA.id, 'ganjil', 2044));
		const b = await createSemester(ctx.db, admin, semesterInput(yearB.id, 'ganjil', 2045));
		await activateSemester(ctx.db, admin, a.id);
		await activateSemester(ctx.db, admin, b.id);
		const years = await ctx.db.select().from(academicYears).where(eq(academicYears.isActive, true));
		expect(years.map((y) => y.code)).toEqual(['2045/2046']);
	});

	test('semester tidak dikenal menghasilkan NotFoundError dan penutupan semester tercatat', async () => {
		const admin = await actor();
		await expect(activateSemester(ctx.db, admin, '3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b')).rejects.toBeInstanceOf(NotFoundError);
		const year = await createAcademicYear(ctx.db, admin, { startYear: 2046 });
		const semester = await createSemester(ctx.db, admin, semesterInput(year.id, 'ganjil', 2046));
		expect((await closeSemester(ctx.db, admin, semester.id)).status).toBe('closed');
	});

	test('daftar tahun akademik memuat semester bersarang berurutan', async () => {
		const list = await listAcademicYears(ctx.db);
		const withTerms = list.find((y) => y.code === '2041/2042')!;
		expect(withTerms.semesters.map((s) => s.term)).toEqual(['ganjil', 'genap']);
		expect(list[0].startYear).toBeGreaterThanOrEqual(list.at(-1)!.startYear);
	});
});
