import { describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { assessmentComponents, assessmentScoreRevisions, assessmentScores, auditLogs, cplResults, cpmkResults, enrollments, importBatches, students } from '#lib/shared/db/schema.ts';
import { commitImport, type CommitParams } from '#lib/features/imports/imports.commit.server.ts';
import { readWorkbook } from '#lib/features/imports/workbook-reader.server.ts';
import type { SheetGrid } from '#lib/features/imports/imports.types.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { createOffering, createUser } from '../../support/factories.ts';
import { createBatch, defineOutcomes, inputFor, rowCount } from '../../support/imports.ts';
import { buildSemesterWorkbook } from '../../fixtures/builders/templates.ts';

const ctx = useIsolatedDatabase('imports_idem');
const [semesterA]: SheetGrid[] = readWorkbook(buildSemesterWorkbook(), 's.xlsx').sheets;

async function paramsFor(offeringId: string, grid: SheetGrid): Promise<CommitParams> {
	const user = await createUser(ctx.db, { role: 'super_admin' });
	const batch = await createBatch(ctx.db, user.id);
	return {
		batchId: batch.id,
		actor: { id: user.id, role: 'super_admin' },
		sheets: [inputFor(grid, offeringId)],
		strategy: 'upsert',
		errorPolicy: 'block_on_error',
		confirmations: { scoreUpdates: true, weightChanges: true }
	};
}

const snapshot = async () => ({
	students: await rowCount(ctx.db, students),
	enrollments: await rowCount(ctx.db, enrollments),
	components: await rowCount(ctx.db, assessmentComponents),
	scores: await rowCount(ctx.db, assessmentScores),
	revisions: await rowCount(ctx.db, assessmentScoreRevisions),
	cpmk: await rowCount(ctx.db, cpmkResults),
	cpl: await rowCount(ctx.db, cplResults)
});

describe('impor ulang file identik', () => {
	test('tidak menggandakan data akademik; semua nilai dilaporkan tidak berubah', async () => {
		const offering = await createOffering(ctx.db);
		await defineOutcomes(ctx.db, offering.courseId, ['CPMK-1', 'CPMK-2', 'CPMK-3', 'CPMK-4', 'CPMK-5'], ['CPL-1']);
		const first = await commitImport(ctx.db, await paramsFor(offering.id, semesterA));
		expect(first.summary).toMatchObject({ studentsNew: 15, enrollmentsNew: 15, scoresNew: 120, referencesNew: 90 });
		const afterFirst = await snapshot();

		const secondParams = await paramsFor(offering.id, semesterA);
		const second = await commitImport(ctx.db, secondParams);
		expect(second.summary).toMatchObject({
			studentsNew: 0,
			studentsExisting: 15,
			enrollmentsNew: 0,
			enrollmentsExisting: 15,
			scoresNew: 0,
			scoresUpdated: 0,
			scoresUnchanged: 120,
			referencesNew: 0,
			referencesUpdated: 0,
			referencesUnchanged: 90,
			componentsNew: 0
		});
		expect(await snapshot()).toEqual(afterFirst);

		const updateAudits = await ctx.db.select().from(auditLogs).where(eq(auditLogs.batchId, secondParams.batchId));
		expect(updateAudits.some((l) => l.action === 'assessment_score.update')).toBe(false);
		const [batch] = await ctx.db.select().from(importBatches).where(eq(importBatches.id, secondParams.batchId));
		expect(batch).toMatchObject({ status: 'committed', scoresInserted: 0, scoresUpdated: 0, scoresUnchanged: 120 });
	});

	test('mengimpor file yang sama ke offering lain membuat enrollment baru tanpa menggandakan mahasiswa', async () => {
		const other = await createOffering(ctx.db);
		const before = await snapshot();
		const result = await commitImport(ctx.db, await paramsFor(other.id, semesterA));
		expect(result.summary).toMatchObject({ studentsNew: 0, studentsExisting: 15, enrollmentsNew: 15, scoresNew: 120 });
		const after = await snapshot();
		expect(after.students).toBe(before.students);
		expect(after.enrollments).toBe(before.enrollments + 15);
		expect(after.scores).toBe(before.scores + 120);
	});
});

describe('dua impor bersamaan pada offering dan mahasiswa yang sama', () => {
	test('constraint database menjamin tidak ada duplikat dan total penambahan sama dengan satu impor', async () => {
		const offering = await createOffering(ctx.db);
		const [a, b] = await Promise.all([paramsFor(offering.id, semesterA), paramsFor(offering.id, semesterA)]);
		const studentsBefore = await rowCount(ctx.db, students);
		const settled = await Promise.allSettled([commitImport(ctx.db, a), commitImport(ctx.db, b)]);
		const fulfilled = settled.filter((s): s is PromiseFulfilledResult<Awaited<ReturnType<typeof commitImport>>> => s.status === 'fulfilled');
		expect(settled.filter((s) => s.status === 'rejected').map((s) => String((s as PromiseRejectedResult).reason))).toEqual([]);
		expect(fulfilled).toHaveLength(2);

		const scoresNew = fulfilled.reduce((sum, f) => sum + f.value.summary.scoresNew, 0);
		const enrollmentsNew = fulfilled.reduce((sum, f) => sum + f.value.summary.enrollmentsNew, 0);
		expect(scoresNew).toBe(120);
		expect(enrollmentsNew).toBe(15);
		expect(await rowCount(ctx.db, students)).toBe(studentsBefore);
		const rows = await ctx.db.select().from(enrollments).where(eq(enrollments.offeringId, offering.id));
		expect(rows).toHaveLength(15);
		const components = await ctx.db.select().from(assessmentComponents).where(eq(assessmentComponents.offeringId, offering.id));
		expect(components).toHaveLength(8);
	});
});
