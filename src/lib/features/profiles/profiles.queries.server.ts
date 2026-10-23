import { asc, eq } from 'drizzle-orm';
import type { DbExecutor } from '#lib/shared/db/client.server.ts';
import { cplDefinitions } from '#lib/features/curriculum/curriculum.schema.ts';
import { careerFields, cplProfileLinks, graduateProfiles, profileCareerLinks } from './profiles.schema.ts';
import type { CareerFieldView, CplMatrixRow, GraduateProfileView, ProgramBlueprintView } from './profiles.types.ts';

export async function getProgramBlueprint(db: DbExecutor): Promise<ProgramBlueprintView> {
	const [profileRows, fieldRows, cplRows, cplLinkRows, fieldLinkRows] = await Promise.all([
		db.select().from(graduateProfiles).orderBy(asc(graduateProfiles.sortOrder), asc(graduateProfiles.code)),
		db.select().from(careerFields).orderBy(asc(careerFields.sortOrder), asc(careerFields.code)),
		db.select().from(cplDefinitions).where(eq(cplDefinitions.isActive, true)).orderBy(asc(cplDefinitions.sortOrder), asc(cplDefinitions.code)),
		db.select({ cplId: cplProfileLinks.cplId, profileId: cplProfileLinks.profileId }).from(cplProfileLinks),
		db.select({ profileId: profileCareerLinks.profileId, careerFieldId: profileCareerLinks.careerFieldId, relevance: profileCareerLinks.relevance }).from(profileCareerLinks)
	]);

	const profileById = new Map(profileRows.map((row) => [row.id, row]));
	const cplById = new Map(cplRows.map((row) => [row.id, row]));
	const fieldById = new Map(fieldRows.map((row) => [row.id, row]));

	const profiles: GraduateProfileView[] = profileRows.map((profile) => ({
		id: profile.id,
		code: profile.code,
		name: profile.name,
		summary: profile.summary,
		creditEstimate: profile.creditEstimate,
		cpl: cplLinkRows
			.filter((link) => link.profileId === profile.id && cplById.has(link.cplId))
			.map((link) => cplById.get(link.cplId)!)
			.sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
			.map((cpl) => ({ code: cpl.code, title: cpl.title })),
		fields: fieldLinkRows
			.filter((link) => link.profileId === profile.id && fieldById.has(link.careerFieldId))
			.map((link) => ({ code: fieldById.get(link.careerFieldId)!.code, name: fieldById.get(link.careerFieldId)!.name, relevance: link.relevance }))
			.sort((a, b) => b.relevance - a.relevance || a.code.localeCompare(b.code))
	}));

	const fields: CareerFieldView[] = fieldRows.map((field) => ({
		id: field.id,
		code: field.code,
		name: field.name,
		profiles: fieldLinkRows
			.filter((link) => link.careerFieldId === field.id && profileById.has(link.profileId))
			.map((link) => ({ code: profileById.get(link.profileId)!.code, name: profileById.get(link.profileId)!.name, relevance: link.relevance }))
			.sort((a, b) => b.relevance - a.relevance || a.code.localeCompare(b.code))
	}));

	const cpl: CplMatrixRow[] = cplRows.map((row) => ({
		id: row.id,
		code: row.code,
		title: row.title,
		graduateAttributes: row.graduateAttributes,
		knowledgeProfiles: row.knowledgeProfiles,
		profileCodes: cplLinkRows
			.filter((link) => link.cplId === row.id && profileById.has(link.profileId))
			.map((link) => profileById.get(link.profileId)!.code)
			.sort()
	}));

	return {
		profiles,
		fields,
		cpl,
		unmappedCpl: cpl.filter((row) => row.profileCodes.length === 0).map((row) => row.code),
		profilesWithoutCpl: profiles.filter((profile) => profile.cpl.length === 0).map((profile) => profile.code)
	};
}
