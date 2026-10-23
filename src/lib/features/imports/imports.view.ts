import type { ColumnRole, ComponentType, Confidence } from './imports.types.ts';
import type { BlockerCode, ChangeAction, PlanSummary, PlannedComponent } from './imports.plan.types.ts';

export type ColumnChoice = 'ignore' | 'component' | 'cpmk' | 'cpl';

export type WizardColumn = {
	index: number;
	letter: string;
	header: string;
	detectedRole: ColumnRole;
	confidence: Confidence;
	reason: string;
	ghost: boolean;
	choice: ColumnChoice;
	code: string;
	name: string;
	type: ComponentType;
	weight: string;
	max: string;
};

export type WizardSheet = {
	name: string;
	include: boolean;
	hasMapping: boolean;
	offeringId: string | null;
	source: 'auto' | 'preset' | 'manual';
	numericNim: boolean;
	numericNimAcknowledged: boolean;
	headerRow: number | null;
	firstDataRow: number | null;
	nimColumn: number | null;
	nameColumn: number | null;
	excludedRows: string;
	studentRowCount: number;
	weightsTotalPercent: number | null;
	hint: string;
	notes: { severity: 'error' | 'warning' | 'info'; message: string }[];
	columns: WizardColumn[];
	preview: { startRow: number; headers: string[]; rows: { row: number; cells: string[] }[] };
};

export type WizardBatch = {
	id: string;
	fileName: string;
	status: string;
	sheets: WizardSheet[];
	skipped: { name: string; reason: string }[];
};

export type OfferingOption = { id: string; label: string; semesterName: string };

export type DryRunSheetView = {
	name: string;
	included: boolean;
	summary: PlanSummary;
	components: PlannedComponent[];
	sampleRows: { row: number; nimMasked: string; name: string; student: 'create' | 'reuse'; nameConflict: boolean; scores: { code: string; action: ChangeAction; oldValue: number | null; newValue: number }[]; blank: string[] }[];
	issues: { severity: 'error' | 'warning' | 'info'; code: string; message: string; row: number | null; column: string | null }[];
	issueCount: number;
};

export type DryRunView = {
	summary: PlanSummary;
	blockers: { code: BlockerCode; sheet: string; message: string }[];
	issueTotals: { error: number; warning: number; info: number };
	sheets: DryRunSheetView[];
	strategy: 'upsert' | 'insert_missing';
	errorPolicy: 'block_on_error' | 'skip_invalid_rows';
};
