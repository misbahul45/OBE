import { beforeAll, describe, expect, test } from 'bun:test';
import { activateSemester, assignLecturer } from '#lib/features/academic/index.server.ts';
import { adminDashboard, lecturerDashboard, listCourseSummaries, recentImports } from '#lib/features/dashboard/index.server.ts';
import { recomputeOffering } from '#lib/features/outcomes/index.server.ts';
import { assessmentScores } from '#lib/shared/db/schema.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { createBatch } from '../../support/imports.ts';
import { createComponent, createEnrollment, createLecturer, createOffering, createStudent, createTerm, createUser } from '../../support/factories.ts';

const ctx = useIsolatedDatabase('dashboard_kpi');
let admin: { id: string; role: string };

beforeAll(async () => {
	const row = await createUser(ctx.db, { role: 'super_admin' });
	admin = { id: row.id, role: 'super_admin' };
});

describe('tanpa semester aktif', () => {
	test('ringkasan kelas kosong dan KPI program bernilai nol, bukan galat', async () => {
		const summaries = await listCourseSummaries(ctx.db, admin);
		expect(summaries).toEqual({ semester: null, rows: [] });
		const dashboard = await adminDashboard(ctx.db, admin);
		expect(dashboard.program.semester).toBeNull();
		expect(dashboard.program.totals).toMatchObject({ offerings: 0, lecturers: 0, students: 0, enrollments: 0 });
	});
});

describe('dengan semester aktif', () => {
	let scene: Awaited<ReturnType<typeof build>>;

	async function build() {
		const { semester } = await createTerm(ctx.db, { status: 'planned' });
		await activateSemester(ctx.db, admin, semester.id);
		const a = await createLecturer(ctx.db);
		const b = await createLecturer(ctx.db);
		const okOffering = await createOffering(ctx.db, { semesterId: semester.id });
		const emptyOffering = await createOffering(ctx.db, { semesterId: semester.id });
		const incompleteOffering = await createOffering(ctx.db, { semesterId: semester.id });
		const mismatchOffering = await createOffering(ctx.db, { semesterId: semester.id });
		await assignLecturer(ctx.db, admin, { offeringId: okOffering.id, lecturerId: a.lecturer.id });
		await assignLecturer(ctx.db, admin, { offeringId: emptyOffering.id, lecturerId: a.lecturer.id });
		await assignLecturer(ctx.db, admin, { offeringId: incompleteOffering.id, lecturerId: b.lecturer.id });
		await assignLecturer(ctx.db, admin, { offeringId: mismatchOffering.id, lecturerId: b.lecturer.id });

		const uts = await createComponent(ctx.db, { offeringId: okOffering.id, code: 'UTS', weightPercent: 40 });
		const uas = await createComponent(ctx.db, { offeringId: okOffering.id, code: 'UAS', weightPercent: 60 });
		await createComponent(ctx.db, { offeringId: incompleteOffering.id, code: 'UTS', weightPercent: 50 });
		await createComponent(ctx.db, { offeringId: incompleteOffering.id, code: 'UAS', weightPercent: null });
		await createComponent(ctx.db, { offeringId: mismatchOffering.id, code: 'UTS', weightPercent: 60 });
		for (const [x, y] of [[80, 70], [60, 50]]) {
			const enrollment = await createEnrollment(ctx.db, { offeringId: okOffering.id, studentId: (await createStudent(ctx.db)).id });
			await ctx.db.insert(assessmentScores).values([{ enrollmentId: enrollment.id, componentId: uts.id, score: x }, { enrollmentId: enrollment.id, componentId: uas.id, score: y }]);
		}
		await recomputeOffering(ctx.db, admin, okOffering.id, 'uji');
		return { semester, a: { id: a.account.id, role: 'lecturer' }, b: { id: b.account.id, role: 'lecturer' }, okOffering, emptyOffering, incompleteOffering, mismatchOffering };
	}

	beforeAll(async () => {
		scene = await build();
	});

	test('dosen hanya melihat kelasnya dengan status bobot yang jujur', async () => {
		const mine = await listCourseSummaries(ctx.db, scene.a);
		expect(mine.semester?.id).toBe(scene.semester.id);
		const byId = Object.fromEntries(mine.rows.map((r) => [r.offeringId, r]));
		expect(Object.keys(byId).sort()).toEqual([scene.okOffering.id, scene.emptyOffering.id].sort());
		expect(byId[scene.okOffering.id]).toMatchObject({ students: 2, components: 2, weightsState: 'ok', finalMean: 64 });
		expect(byId[scene.emptyOffering.id]).toMatchObject({ students: 0, components: 0, weightsState: 'none', finalMean: null });
		expect(byId[scene.emptyOffering.id].warnings.length).toBeGreaterThan(0);

		const theirs = await listCourseSummaries(ctx.db, scene.b);
		const states = Object.fromEntries(theirs.rows.map((r) => [r.offeringId, r.weightsState]));
		expect(states).toEqual({ [scene.incompleteOffering.id]: 'incomplete', [scene.mismatchOffering.id]: 'mismatch' });
	});

	test('Super Admin melihat semua kelas semester aktif dan KPI program sesuai data', async () => {
		expect((await listCourseSummaries(ctx.db, admin)).rows).toHaveLength(4);
		const { program } = await adminDashboard(ctx.db, admin);
		expect(program.totals).toMatchObject({ offerings: 4, lecturers: 2, students: 2, enrollments: 2 });
		const reasons = Object.fromEntries(program.attention.map((x) => [x.offeringId, x.reason]));
		expect(reasons[scene.emptyOffering.id]).toBe('Belum ada nilai yang diimpor');
		expect(reasons[scene.okOffering.id]).toBe('Nilai ada tetapi hasil CPL belum terhitung; periksa komponen, bobot, dan pemetaan CPMK');
	});

	test('impor terbaru dibatasi pada milik pengguna, Super Admin melihat semuanya terurut terbaru', async () => {
		const first = await createBatch(ctx.db, scene.a.id, { fileName: 'a-1.xlsx', createdAt: new Date('2026-01-01T00:00:00Z') });
		const second = await createBatch(ctx.db, scene.b.id, { fileName: 'b-1.xlsx', createdAt: new Date('2026-01-02T00:00:00Z') });
		const third = await createBatch(ctx.db, scene.a.id, { fileName: 'a-2.xlsx', createdAt: new Date('2026-01-03T00:00:00Z') });
		expect((await recentImports(ctx.db, scene.a)).map((r) => r.id)).toEqual([third.id, first.id]);
		expect((await recentImports(ctx.db, scene.b)).map((r) => r.id)).toEqual([second.id]);
		expect((await recentImports(ctx.db, admin, 2)).map((r) => r.id)).toEqual([third.id, second.id]);
		const dashboard = await lecturerDashboard(ctx.db, scene.b);
		expect(dashboard.imports.map((r) => r.fileName)).toEqual(['b-1.xlsx']);
		expect(dashboard.rows).toHaveLength(2);
	});
});
