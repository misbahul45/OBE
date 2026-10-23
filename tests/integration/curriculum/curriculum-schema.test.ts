import { describe, expect, test } from 'bun:test';
import { cplDefinitions, cpmkDefinitions, outcomePolicies } from '#lib/shared/db/schema.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { createCourse } from '../../support/factories.ts';
import { expectDatabaseRejection, pgCodes } from '../../support/postgres-error.ts';

const ctx = useIsolatedDatabase('curriculum_schema');

describe('outcome_policies', () => {
	test('hanya satu kebijakan aktif; kebijakan draft dan pensiun boleh banyak', async () => {
		await ctx.db.insert(outcomePolicies).values({ version: 1, name: 'v1', status: 'active' });
		await ctx.db.insert(outcomePolicies).values({ version: 2, name: 'v2', status: 'draft' });
		await ctx.db.insert(outcomePolicies).values({ version: 3, name: 'v3', status: 'retired' });
		const failure = await expectDatabaseRejection(() => ctx.db.insert(outcomePolicies).values({ version: 4, name: 'v4', status: 'active' }));
		expect(failure.constraint).toBe('outcome_policies_single_active');
	});

	test('versi kebijakan unik dan nilai ambang kosong berarti belum dikonfigurasi', async () => {
		const failure = await expectDatabaseRejection(() => ctx.db.insert(outcomePolicies).values({ version: 1, name: 'dobel' }));
		expect(failure.code).toBe(pgCodes.uniqueViolation);
		const [draft] = await ctx.db.insert(outcomePolicies).values({ version: 10, name: 'tanpa ambang' }).returning();
		expect(draft.achievementThreshold).toBeNull();
		expect(draft.aggregationMethod).toBe('not_configured');
	});
});

describe('cpl_definitions dan cpmk_definitions', () => {
	test('kode CPL wajib berformat CPL-n dan unik', async () => {
		await ctx.db.insert(cplDefinitions).values({ code: 'CPL-1', title: 'Contoh' });
		const duplicate = await expectDatabaseRejection(() => ctx.db.insert(cplDefinitions).values({ code: 'CPL-1', title: 'Dobel' }));
		expect(duplicate.code).toBe(pgCodes.uniqueViolation);
		for (const code of ['CPL1', 'cpl-2', 'CPL 3', 'CPL-']) {
			const failure = await expectDatabaseRejection(() => ctx.db.insert(cplDefinitions).values({ code, title: 'Salah format' }));
			expect(failure.constraint).toBe('cpl_definitions_code_format');
		}
	});

	test('CPMK unik per mata kuliah, boleh sama di mata kuliah lain', async () => {
		const first = await createCourse(ctx.db);
		const second = await createCourse(ctx.db);
		await ctx.db.insert(cpmkDefinitions).values({ courseId: first.id, code: 'CPMK-1' });
		await ctx.db.insert(cpmkDefinitions).values({ courseId: second.id, code: 'CPMK-1' });
		const failure = await expectDatabaseRejection(() => ctx.db.insert(cpmkDefinitions).values({ courseId: first.id, code: 'CPMK-1' }));
		expect(failure.code).toBe(pgCodes.uniqueViolation);
	});
});
