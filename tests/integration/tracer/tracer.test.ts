import { beforeAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { auditLogs, cplDefinitions, cplResults, tracerRecords } from '#lib/shared/db/schema.ts';
import { ValidationError, NotFoundError } from '#lib/shared/http/errors.ts';
import { seedProgramBlueprint } from '#lib/features/profiles/index.server.ts';
import { clearTracerRecord, getTracerOverview, saveTracerRecord } from '#lib/features/tracer/index.server.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { createEnrollment, createOffering, createStudent, createUser } from '../../support/factories.ts';
import { attachBlueprint, createBatch, sampleBlueprint } from '../../support/imports.ts';

const ctx = useIsolatedDatabase('tracer');
let admin: { id: string; role: string };
const people: Record<'tinggi' | 'rendah' | 'kosong', { id: string; nim: string; name: string }> = {} as never;

beforeAll(async () => {
	const user = await createUser(ctx.db, { role: 'super_admin' });
	admin = { id: user.id, role: 'super_admin' };
	await seedProgramBlueprint(ctx.db);
	const offering = await createOffering(ctx.db);
	const batch = await createBatch(ctx.db, admin.id);
	await attachBlueprint(ctx.db, { batchId: batch.id, offeringId: offering.id, sheetName: 'Sheet Tracer', blueprint: sampleBlueprint() });
	const cpl = await ctx.db.select().from(cplDefinitions);
	for (const [key, value] of [['tinggi', 80], ['rendah', 40]] as const) {
		const student = await createStudent(ctx.db, { name: `Alumni Uji ${key}` });
		const enrollment = await createEnrollment(ctx.db, { offeringId: offering.id, studentId: student.id });
		await ctx.db.insert(cplResults).values(cpl.map((c) => ({ enrollmentId: enrollment.id, cplId: c.id, source: 'imported_reference' as const, value, completeness: 'complete' as const })));
		people[key] = student;
	}
	people.kosong = await createStudent(ctx.db, { name: 'Alumni Uji kosong' });
	await createEnrollment(ctx.db, { offeringId: offering.id, studentId: people.kosong.id });
});

describe('statistik prediksi linearitas', () => {
	test('menghitung jumlah linear, tidak linear, dan belum dapat dinilai dengan ambang dari Excel', async () => {
		const overview = await getTracerOverview(ctx.db);
		expect(overview.ready).toBe(true);
		expect(overview.targetSource).toBe('excel');
		expect(overview.predicted).toEqual({ assessed: 2, linear: 1, notLinear: 1, notAssessable: 1, linearPercent: 50 });
		const tinggi = overview.rows.find((r) => r.studentId === people.tinggi.id)!;
		const rendah = overview.rows.find((r) => r.studentId === people.rendah.id)!;
		expect(tinggi).toMatchObject({ predictedLinear: true, cplWithData: 8 });
		expect(tinggi.bestFields[0].fit).toBe(100);
		expect(rendah.predictedLinear).toBe(false);
		expect(rendah.bestFields[0].fit).toBeCloseTo((40 / 62) * 100, 1);
		expect(overview.rows.find((r) => r.studentId === people.kosong.id)).toMatchObject({ predictedLinear: null, bestFields: [], cplWithData: 0 });
	});

	test('statistik per bidang kerja memuat jumlah prediksi linear dan tidak linear', async () => {
		const bk1 = (await getTracerOverview(ctx.db)).fieldStats.find((f) => f.code === 'BK1')!;
		expect(bk1).toMatchObject({ students: 2, predictedLinear: 1, predictedNotLinear: 1, recordedLinear: 0, recordedNotLinear: 0 });
	});
});

describe('isian nyata dan perbandingan', () => {
	test('menyimpan, memperbarui, membandingkan dengan prediksi, dan mencatat audit tanpa nama maupun NIM', async () => {
		expect(await saveTracerRecord(ctx.db, admin, { studentId: people.tinggi.id, linear: 'ya', careerFieldCode: 'BK1', keeratan: 'sangat_erat', note: '' })).toEqual({ created: true });
		expect(await saveTracerRecord(ctx.db, admin, { studentId: people.rendah.id, linear: 'ya', careerFieldCode: 'BK1', keeratan: '' })).toEqual({ created: true });
		const overview = await getTracerOverview(ctx.db);
		expect(overview.summary).toMatchObject({ students: 3, recorded: 2, actualLinear: 2, actualPercent: 100, comparable: 2, agreementPercent: 50 });
		expect(overview.summary.matrix).toEqual({ predictedLinear: { actualLinear: 1, actualNotLinear: 0 }, predictedNotLinear: { actualLinear: 1, actualNotLinear: 0 } });
		const row = overview.rows.find((r) => r.studentId === people.rendah.id)!;
		expect(row.record).toMatchObject({ isLinear: true, careerFieldCode: 'BK1', predictedForField: false });
		expect(overview.keeratanCounts.find((k) => k.value === 'sangat_erat')!.count).toBe(1);
		expect(overview.fieldStats.find((f) => f.code === 'BK1')).toMatchObject({ recordedLinear: 2, recordedNotLinear: 0 });

		expect(await saveTracerRecord(ctx.db, admin, { studentId: people.rendah.id, linear: 'tidak', careerFieldCode: 'BK1' })).toEqual({ created: false });
		const after = await getTracerOverview(ctx.db);
		expect(after.summary).toMatchObject({ actualLinear: 1, agreementPercent: 100 });

		const logs = await ctx.db.select().from(auditLogs).where(eq(auditLogs.entityId, people.rendah.id));
		expect(logs.map((l) => l.action).sort()).toEqual(['tracer.create', 'tracer.update']);
		expect(JSON.stringify(logs)).not.toContain(people.rendah.nim);
		expect(JSON.stringify(logs)).not.toContain('Alumni Uji');
	});

	test('isian tanpa bidang kerja dihitung sebagai nyata tetapi tidak dapat dibandingkan', async () => {
		await saveTracerRecord(ctx.db, admin, { studentId: people.kosong.id, linear: 'ya' });
		const summary = (await getTracerOverview(ctx.db)).summary;
		expect(summary.recorded).toBe(3);
		expect(summary.comparable).toBe(2);
		await clearTracerRecord(ctx.db, admin, people.kosong.id);
	});

	test('menghapus isian mengembalikan status belum diisi dan aman diulang', async () => {
		expect(await clearTracerRecord(ctx.db, admin, people.tinggi.id)).toEqual({ removed: true });
		expect(await clearTracerRecord(ctx.db, admin, people.tinggi.id)).toEqual({ removed: false });
		const overview = await getTracerOverview(ctx.db, { status: 'belum' });
		expect(overview.rows.map((r) => r.studentId)).toContain(people.tinggi.id);
		expect(overview.rows.map((r) => r.studentId)).not.toContain(people.rendah.id);
	});

	test('penyaring status, pencarian, dan paginasi bekerja di sisi server', async () => {
		const tidak = await getTracerOverview(ctx.db, { status: 'tidak' });
		expect(tidak.rows.map((r) => r.studentId)).toEqual([people.rendah.id]);
		expect((await getTracerOverview(ctx.db, { search: 'uji kosong' })).rows).toHaveLength(1);
		const paged = await getTracerOverview(ctx.db, { pageSize: 10, page: 99 });
		expect(paged).toMatchObject({ page: 1, pageCount: 1 });
	});

	test('masukan tidak valid ditolak dan tidak menyentuh basis data', async () => {
		await expect(saveTracerRecord(ctx.db, admin, { studentId: 'bukan-uuid', linear: 'ya' })).rejects.toBeInstanceOf(ValidationError);
		await expect(saveTracerRecord(ctx.db, admin, { studentId: people.tinggi.id, linear: 'mungkin' })).rejects.toBeInstanceOf(ValidationError);
		await expect(saveTracerRecord(ctx.db, admin, { studentId: people.tinggi.id, linear: 'ya', keeratan: 'sangat' })).rejects.toBeInstanceOf(ValidationError);
		await expect(saveTracerRecord(ctx.db, admin, { studentId: people.tinggi.id, linear: 'ya', careerFieldCode: 'BK99' })).rejects.toBeInstanceOf(NotFoundError);
		await expect(saveTracerRecord(ctx.db, admin, { studentId: '3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b', linear: 'ya' })).rejects.toBeInstanceOf(NotFoundError);
		expect((await ctx.db.select().from(tracerRecords).where(eq(tracerRecords.studentId, people.tinggi.id))).length).toBe(0);
	});
});
