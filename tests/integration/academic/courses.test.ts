import { describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { createCourse, listCourses, setCourseActive, updateCourse } from '#lib/features/academic/index.server.ts';
import { auditLogs, courses } from '#lib/shared/db/schema.ts';
import { NotFoundError, ValidationError } from '#lib/shared/http/errors.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { createUser } from '../../support/factories.ts';

const ctx = useIsolatedDatabase('academic_courses');

async function actor() {
	const user = await createUser(ctx.db, { role: 'super_admin' });
	return { id: user.id, role: 'super_admin' };
}

const input = (code: string, name = `Mata Kuliah ${code}`) => ({ code, name, credits: '3', description: '' });

describe('mata kuliah', () => {
	test('kode dinormalisasi, kolom opsional kosong menjadi null, dan pembuatan diaudit', async () => {
		const admin = await actor();
		const course = await createCourse(ctx.db, admin, input(' bme201 '));
		expect(course).toMatchObject({ code: 'BME201', credits: 3, description: null, isActive: true });
		const trail = await ctx.db.select().from(auditLogs).where(eq(auditLogs.entityId, course.id));
		expect(trail[0]).toMatchObject({ action: 'course.create', actorId: admin.id });
	});

	test('kode duplikat ditolak di server walau berbeda huruf besar/kecil atau spasi', async () => {
		const admin = await actor();
		await createCourse(ctx.db, admin, input('BME202'));
		for (const code of ['BME202', 'bme202', ' Bme202 '])
			await expect(createCourse(ctx.db, admin, input(code))).rejects.toMatchObject({ fieldErrors: { code: ['Kode BME202 sudah dipakai mata kuliah lain'] } });
		expect((await ctx.db.select().from(courses).where(eq(courses.code, 'BME202'))).length).toBe(1);
	});

	test('SKS dan nama divalidasi di server', async () => {
		const admin = await actor();
		await expect(createCourse(ctx.db, admin, { code: 'BME203', name: 'Nama Sah', credits: 0 })).rejects.toBeInstanceOf(ValidationError);
		await expect(createCourse(ctx.db, admin, { code: 'BME203', name: 'ab', credits: 3 })).rejects.toMatchObject({ fieldErrors: { name: ['Nama minimal 3 karakter'] } });
	});

	test('pembaruan menyimpan sebelum/sesudah, menolak kode milik mata kuliah lain, dan menolak ID tak dikenal', async () => {
		const admin = await actor();
		const a = await createCourse(ctx.db, admin, input('BME204'));
		await createCourse(ctx.db, admin, input('BME205'));
		const updated = await updateCourse(ctx.db, admin, a.id, { code: 'BME204', name: 'Nama Baru Mata Kuliah', credits: 4 });
		expect(updated).toMatchObject({ name: 'Nama Baru Mata Kuliah', credits: 4 });
		const trail = await ctx.db.select().from(auditLogs).where(eq(auditLogs.action, 'course.update'));
		expect(trail[0].before).toMatchObject({ credits: 3 });
		expect(trail[0].after).toMatchObject({ credits: 4 });
		await expect(updateCourse(ctx.db, admin, a.id, input('BME205'))).rejects.toBeInstanceOf(ValidationError);
		await expect(updateCourse(ctx.db, admin, '3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b', input('BME299'))).rejects.toBeInstanceOf(NotFoundError);
	});

	test('nonaktif/aktif dan daftar dengan pencarian, filter aktif, dan paginasi server', async () => {
		const admin = await actor();
		for (let i = 1; i <= 5; i++) await createCourse(ctx.db, admin, input(`LST${i}`, `Daftar ${i}`));
		const off = (await listCourses(ctx.db, { search: 'LST3' })).rows[0];
		await setCourseActive(ctx.db, admin, off.id, false);
		const page1 = await listCourses(ctx.db, { search: 'LST', pageSize: 2, page: 1 });
		expect(page1).toMatchObject({ total: 5, pageCount: 3 });
		expect(page1.rows.map((r) => r.code)).toEqual(['LST1', 'LST2']);
		expect((await listCourses(ctx.db, { search: 'LST', onlyActive: true })).total).toBe(4);
		expect((await listCourses(ctx.db, { search: '%' })).total).toBe(0);
	});
});
