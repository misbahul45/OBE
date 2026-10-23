import { describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { activateSemester, assignLecturer, closeSemester } from '#lib/features/academic/index.server.ts';
import { autoMapBatchSheets, loadBatch, stageUpload, type UploadResult } from '#lib/features/imports/index.server.ts';
import { courseOfferings, courses } from '#lib/shared/db/schema.ts';
import { ValidationError } from '#lib/shared/http/errors.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { createCourse, createLecturer, createTerm, createUser } from '../../support/factories.ts';
import { buildSemesterWorkbook } from '../../fixtures/builders/templates.ts';

const ctx = useIsolatedDatabase('imports_automap');

const staged = (result: UploadResult) => {
	if (!result.ok) throw new Error(result.message);
	return result.batchId;
};

async function setup() {
	const adminUser = await createUser(ctx.db, { role: 'super_admin' });
	const admin = { id: adminUser.id, role: 'super_admin' };
	const { semester } = await createTerm(ctx.db);
	await activateSemester(ctx.db, admin, semester.id);
	const kelasB = await createCourse(ctx.db, { name: 'Kelas Uji B' });
	const mataKuliahA = await createCourse(ctx.db, { name: 'Mata Kuliah Uji A' });
	return { admin, semester, kelasB, mataKuliahA };
}

let scene: Awaited<ReturnType<typeof setup>>;
const mappedOfferings = async (actor: { id: string; role: string }, batchId: string) =>
	Object.fromEntries((await loadBatch(ctx.db, actor, batchId)).sheets.map((s) => [s.row.sheetName, s.row.offeringId]));

describe('pemetaan sheet otomatis', () => {
	test('Super Admin: kelas yang belum ada dibuka lalu sheet dipetakan ke kelas yang tepat', async () => {
		scene = await setup();
		const batchId = staged(await stageUpload(ctx.db, scene.admin, { name: 'Semester 1.xlsx', bytes: buildSemesterWorkbook() }));
		const result = await autoMapBatchSheets(ctx.db, scene.admin, batchId);
		expect(result.skipped).toEqual([]);
		expect(result.mapped.map((m) => `${m.courseName}/${m.section}/${m.created}`).sort()).toEqual(['Kelas Uji B/T1/true', 'Mata Kuliah Uji A/A/true']);
		const offerings = await ctx.db.select().from(courseOfferings).where(eq(courseOfferings.semesterId, scene.semester.id));
		expect(offerings.map((o) => o.section).sort()).toEqual(['A', 'T1']);
		const bySheet = await mappedOfferings(scene.admin, batchId);
		expect(bySheet['Kelas Uji B T1']).toBe(offerings.find((o) => o.section === 'T1')!.id);
		expect(bySheet['Mata Kuliah Uji A']).toBe(offerings.find((o) => o.section === 'A')!.id);
	});

	test('dijalankan ulang tidak membuat kelas baru dan menandai sheet yang sudah terpetakan', async () => {
		const batchId = staged(await stageUpload(ctx.db, scene.admin, { name: 'Semester 1 salinan.xlsx', bytes: buildSemesterWorkbook() }));
		const first = await autoMapBatchSheets(ctx.db, scene.admin, batchId);
		expect(first.mapped.every((m) => !m.created)).toBe(true);
		const again = await autoMapBatchSheets(ctx.db, scene.admin, batchId);
		expect(again.mapped).toEqual([]);
		expect(again.alreadyMapped).toBe(2);
		expect((await ctx.db.select().from(courseOfferings)).length).toBe(2);
	});

	test('dosen hanya dipetakan ke kelas yang ditugaskan kepadanya dan tidak pernah membuat kelas', async () => {
		const lecturer = await createLecturer(ctx.db);
		const actor = { id: lecturer.account.id, role: 'lecturer' };
		const [mataKuliahOffering] = await ctx.db.select().from(courseOfferings).where(eq(courseOfferings.section, 'A'));
		await assignLecturer(ctx.db, scene.admin, { offeringId: mataKuliahOffering.id, lecturerId: lecturer.lecturer.id });
		const batchId = staged(await stageUpload(ctx.db, actor, { name: 'Semester 1 dosen.xlsx', bytes: buildSemesterWorkbook() }));
		const result = await autoMapBatchSheets(ctx.db, actor, batchId);
		expect(result.mapped).toEqual([]);
		expect(result.alreadyMapped).toBe(1);
		expect(result.skipped).toHaveLength(1);
		expect(result.skipped[0].sheet).toBe('Kelas Uji B T1');
		expect(result.skipped[0].reason).toContain('tidak ditugaskan');
		const bySheet = await mappedOfferings(actor, batchId);
		expect(bySheet['Mata Kuliah Uji A']).toBe(mataKuliahOffering.id);
		expect(bySheet['Kelas Uji B T1']).toBeNull();
		expect((await ctx.db.select().from(courseOfferings)).length).toBe(2);
	});

	test('nama sheet yang tidak cocok dengan mata kuliah dilaporkan, bukan ditebak', async () => {
		await ctx.db.update(courses).set({ name: 'Nama Mata Kuliah Lain' }).where(eq(courses.id, scene.kelasB.id));
		const batchId = staged(await stageUpload(ctx.db, scene.admin, { name: 'Semester 1 tak dikenal.xlsx', bytes: buildSemesterWorkbook() }));
		const result = await autoMapBatchSheets(ctx.db, scene.admin, batchId);
		expect(result.skipped.map((s) => s.sheet)).toEqual(['Kelas Uji B T1']);
		expect(result.skipped[0].reason).toContain('tidak cocok');
		expect(result.mapped).toEqual([]);
		expect(result.alreadyMapped).toBe(1);
		await ctx.db.update(courses).set({ name: 'Kelas Uji B' }).where(eq(courses.id, scene.kelasB.id));
	});

	test('dosen tidak dapat membuka kelas yang belum ada pada semester aktif yang baru', async () => {
		const next = await createTerm(ctx.db);
		await activateSemester(ctx.db, scene.admin, next.semester.id);
		scene.semester = next.semester;
		const lecturer = await createLecturer(ctx.db);
		const actor = { id: lecturer.account.id, role: 'lecturer' };
		const batchId = staged(await stageUpload(ctx.db, actor, { name: 'Semester 1 semester baru.xlsx', bytes: buildSemesterWorkbook() }));
		const result = await autoMapBatchSheets(ctx.db, actor, batchId);
		expect(result.mapped).toEqual([]);
		expect(result.skipped).toHaveLength(2);
		expect(result.skipped.every((skip) => skip.reason.includes('Minta Super Admin membukanya'))).toBe(true);
		expect((await ctx.db.select().from(courseOfferings).where(eq(courseOfferings.semesterId, next.semester.id))).length).toBe(0);
	});

	test('tanpa semester aktif pemetaan ditolak dengan petunjuk yang jelas', async () => {
		await closeSemester(ctx.db, scene.admin, scene.semester.id);
		const batchId = staged(await stageUpload(ctx.db, scene.admin, { name: 'Semester 1 tutup.xlsx', bytes: buildSemesterWorkbook() }));
		const failure = await autoMapBatchSheets(ctx.db, scene.admin, batchId).catch((error) => error);
		expect(failure).toBeInstanceOf(ValidationError);
		expect(failure.fieldErrors.semester[0]).toContain('semester aktif');
	});
});
