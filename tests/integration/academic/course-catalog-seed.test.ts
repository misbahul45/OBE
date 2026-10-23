import { describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { seedCourseCatalog } from '#lib/features/academic/index.server.ts';
import { courseCatalog } from '#lib/features/academic/academic.course-catalog.ts';
import { courses } from '#lib/shared/db/schema.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';

const ctx = useIsolatedDatabase('academic_course_catalog');

describe('seedCourseCatalog', () => {
	test('database kosong: seluruh katalog dibuat dengan keterangan struktur kurikulum', async () => {
		const result = await seedCourseCatalog(ctx.db);
		expect(result).toEqual({ created: courseCatalog.length, existing: 0, updated: 0 });
		const rows = await ctx.db.select().from(courses);
		expect(rows).toHaveLength(courseCatalog.length);
		const skripsi = rows.find((row) => row.code === 'PNT499')!;
		expect(skripsi.credits).toBe(6);
		expect(skripsi.description).toContain('Semester 8');
	});

	test('dijalankan ulang tidak menambah atau mengubah apa pun', async () => {
		const result = await seedCourseCatalog(ctx.db);
		expect(result).toEqual({ created: 0, existing: courseCatalog.length, updated: 0 });
		expect((await ctx.db.select().from(courses)).length).toBe(courseCatalog.length);
	});

	test('sunting manual dipertahankan tanpa overwrite dan dikembalikan dengan overwrite', async () => {
		await ctx.db.update(courses).set({ name: 'Nama sunting manual', credits: 4 }).where(eq(courses.code, 'TMM201'));
		await seedCourseCatalog(ctx.db);
		const [kept] = await ctx.db.select().from(courses).where(eq(courses.code, 'TMM201'));
		expect(kept.name).toBe('Nama sunting manual');
		const result = await seedCourseCatalog(ctx.db, { overwrite: true });
		expect(result.updated).toBe(courseCatalog.length);
		const [restored] = await ctx.db.select().from(courses).where(eq(courses.code, 'TMM201'));
		expect(restored.name).toBe('Biomaterial');
		expect(restored.credits).toBe(3);
	});

	test('kode yang sudah dipakai mata kuliah lain tidak membuat duplikat', async () => {
		const before = (await ctx.db.select().from(courses)).length;
		await seedCourseCatalog(ctx.db);
		expect((await ctx.db.select().from(courses)).length).toBe(before);
	});
});
