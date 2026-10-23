export type CourseSummary = {
	offeringId: string;
	courseCode: string;
	courseName: string;
	section: string;
	credits: number;
	students: number;
	components: number;
	weightsState: 'ok' | 'incomplete' | 'mismatch' | 'none';
	finalMean: number | null;
	cpmk: { code: string; mean: number | null; meetsClassRatio: boolean | null }[];
	warnings: string[];
};
