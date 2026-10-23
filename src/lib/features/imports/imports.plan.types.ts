import type { ImportIssue } from './imports.issues.ts';
import type { ComponentType, SheetGrid, SheetMapping } from './imports.types.ts';
import type { SheetValidation } from './validation.ts';

export type ImportStrategy = 'upsert' | 'insert_missing';
export type ErrorPolicy = 'block_on_error' | 'skip_invalid_rows';
export type ChangeAction = 'insert' | 'update' | 'unchanged';

export type SheetImportInput = {
	sheetName: string;
	offeringId: string | null;
	grid: SheetGrid;
	mapping: SheetMapping;
	acknowledgements: { numericNim: boolean };
	include: boolean;
};

export type PlannedScore = { code: string; action: ChangeAction; oldValue: number | null; newValue: number };
export type PlannedReference = { kind: 'cpmk' | 'cpl'; code: string; action: ChangeAction; newValue: number };

export type PlannedRow = {
	row: number;
	nim: string;
	nimMasked: string;
	name: string;
	studentAction: 'create' | 'reuse';
	masterName: string | null;
	nameConflict: boolean;
	enrollmentAction: 'create' | 'existing';
	scores: PlannedScore[];
	references: PlannedReference[];
	blankComponents: string[];
	issues: ImportIssue[];
};

export type PlannedComponent = {
	code: string;
	name: string;
	type: ComponentType;
	weightPercent: number | null;
	maxScore: number;
	action: 'create' | 'existing' | 'weight_change';
	existingWeightPercent: number | null;
};

export type PlanSummary = {
	rowsValid: number;
	rowsWarning: number;
	rowsRejected: number;
	studentsNew: number;
	studentsExisting: number;
	enrollmentsNew: number;
	enrollmentsExisting: number;
	scoresNew: number;
	scoresUpdated: number;
	scoresUnchanged: number;
	referencesNew: number;
	referencesUpdated: number;
	referencesUnchanged: number;
	nameConflicts: number;
	componentsNew: number;
	weightChanges: number;
	blankCells: number;
};

export type BlockerCode =
	| 'OFFERING_NOT_SELECTED'
	| 'OFFERING_NOT_FOUND'
	| 'SHEET_ERRORS'
	| 'ROW_ERRORS'
	| 'NIM_NUMERIC_UNACKNOWLEDGED'
	| 'SCORE_UPDATES_UNCONFIRMED'
	| 'WEIGHT_CHANGES_UNCONFIRMED'
	| 'NOTHING_TO_IMPORT';

export type PlanBlocker = { code: BlockerCode; sheet: string; message: string };

export type SheetPlan = {
	sheet: string;
	offeringId: string | null;
	included: boolean;
	validation: SheetValidation;
	components: PlannedComponent[];
	rows: PlannedRow[];
	summary: PlanSummary;
	needsNumericNimAck: boolean;
	offeringFound: boolean;
};

export type GateOptions = {
	strategy: ImportStrategy;
	errorPolicy: ErrorPolicy;
	confirmations: { scoreUpdates: boolean; weightChanges: boolean };
	acknowledgements: { numericNim: boolean };
};

export const emptySummary = (): PlanSummary => ({
	rowsValid: 0,
	rowsWarning: 0,
	rowsRejected: 0,
	studentsNew: 0,
	studentsExisting: 0,
	enrollmentsNew: 0,
	enrollmentsExisting: 0,
	scoresNew: 0,
	scoresUpdated: 0,
	scoresUnchanged: 0,
	referencesNew: 0,
	referencesUpdated: 0,
	referencesUnchanged: 0,
	nameConflicts: 0,
	componentsNew: 0,
	weightChanges: 0,
	blankCells: 0
});

export class ImportBlockedError extends Error {
	constructor(readonly blockers: PlanBlocker[]) {
		super(`Impor ditahan: ${blockers.map((b) => b.message).join('; ')}`);
		this.name = 'ImportBlockedError';
	}
}
