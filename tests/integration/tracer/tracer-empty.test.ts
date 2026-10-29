import { describe, expect, test } from 'bun:test';
import { seedProgramBlueprint } from '#lib/features/profiles/index.server.ts';
import { getTracerOverview, saveTracerRecord } from '#lib/features/tracer/index.server.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { createStudent, createUser } from '../../support/factories.ts';

const ctx = useIsolatedDatabase('tracer_empty');

describe('tanpa ambang nilai CPL', () => {
	test('prediksi tidak dikarang, halaman menyatakan belum siap, dan isian nyata tetap dapat disimpan', async () => {
		const user = await createUser(ctx.db, { role: 'super_admin' });
		await seedProgramBlueprint(ctx.db);
		const student = await createStudent(ctx.db, { name: 'Alumni Tanpa Ambang' });
		const overview = await getTracerOverview(ctx.db);
		expect(overview).toMatchObject({ ready: false, targetSource: null });
		expect(overview.predicted).toEqual({ assessed: 0, linear: 0, notLinear: 0, notAssessable: 1, linearPercent: null });
		expect(overview.rows[0]).toMatchObject({ predictedLinear: null, bestFields: [] });

		await saveTracerRecord(ctx.db, { id: user.id, role: 'super_admin' }, { studentId: student.id, linear: 'tidak', careerFieldCode: 'BK2' });
		const after = await getTracerOverview(ctx.db);
		expect(after.summary).toMatchObject({ recorded: 1, actualLinear: 0, actualPercent: 0, comparable: 0, agreementPercent: null });
		expect(after.rows[0].record).toMatchObject({ isLinear: false, careerFieldCode: 'BK2', predictedForField: null });
	});
});
