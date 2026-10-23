import type { Achievement, CplAggregate } from '#lib/features/outcomes/index.ts';

export type ProfileComponent = { code: string; name: string; weightPercent: number | null; maxScore: number; score: number | null };

export type ProfileOutcome = {
	code: string;
	title: string;
	value: number | null;
	completeness: 'complete' | 'incomplete';
	target: number | null;
	achievement: Achievement;
	reference: number | null;
	formulaVersion: string | null;
	computedAt: Date | null;
};

export type ProfileEnrollment = {
	enrollmentId: string;
	offeringId: string;
	courseCode: string;
	courseName: string;
	section: string;
	credits: number;
	semesterId: string;
	semesterName: string;
	final: { value: number | null; status: 'complete' | 'incomplete' | 'not_configured'; missing: string[] };
	components: ProfileComponent[];
	cpmk: ProfileOutcome[];
	cpl: ProfileOutcome[];
};

export type ProfileRevision = {
	id: string;
	at: Date;
	courseName: string;
	componentCode: string;
	oldScore: number | null;
	newScore: number | null;
	changeType: 'import_initial' | 'import_update' | 'manual_correction';
	batchFileName: string | null;
};

export type ProfileCplSummary = {
	code: string;
	title: string;
	target: number | null;
	aggregate: CplAggregate;
	entries: { courseName: string; semesterName: string; credits: number; value: number | null }[];
};

export type StudentProfile = {
	student: { id: string; nim: string; name: string; cohortYear: number | null };
	enrollments: ProfileEnrollment[];
	semesters: { id: string; name: string; mean: number | null; courses: number }[];
	cplSummary: ProfileCplSummary[];
	revisions: ProfileRevision[];
	policy: { name: string; threshold: number | null; aggregation: string } | null;
	scopeLimited: boolean;
};
