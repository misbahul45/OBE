import type { FitCategory, LinearitySummary } from './tracer.calc.ts';

export const keeratanValues = ['sangat_erat', 'erat', 'cukup_erat', 'kurang_erat', 'tidak_sama_sekali'] as const;
export type Keeratan = (typeof keeratanValues)[number];

export const keeratanLabel: Record<Keeratan, string> = { sangat_erat: 'Sangat erat', erat: 'Erat', cukup_erat: 'Cukup erat', kurang_erat: 'Kurang erat', tidak_sama_sekali: 'Tidak sama sekali' };

export type TracerStatusFilter = 'belum' | 'linear' | 'tidak';

export type TracerRow = {
	studentId: string;
	nim: string;
	name: string;
	cohortYear: number | null;
	cplWithData: number;
	bestFields: { code: string; name: string; fit: number }[];
	bestProfile: { code: string; name: string; index: number; category: FitCategory } | null;
	predictedLinear: boolean | null;
	record: { isLinear: boolean; careerFieldCode: string | null; keeratan: Keeratan | null; note: string | null; predictedForField: boolean | null; fieldFit: number | null } | null;
};

export type FieldStat = { code: string; name: string; students: number; predictedLinear: number; predictedNotLinear: number; meanFit: number | null; recordedLinear: number; recordedNotLinear: number };

export type PredictedSummary = { assessed: number; linear: number; notLinear: number; notAssessable: number; linearPercent: number | null };

export type TracerOverview = {
	predicted: PredictedSummary;
	fieldStats: FieldStat[];
	parameters: { alpha: number; linearThreshold: number; veryFit: number; fit: number; enough: number };
	rows: TracerRow[];
	total: number;
	page: number;
	pageSize: number;
	pageCount: number;
	summary: LinearitySummary;
	keeratanCounts: { value: Keeratan; count: number }[];
	fields: { code: string; name: string }[];
	threshold: number;
	targetSource: 'policy' | 'excel' | null;
	ready: boolean;
};
