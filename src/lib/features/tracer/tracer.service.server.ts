import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '#lib/shared/db/client.server.ts';
import { NotFoundError } from '#lib/shared/http/errors.ts';
import { optionalText, parseOrThrow } from '#lib/shared/http/zod.ts';
import { recordAudit } from '#lib/features/audit/index.server.ts';
import { careerFields } from '#lib/features/profiles/profiles.schema.ts';
import { students } from '#lib/features/students/students.schema.ts';
import { tracerRecords } from './tracer.schema.ts';
import { keeratanValues } from './tracer.types.ts';

const saveSchema = z.object({
	studentId: z.string().uuid('Mahasiswa tidak valid'),
	linear: z.enum(['ya', 'tidak'], { error: 'Pilih linear atau tidak linear' }),
	careerFieldCode: z.union([z.literal(''), z.string().regex(/^BK[0-9]+$/, 'Bidang kerja tidak valid')]).optional(),
	keeratan: z.union([z.literal(''), z.enum(keeratanValues)]).optional(),
	note: optionalText(500)
});

export type TracerActor = { id: string; role: string };

export async function saveTracerRecord(db: Database, actor: TracerActor, input: unknown) {
	const data = parseOrThrow(saveSchema, input);
	const [student] = await db.select({ id: students.id }).from(students).where(eq(students.id, data.studentId)).limit(1);
	if (!student) throw new NotFoundError('Mahasiswa tidak ditemukan.');
	let careerFieldId: string | null = null;
	if (data.careerFieldCode) {
		const [field] = await db.select({ id: careerFields.id }).from(careerFields).where(eq(careerFields.code, data.careerFieldCode)).limit(1);
		if (!field) throw new NotFoundError('Bidang kerja tidak ditemukan.');
		careerFieldId = field.id;
	}
	const values = { isLinear: data.linear === 'ya', careerFieldId, keeratan: data.keeratan ? data.keeratan : null, note: data.note, recordedBy: actor.id };
	return db.transaction(async (tx) => {
		const [before] = await tx.select().from(tracerRecords).where(eq(tracerRecords.studentId, data.studentId)).limit(1);
		await tx
			.insert(tracerRecords)
			.values({ studentId: data.studentId, ...values })
			.onConflictDoUpdate({ target: tracerRecords.studentId, set: { ...values, updatedAt: new Date() } });
		await recordAudit(tx, {
			actorId: actor.id,
			actorRole: actor.role,
			action: before ? 'tracer.update' : 'tracer.create',
			entityType: 'student',
			entityId: data.studentId,
			summary: 'Data tracer (linearitas nyata) mahasiswa disimpan',
			before: before ? { isLinear: before.isLinear, keeratan: before.keeratan, careerFieldId: before.careerFieldId } : null,
			after: { isLinear: values.isLinear, keeratan: values.keeratan, careerFieldCode: data.careerFieldCode || null }
		});
		return { created: !before };
	});
}

export async function clearTracerRecord(db: Database, actor: TracerActor, studentId: string) {
	const parsed = parseOrThrow(z.object({ studentId: z.string().uuid('Mahasiswa tidak valid') }), { studentId });
	return db.transaction(async (tx) => {
		const removed = await tx.delete(tracerRecords).where(eq(tracerRecords.studentId, parsed.studentId)).returning({ isLinear: tracerRecords.isLinear });
		if (removed.length === 0) return { removed: false };
		await recordAudit(tx, { actorId: actor.id, actorRole: actor.role, action: 'tracer.clear', entityType: 'student', entityId: parsed.studentId, summary: 'Data tracer (linearitas nyata) mahasiswa dihapus', before: { isLinear: removed[0].isLinear } });
		return { removed: true };
	});
}
