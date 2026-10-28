export type BlueprintComponentLink = { componentCode: string; coefficient: number };

export type BlueprintCpmk = { code: string; components: BlueprintComponentLink[] };

export type BlueprintCpl = { code: string; links: { cpmk: string; weight: number }[] };

export type BlueprintClaim = { cpmk: string; achieved: number; percent: number | null; reached: boolean | null };

export type ObeBlueprint = {
	version: 1;
	cpmk: BlueprintCpmk[];
	cpl: BlueprintCpl[];
	thresholds: { studentScore: number | null; classRatioPercent: number | null };
	claims: BlueprintClaim[];
	totalStudents: number | null;
};

export type StoredBlueprint = { blueprint?: ObeBlueprint };
