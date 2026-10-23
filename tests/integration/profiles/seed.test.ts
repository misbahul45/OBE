import { describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { seedProgramBlueprint } from '#lib/features/profiles/index.server.ts';
import { getProgramBlueprint } from '#lib/features/profiles/index.server.ts';
import { careerFields, cplDefinitions, cplProfileLinks, graduateProfiles, profileCareerLinks } from '#lib/shared/db/schema.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { expectDatabaseRejection } from '../../support/postgres-error.ts';

const ctx = useIsolatedDatabase('profiles_seed');

const counts = async () => ({
	cpl: (await ctx.db.select().from(cplDefinitions)).length,
	profiles: (await ctx.db.select().from(graduateProfiles)).length,
	fields: (await ctx.db.select().from(careerFields)).length,
	cplLinks: (await ctx.db.select().from(cplProfileLinks)).length,
	fieldLinks: (await ctx.db.select().from(profileCareerLinks)).length
});

describe('seedProgramBlueprint', () => {
	test('database kosong: membuat 8 CPL, 4 profil, 7 bidang kerja, 8 tautan CPL-profil, dan 11 tautan profil-bidang', async () => {
		const result = await seedProgramBlueprint(ctx.db);
		expect(result.cpl).toEqual({ created: 8, existing: 0 });
		expect(result.profiles).toEqual({ created: 4, existing: 0 });
		expect(result.fields).toEqual({ created: 7, existing: 0 });
		expect(result.cplProfileLinks).toEqual({ created: 8, existing: 0 });
		expect(result.profileFieldLinks).toEqual({ created: 11, existing: 0 });
		expect(await counts()).toEqual({ cpl: 8, profiles: 4, fields: 7, cplLinks: 8, fieldLinks: 11 });
	});

	test('dijalankan ulang tidak mengubah apa pun (idempoten)', async () => {
		const before = await counts();
		const result = await seedProgramBlueprint(ctx.db);
		expect(result.cpl).toEqual({ created: 0, existing: 8 });
		expect(result.cplProfileLinks).toEqual({ created: 0, existing: 8 });
		expect(result.profileFieldLinks).toEqual({ created: 0, existing: 11 });
		expect(await counts()).toEqual(before);
	});

	test('CPL yang sudah ada tidak ditimpa tanpa overwrite, tetapi atribut kosong dilengkapi', async () => {
		await ctx.db.update(cplDefinitions).set({ title: 'Judul sunting manual' }).where(eq(cplDefinitions.code, 'CPL-2'));
		await ctx.db.update(cplDefinitions).set({ graduateAttributes: [], knowledgeProfiles: ['WK-8'] }).where(eq(cplDefinitions.code, 'CPL-2'));
		await seedProgramBlueprint(ctx.db);
		const [row] = await ctx.db.select().from(cplDefinitions).where(eq(cplDefinitions.code, 'CPL-2'));
		expect(row.title).toBe('Judul sunting manual');
		expect(row.graduateAttributes).toEqual(['WA-1', 'WA-5']);
		expect(row.knowledgeProfiles).toEqual(['WK-8']);
	});

	test('dengan overwrite, judul dan atribut dikembalikan ke blueprint', async () => {
		await seedProgramBlueprint(ctx.db, { overwrite: true });
		const [row] = await ctx.db.select().from(cplDefinitions).where(eq(cplDefinitions.code, 'CPL-2'));
		expect(row.title).toContain('Menerapkan matematika');
		expect(row.knowledgeProfiles).toEqual(['WK-1', 'WK-2', 'WK-3', 'WK-4']);
	});

	test('tampilan blueprint: CPL-1 ditandai belum terpetakan dan CPL-6 muncul pada dua profil', async () => {
		const view = await getProgramBlueprint(ctx.db);
		expect(view.unmappedCpl).toEqual(['CPL-1']);
		expect(view.profilesWithoutCpl).toEqual([]);
		const pl3 = view.profiles.find((profile) => profile.code === 'PL3');
		expect(pl3?.cpl.map((item) => item.code)).toEqual(['CPL-6', 'CPL-8']);
		expect(pl3?.fields.map((field) => `${field.code}:${field.relevance}`)).toEqual(['BK5:3', 'BK6:3', 'BK2:1', 'BK7:1']);
		expect(view.cpl.find((row) => row.code === 'CPL-6')?.profileCodes).toEqual(['PL3', 'PL4']);
		expect(view.fields.find((field) => field.code === 'BK7')?.profiles.map((p) => p.code)).toEqual(['PL4', 'PL3']);
	});

	test('menghapus CPL ikut menghapus tautannya; kode di luar format ditolak database', async () => {
		await ctx.db.delete(cplDefinitions).where(eq(cplDefinitions.code, 'CPL-6'));
		expect((await ctx.db.select().from(cplProfileLinks)).length).toBe(6);
		const profileFailure = await expectDatabaseRejection(() => ctx.db.insert(graduateProfiles).values({ code: 'X1', name: 'Salah' }));
		expect(profileFailure.constraint).toBe('graduate_profiles_code_format');
		const fieldFailure = await expectDatabaseRejection(() => ctx.db.insert(careerFields).values({ code: 'PL9', name: 'Salah' }));
		expect(fieldFailure.constraint).toBe('career_fields_code_format');
	});
});
