import { beforeAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { assessmentComponents, assessmentScores, auditLogs, cplResults, cpmkResults, enrollments, students } from '#lib/shared/db/schema.ts';
import { evaluateGate, planSheet, summarizePlans } from '#lib/features/imports/imports.plan.server.ts';
import { readWorkbook } from '#lib/features/imports/workbook-reader.server.ts';
import type { GateOptions } from '#lib/features/imports/imports.plan.types.ts';
import type { SheetGrid } from '#lib/features/imports/imports.types.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { createCourse, createEnrollment, createOffering, createStudent } from '../../support/factories.ts';
import { defineOutcomes, inputFor, rowCount, simpleSheet } from '../../support/imports.ts';
import { buildSemesterWorkbook } from '../../fixtures/builders/templates.ts';

const ctx = useIsolatedDatabase('imports_dryrun');
let semesterA: SheetGrid;

beforeAll(() => {
	[semesterA] = readWorkbook(buildSemesterWorkbook(), 's.xlsx').sheets;
});

const openGate: GateOptions = {
	strategy: 'upsert',
	errorPolicy: 'block_on_error',
	confirmations: { scoreUpdates: true, weightChanges: true },
	acknowledgements: { numericNim: true }
};

async function totals() {
	return [students, enrollments, assessmentComponents, assessmentScores, cpmkResults, cplResults, auditLogs].map((table) => rowCount(ctx.db, table));
}

describe('rencana impor pada database kosong', () => {
	test('menghitung semua kategori perubahan dari format Semester 1 sintetis', async () => {
		const offering = await createOffering(ctx.db);
		await defineOutcomes(ctx.db, offering.courseId, ['CPMK-1', 'CPMK-2', 'CPMK-3', 'CPMK-4', 'CPMK-5'], ['CPL-1']);
		const plan = await planSheet(ctx.db, inputFor(semesterA, offering.id));
		expect(plan.summary).toMatchObject({
			rowsValid: 15,
			rowsWarning: 0,
			rowsRejected: 0,
			studentsNew: 15,
			studentsExisting: 0,
			enrollmentsNew: 15,
			enrollmentsExisting: 0,
			scoresNew: 15 * 8,
			scoresUpdated: 0,
			scoresUnchanged: 0,
			referencesNew: 15 * 6,
			componentsNew: 8,
			weightChanges: 0,
			nameConflicts: 0,
			blankCells: 0
		});
		expect(plan.rows[0]).toMatchObject({ studentAction: 'create', enrollmentAction: 'create', nameConflict: false });
		expect(plan.rows[0].nimMasked).toMatch(/^\*+\d{4}$/);
		expect(plan.components.every((c) => c.action === 'create')).toBe(true);
	});

	test('dry-run tidak mengubah satu pun tabel', async () => {
		const offering = await createOffering(ctx.db);
		const before = await Promise.all(await totals());
		await planSheet(ctx.db, inputFor(semesterA, offering.id));
		await planSheet(ctx.db, inputFor(semesterA, offering.id), { lock: true });
		const after = await Promise.all(await totals());
		expect(after).toEqual(before);
	});

	test('tanpa definisi CPMK, referensi CPMK tetap direncanakan sebagai baru dan tidak dilaporkan sebagai tidak dikenal', async () => {
		const offering = await createOffering(ctx.db);
		const plan = await planSheet(ctx.db, inputFor(semesterA, offering.id));
		expect(plan.validation.issues.map((i) => i.code)).not.toContain('CPMK_UNKNOWN');
		const cpmk = plan.rows[0].references.filter((r) => r.kind === 'cpmk');
		expect(cpmk.length).toBeGreaterThan(0);
		expect(cpmk.every((r) => r.action === 'insert')).toBe(true);
	});
});

describe('rencana terhadap data yang sudah ada', () => {
	test('mahasiswa dan enrollment existing dipakai ulang; nama berbeda menjadi konflik tanpa mengubah master', async () => {
		const offering = await createOffering(ctx.db);
		const student = await createStudent(ctx.db, { nim: '99012340001', name: 'Mahasiswa Uji 901' });
		await createEnrollment(ctx.db, { studentId: student.id, offeringId: offering.id });
		const grid = simpleSheet('Konflik', [
			{ nim: 99012340001, name: 'Nama Lain Sekali', uts: 80, uas: 90 },
			{ nim: 99012340002, name: 'Mahasiswa Uji 902', uts: 70, uas: 75 }
		]);
		const plan = await planSheet(ctx.db, inputFor(grid, offering.id));
		expect(plan.rows[0]).toMatchObject({ studentAction: 'reuse', enrollmentAction: 'existing', nameConflict: true, masterName: 'Mahasiswa Uji 901' });
		expect(plan.rows[1]).toMatchObject({ studentAction: 'create', enrollmentAction: 'create', nameConflict: false });
		expect(plan.summary).toMatchObject({ studentsNew: 1, studentsExisting: 1, enrollmentsNew: 1, enrollmentsExisting: 1, nameConflicts: 1 });
		const [still] = await ctx.db.select().from(students).where(eq(students.id, student.id));
		expect(still.name).toBe('Mahasiswa Uji 901');
	});

	test('nama yang hanya berbeda huruf besar/spasi tidak dianggap konflik', async () => {
		const offering = await createOffering(ctx.db);
		await createStudent(ctx.db, { nim: '99012340011', name: 'Mahasiswa Uji 911' });
		const plan = await planSheet(ctx.db, inputFor(simpleSheet('Spasi', [{ nim: 99012340011, name: '  mahasiswa   uji 911 ', uts: 50, uas: 50 }]), offering.id));
		expect(plan.rows[0].nameConflict).toBe(false);
	});

	test('nilai existing yang sama/berbeda/baru dibedakan, nilai kosong tidak pernah menghapus', async () => {
		const offering = await createOffering(ctx.db);
		const { commitImport } = await import('#lib/features/imports/imports.commit.server.ts');
		const { createUser } = await import('../../support/factories.ts');
		const { createBatch } = await import('../../support/imports.ts');
		const actor = await createUser(ctx.db, { role: 'super_admin' });
		const first = simpleSheet('Awal', [{ nim: 99012340021, name: 'Mahasiswa Uji 921', uts: 80, uas: 90 }]);
		const batch = await createBatch(ctx.db, actor.id);
		await commitImport(ctx.db, { batchId: batch.id, actor: { id: actor.id, role: 'super_admin' }, sheets: [inputFor(first, offering.id)], strategy: 'upsert', errorPolicy: 'block_on_error', confirmations: { scoreUpdates: true, weightChanges: true } });

		const second = simpleSheet('Awal', [{ nim: 99012340021, name: 'Mahasiswa Uji 921', uts: 80, uas: null }]);
		const planSame = await planSheet(ctx.db, inputFor(second, offering.id));
		expect(planSame.rows[0].scores).toEqual([{ code: 'UTS-1', action: 'unchanged', oldValue: 80, newValue: 80 }]);
		expect(planSame.rows[0].blankComponents).toEqual(['UAS-1']);

		const third = simpleSheet('Awal', [{ nim: 99012340021, name: 'Mahasiswa Uji 921', uts: 85.5, uas: 0 }]);
		const planChanged = await planSheet(ctx.db, inputFor(third, offering.id));
		expect(planChanged.rows[0].scores).toEqual([
			{ code: 'UTS-1', action: 'update', oldValue: 80, newValue: 85.5 },
			{ code: 'UAS-1', action: 'update', oldValue: 90, newValue: 0 }
		]);
		expect(planChanged.summary).toMatchObject({ scoresUpdated: 2, scoresNew: 0 });
	});

	test('perubahan bobot komponen existing terdeteksi', async () => {
		const offering = await createOffering(ctx.db);
		const { commitImport } = await import('#lib/features/imports/imports.commit.server.ts');
		const { createUser } = await import('../../support/factories.ts');
		const { createBatch } = await import('../../support/imports.ts');
		const actor = await createUser(ctx.db, { role: 'super_admin' });
		const batch = await createBatch(ctx.db, actor.id);
		await commitImport(ctx.db, {
			batchId: batch.id,
			actor: { id: actor.id, role: 'super_admin' },
			sheets: [inputFor(simpleSheet('Bobot', [{ nim: 99012340031, name: 'Mahasiswa Uji 931', uts: 80, uas: 90 }], [40, 60]), offering.id)],
			strategy: 'upsert',
			errorPolicy: 'block_on_error',
			confirmations: { scoreUpdates: true, weightChanges: true }
		});
		const changed = await planSheet(ctx.db, inputFor(simpleSheet('Bobot', [{ nim: 99012340031, name: 'Mahasiswa Uji 931', uts: 80, uas: 90 }], [50, 50]), offering.id));
		expect(changed.summary.weightChanges).toBe(2);
		expect(changed.components.map((c) => [c.code, c.action, c.existingWeightPercent])).toEqual([
			['UTS-1', 'weight_change', 40],
			['UAS-1', 'weight_change', 60]
		]);
	});
});

describe('gerbang commit', () => {
	test('sheet tanpa offering atau offering tidak ada ditahan', async () => {
		const unselected = await planSheet(ctx.db, inputFor(simpleSheet('Tanpa', [{ nim: 99012340041, name: 'Mahasiswa Uji 941', uts: 1, uas: 1 }]), null));
		expect(evaluateGate(unselected, openGate).map((b) => b.code)).toEqual(['OFFERING_NOT_SELECTED']);
		const missing = await planSheet(ctx.db, inputFor(simpleSheet('Hilang', [{ nim: 99012340042, name: 'Mahasiswa Uji 942', uts: 1, uas: 1 }]), '00000000-0000-4000-8000-000000000000'));
		expect(evaluateGate(missing, openGate).map((b) => b.code)).toEqual(['OFFERING_NOT_FOUND']);
	});

	test('galat tingkat sheet (bobot bukan 100) menahan commit walau kebijakan lewati baris bergalat', async () => {
		const offering = await createOffering(ctx.db);
		const plan = await planSheet(ctx.db, inputFor(simpleSheet('Bobot Salah', [{ nim: 99012340051, name: 'Mahasiswa Uji 951', uts: 70, uas: 70 }], [60, 60]), offering.id));
		expect(evaluateGate(plan, { ...openGate, errorPolicy: 'skip_invalid_rows' }).map((b) => b.code)).toContain('SHEET_ERRORS');
	});

	test('baris bergalat menahan commit atau dilewati sesuai kebijakan yang dipilih', async () => {
		const offering = await createOffering(ctx.db);
		const grid = simpleSheet('Campur', [
			{ nim: 99012340061, name: 'Mahasiswa Uji 961', uts: 70, uas: 70 },
			{ nim: 99012340062, name: 'Mahasiswa Uji 962', uts: 150, uas: 70 }
		]);
		const plan = await planSheet(ctx.db, inputFor(grid, offering.id));
		expect(plan.summary).toMatchObject({ rowsValid: 1, rowsRejected: 1 });
		expect(plan.rows).toHaveLength(1);
		expect(evaluateGate(plan, openGate).map((b) => b.code)).toEqual(['ROW_ERRORS']);
		expect(evaluateGate(plan, { ...openGate, errorPolicy: 'skip_invalid_rows' })).toEqual([]);
	});

	test('NIM bertipe angka wajib diakui; pembaruan nilai dan bobot wajib dikonfirmasi', async () => {
		const offering = await createOffering(ctx.db);
		const plan = await planSheet(ctx.db, inputFor(simpleSheet('Ack', [{ nim: 99012340071, name: 'Mahasiswa Uji 971', uts: 70, uas: 70 }]), offering.id));
		expect(evaluateGate(plan, { ...openGate, acknowledgements: { numericNim: false } }).map((b) => b.code)).toEqual(['NIM_NUMERIC_UNACKNOWLEDGED']);
		const updating = { ...plan, summary: { ...plan.summary, scoresUpdated: 3, weightChanges: 1 } };
		expect(evaluateGate(updating, { ...openGate, confirmations: { scoreUpdates: false, weightChanges: false } }).map((b) => b.code)).toEqual(['SCORE_UPDATES_UNCONFIRMED', 'WEIGHT_CHANGES_UNCONFIRMED']);
	});

	test('sheet yang tidak disertakan tidak menghasilkan penghalang', async () => {
		const plan = await planSheet(ctx.db, inputFor(simpleSheet('Lewati', [{ nim: 99012340081, name: 'Mahasiswa Uji 981', uts: 1, uas: 1 }]), null, { include: false }));
		expect(evaluateGate(plan, openGate)).toEqual([]);
	});
});

describe('ringkasan lintas sheet', () => {
	test('mahasiswa yang sama di dua offering dihitung baru satu kali', async () => {
		const course = await createCourse(ctx.db);
		const offeringA = await createOffering(ctx.db, { courseId: course.id });
		const offeringB = await createOffering(ctx.db);
		const rows = [{ nim: 99012340091, name: 'Mahasiswa Uji 991', uts: 70, uas: 80 }];
		const plans = [await planSheet(ctx.db, inputFor(simpleSheet('A', rows), offeringA.id)), await planSheet(ctx.db, inputFor(simpleSheet('B', rows), offeringB.id))];
		const total = summarizePlans(plans);
		expect(total).toMatchObject({ studentsNew: 1, studentsExisting: 0, enrollmentsNew: 2, scoresNew: 4 });
	});
});
