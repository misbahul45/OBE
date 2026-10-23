import { describe, expect, test } from 'bun:test';
import { and, asc, eq } from 'drizzle-orm';
import { assessmentComponents, assessmentScoreRevisions, assessmentScores } from '#lib/shared/db/schema.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { createComponent, createEnrollment, createOffering, createUser } from '../../support/factories.ts';
import { expectDatabaseRejection, pgCodes } from '../../support/postgres-error.ts';

const ctx = useIsolatedDatabase('assessment_schema');

async function scene() {
	const offering = await createOffering(ctx.db);
	const component = await createComponent(ctx.db, { offeringId: offering.id });
	const enrollment = await createEnrollment(ctx.db, { offeringId: offering.id });
	return { offering, component, enrollment };
}

describe('assessment_components', () => {
	test('kode komponen unik per offering, tetapi boleh sama antar offering', async () => {
		const { offering } = await scene();
		await createComponent(ctx.db, { offeringId: offering.id, code: 'UTS' });
		const failure = await expectDatabaseRejection(() => createComponent(ctx.db, { offeringId: offering.id, code: 'UTS' }));
		expect(failure.code).toBe(pgCodes.uniqueViolation);
		const other = await createOffering(ctx.db);
		await createComponent(ctx.db, { offeringId: other.id, code: 'UTS' });
	});

	test('bobot di luar 0 sampai 100 ditolak, bobot kosong berarti belum dikonfigurasi', async () => {
		const { offering } = await scene();
		const failure = await expectDatabaseRejection(() => createComponent(ctx.db, { offeringId: offering.id, weightPercent: 101 }));
		expect(failure.constraint).toBe('assessment_components_weight_range');
		const unset = await createComponent(ctx.db, { offeringId: offering.id });
		expect(unset.weightPercent).toBeNull();
	});
});

describe('assessment_scores', () => {
	test('nilai 0 tersimpan sebagai 0 dan berbeda dari kosong', async () => {
		const { component, enrollment } = await scene();
		const other = await createComponent(ctx.db, { offeringId: component.offeringId });
		await ctx.db.insert(assessmentScores).values([
			{ enrollmentId: enrollment.id, componentId: component.id, score: 0 },
			{ enrollmentId: enrollment.id, componentId: other.id, score: null }
		]);
		const rows = await ctx.db.select().from(assessmentScores).where(eq(assessmentScores.enrollmentId, enrollment.id));
		const byComponent = new Map(rows.map((r) => [r.componentId, r.score]));
		expect(byComponent.get(component.id)).toBe(0);
		expect(byComponent.get(other.id)).toBeNull();
	});

	test('satu skor per enrollment dan komponen', async () => {
		const { component, enrollment } = await scene();
		await ctx.db.insert(assessmentScores).values({ enrollmentId: enrollment.id, componentId: component.id, score: 80 });
		const failure = await expectDatabaseRejection(() =>
			ctx.db.insert(assessmentScores).values({ enrollmentId: enrollment.id, componentId: component.id, score: 90 })
		);
		expect(failure.code).toBe(pgCodes.uniqueViolation);
	});

	test('upsert berbasis kunci domain memperbarui baris yang sama', async () => {
		const { component, enrollment } = await scene();
		const values = { enrollmentId: enrollment.id, componentId: component.id };
		await ctx.db.insert(assessmentScores).values({ ...values, score: 70 });
		await ctx.db
			.insert(assessmentScores)
			.values({ ...values, score: 85.5 })
			.onConflictDoUpdate({ target: [assessmentScores.enrollmentId, assessmentScores.componentId], set: { score: 85.5 } });
		const rows = await ctx.db.select().from(assessmentScores).where(and(eq(assessmentScores.enrollmentId, enrollment.id), eq(assessmentScores.componentId, component.id)));
		expect(rows.length).toBe(1);
		expect(rows[0].score).toBe(85.5);
	});

	test('nilai negatif ditolak', async () => {
		const { component, enrollment } = await scene();
		const failure = await expectDatabaseRejection(() =>
			ctx.db.insert(assessmentScores).values({ enrollmentId: enrollment.id, componentId: component.id, score: -1 })
		);
		expect(failure.constraint).toBe('assessment_scores_non_negative');
	});
});

describe('assessment_revisions', () => {
	test('riwayat perubahan menyimpan nilai lama, nilai baru, dan pelaku berurutan waktu', async () => {
		const { component, enrollment } = await scene();
		const actor = await createUser(ctx.db);
		const keys = { enrollmentId: enrollment.id, componentId: component.id, actorId: actor.id };
		await ctx.db.insert(assessmentScoreRevisions).values({ ...keys, oldScore: null, newScore: 70, changeType: 'import_initial' });
		await ctx.db.insert(assessmentScoreRevisions).values({ ...keys, oldScore: 70, newScore: 75, changeType: 'import_update', reason: 'koreksi dosen' });
		const rows = await ctx.db.select().from(assessmentScoreRevisions).where(eq(assessmentScoreRevisions.enrollmentId, enrollment.id)).orderBy(asc(assessmentScoreRevisions.createdAt));
		expect(rows.map((r) => [r.oldScore, r.newScore, r.changeType])).toEqual([
			[null, 70, 'import_initial'],
			[70, 75, 'import_update']
		]);
	});

	test('komponen yang punya riwayat tidak dapat dihapus', async () => {
		const { component, enrollment } = await scene();
		await ctx.db.insert(assessmentScoreRevisions).values({ enrollmentId: enrollment.id, componentId: component.id, newScore: 10, changeType: 'import_initial' });
		const failure = await expectDatabaseRejection(() => ctx.db.delete(assessmentComponents).where(eq(assessmentComponents.id, component.id)));
		expect(failure.code).toBe(pgCodes.foreignKeyViolation);
	});
});
