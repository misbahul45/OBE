import type { AggregationMethod, CplAggregate, Distribution, OutcomeBasis } from './outcomes.calc.ts';

export type ThresholdSource = 'policy' | 'excel';

export type TraceNode = { id: string; column: 0 | 1 | 2; code: string; label: string; value: number | null; ratio: number | null; reached: boolean | null };

export type TraceLink = { from: string; to: string; weight: number; display: number };

export type OfferingTrace = { nodes: TraceNode[]; links: TraceLink[]; source: { fileName: string; sheetName: string } };

export type PolicyView = { id: string; name: string; threshold: number | null; classRatio: number | null; aggregation: AggregationMethod; targets: Record<string, number> };

export type ComponentStat = {
	id: string;
	code: string;
	name: string;
	type: string;
	weightPercent: number | null;
	maxScore: number;
	scored: number;
	blank: number;
	mean: number | null;
	min: number | null;
	max: number | null;
	cpmkCodes: string[];
};

export type OutcomeStat = {
	id: string;
	code: string;
	title: string;
	complete: number;
	incomplete: number;
	mean: number | null;
	target: number | null;
	distribution: Distribution;
	meetsClassRatio: boolean | null;
	basis: OutcomeBasis | null;
	targetSource: ThresholdSource | null;
	classRatio: number | null;
	reference: { count: number; mean: number | null; differing: number } | null;
};

export type ScoreBin = { from: number; to: number; count: number };

export type OfferingAnalytics = {
	offering: { id: string; courseId: string; courseCode: string; courseName: string; section: string; credits: number; semesterName: string };
	studentCount: number;
	policy: PolicyView | null;
	components: ComponentStat[];
	weights: { total: number | null; complete: boolean; ok: boolean; count: number };
	finalScore: { complete: number; incomplete: number; notConfigured: boolean; reason: string | null; mean: number | null; bins: ScoreBin[] };
	cpmk: OutcomeStat[];
	cpl: OutcomeStat[];
	thresholds: { studentScore: number | null; classRatio: number | null; source: ThresholdSource | null };
	trace: OfferingTrace | null;
	warnings: string[];
	lastRunAt: Date | null;
};

export type ProgramOffering = { offeringId: string; courseCode: string; courseName: string; section: string; credits: number; students: number; complete: number; mean: number | null; ratioAchieved: number | null; distribution: Distribution; basis: OutcomeBasis };

export type ProgramCpl = { id: string; code: string; title: string; target: number | null; targetSource: ThresholdSource | null; offerings: ProgramOffering[]; aggregate: CplAggregate; distribution: Distribution };

export type AttentionItem = { offeringId: string; label: string; reason: string };

export type ProgramAnalytics = {
	semester: { id: string; name: string } | null;
	policy: PolicyView | null;
	totals: { offerings: number; lecturers: number; students: number; enrollments: number; committedImports: number; openImports: number; offeringsWithResults: number };
	cpl: ProgramCpl[];
	attention: AttentionItem[];
};

export type RosterRow = {
	studentId: string;
	enrollmentId: string;
	nim: string;
	name: string;
	finalScore: number | null;
	status: 'complete' | 'incomplete' | 'not_configured';
	missing: string[];
	cpmk: Record<string, number | null>;
	cpmkBasis: Record<string, OutcomeBasis>;
};
