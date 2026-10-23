export type ProfileCplView = { code: string; title: string };
export type ProfileFieldView = { code: string; name: string; relevance: number };

export type GraduateProfileView = {
	id: string;
	code: string;
	name: string;
	summary: string | null;
	creditEstimate: string | null;
	cpl: ProfileCplView[];
	fields: ProfileFieldView[];
};

export type CareerFieldView = {
	id: string;
	code: string;
	name: string;
	profiles: { code: string; name: string; relevance: number }[];
};

export type CplMatrixRow = {
	id: string;
	code: string;
	title: string;
	graduateAttributes: string[];
	knowledgeProfiles: string[];
	profileCodes: string[];
};

export type ProgramBlueprintView = {
	profiles: GraduateProfileView[];
	fields: CareerFieldView[];
	cpl: CplMatrixRow[];
	unmappedCpl: string[];
	profilesWithoutCpl: string[];
};

export type BlueprintSeedResult = {
	cpl: { created: number; existing: number };
	profiles: { created: number; existing: number };
	fields: { created: number; existing: number };
	cplProfileLinks: { created: number; existing: number };
	profileFieldLinks: { created: number; existing: number };
};
