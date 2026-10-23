import { inArray, sql } from 'drizzle-orm';
import type { Database } from '#lib/shared/db/client.server.ts';
import { cplDefinitions } from '#lib/features/curriculum/curriculum.schema.ts';
import { programBlueprint } from './profiles.blueprint.ts';
import { careerFields, cplProfileLinks, graduateProfiles, profileCareerLinks } from './profiles.schema.ts';
import type { BlueprintSeedResult } from './profiles.types.ts';

export type BlueprintSeedOptions = { overwrite?: boolean };

const tally = (codes: string[], existing: Set<string>) => {
	const present = codes.filter((code) => existing.has(code)).length;
	return { created: codes.length - present, existing: present };
};

export async function seedProgramBlueprint(db: Database, options: BlueprintSeedOptions = {}): Promise<BlueprintSeedResult> {
	const overwrite = options.overwrite ?? false;
	const blueprint = programBlueprint;

	return db.transaction(async (tx) => {
		const existingCpl = new Set((await tx.select({ code: cplDefinitions.code }).from(cplDefinitions)).map((row) => row.code));
		const existingProfiles = new Set((await tx.select({ code: graduateProfiles.code }).from(graduateProfiles)).map((row) => row.code));
		const existingFields = new Set((await tx.select({ code: careerFields.code }).from(careerFields)).map((row) => row.code));

		for (const item of blueprint.cpl) {
			const values = { code: item.code, title: item.title, graduateAttributes: item.graduateAttributes, knowledgeProfiles: item.knowledgeProfiles, sortOrder: item.sortOrder };
			await tx
				.insert(cplDefinitions)
				.values(values)
				.onConflictDoUpdate({
					target: cplDefinitions.code,
					set: overwrite
						? { title: values.title, graduateAttributes: values.graduateAttributes, knowledgeProfiles: values.knowledgeProfiles, sortOrder: values.sortOrder }
						: {
								graduateAttributes: sql`case when cardinality(${cplDefinitions.graduateAttributes}) = 0 then excluded.graduate_attributes else ${cplDefinitions.graduateAttributes} end`,
								knowledgeProfiles: sql`case when cardinality(${cplDefinitions.knowledgeProfiles}) = 0 then excluded.knowledge_profiles else ${cplDefinitions.knowledgeProfiles} end`
							}
				});
		}

		for (const item of blueprint.profiles) {
			await tx
				.insert(graduateProfiles)
				.values(item)
				.onConflictDoUpdate({
					target: graduateProfiles.code,
					set: overwrite ? { name: item.name, summary: item.summary, creditEstimate: item.creditEstimate, sortOrder: item.sortOrder } : { code: item.code }
				});
		}

		for (const item of blueprint.fields) {
			await tx
				.insert(careerFields)
				.values(item)
				.onConflictDoUpdate({ target: careerFields.code, set: overwrite ? { name: item.name, sortOrder: item.sortOrder } : { code: item.code } });
		}

		const cplRows = await tx.select({ id: cplDefinitions.id, code: cplDefinitions.code }).from(cplDefinitions).where(inArray(cplDefinitions.code, blueprint.cpl.map((c) => c.code)));
		const profileRows = await tx.select({ id: graduateProfiles.id, code: graduateProfiles.code }).from(graduateProfiles);
		const fieldRows = await tx.select({ id: careerFields.id, code: careerFields.code }).from(careerFields);
		const cplId = new Map(cplRows.map((row) => [row.code, row.id]));
		const profileId = new Map(profileRows.map((row) => [row.code, row.id]));
		const fieldId = new Map(fieldRows.map((row) => [row.code, row.id]));

		const existingCplLinks = new Set(
			(await tx.select({ cplId: cplProfileLinks.cplId, profileId: cplProfileLinks.profileId }).from(cplProfileLinks)).map((row) => `${row.cplId}:${row.profileId}`)
		);
		const existingFieldLinks = new Set(
			(await tx.select({ profileId: profileCareerLinks.profileId, careerFieldId: profileCareerLinks.careerFieldId }).from(profileCareerLinks)).map((row) => `${row.profileId}:${row.careerFieldId}`)
		);

		let cplLinksCreated = 0;
		for (const link of blueprint.cplProfileLinks) {
			const cplKey = cplId.get(link.cpl);
			const profileKey = profileId.get(link.profile);
			if (!cplKey || !profileKey) throw new Error(`Tautan CPL-profil merujuk kode yang tidak ada: ${link.cpl} ${link.profile}`);
			if (existingCplLinks.has(`${cplKey}:${profileKey}`)) continue;
			await tx.insert(cplProfileLinks).values({ cplId: cplKey, profileId: profileKey }).onConflictDoNothing();
			cplLinksCreated += 1;
		}

		let fieldLinksCreated = 0;
		for (const link of blueprint.profileFieldLinks) {
			const profileKey = profileId.get(link.profile);
			const fieldKey = fieldId.get(link.field);
			if (!profileKey || !fieldKey) throw new Error(`Tautan profil-bidang merujuk kode yang tidak ada: ${link.profile} ${link.field}`);
			const present = existingFieldLinks.has(`${profileKey}:${fieldKey}`);
			if (present && !overwrite) continue;
			await tx
				.insert(profileCareerLinks)
				.values({ profileId: profileKey, careerFieldId: fieldKey, relevance: link.relevance })
				.onConflictDoUpdate({ target: [profileCareerLinks.profileId, profileCareerLinks.careerFieldId], set: { relevance: link.relevance } });
			if (!present) fieldLinksCreated += 1;
		}

		return {
			cpl: tally(blueprint.cpl.map((c) => c.code), existingCpl),
			profiles: tally(blueprint.profiles.map((p) => p.code), existingProfiles),
			fields: tally(blueprint.fields.map((f) => f.code), existingFields),
			cplProfileLinks: { created: cplLinksCreated, existing: blueprint.cplProfileLinks.length - cplLinksCreated },
			profileFieldLinks: { created: fieldLinksCreated, existing: blueprint.profileFieldLinks.length - fieldLinksCreated }
		};
	});
}
