import type { ImportIssue } from './imports.issues.ts';

export type ComponentType ='uts' | 'uas' | 'tugas' | 'kuis' | 'proyek' | 'praktikum' | 'kehadiran' | 'softskill' | 'lainnya';

export type GridCellKind = 'number' | 'string' | 'boolean' | 'error' | 'date';

export type GridCell = {
	kind: GridCellKind;
	value: string | number | boolean | null;
	display: string;
	formula: string | null;
	cached: boolean;
	format: string | null;
};

export type MergeRange = { startRow: number; startCol: number; endRow: number; endCol: number };

export type SheetGrid = {
	name: string;
	rowCount: number;
	colCount: number;
	rows: (GridCell | undefined)[][];
	merges: MergeRange[];
};

export const cellAt = (grid: SheetGrid, row: number, col: number): GridCell | undefined => grid.rows[row]?.[col];

export function columnLetter(index: number): string {
	let n = index;
	let out = '';
	do {
		out = String.fromCharCode(65 + (n % 26)) + out;
		n = Math.floor(n / 26) - 1;
	} while (n >= 0);
	return out;
}

export type ColumnRole = 'no' | 'nim' | 'name' | 'component' | 'cpmk' | 'cpl' | 'ignored' | 'metadata';
export type Confidence = 'high' | 'medium' | 'low';

export type ComponentSuggestion = {
	code: string;
	name: string;
	type: ComponentType;
	weightPercent: number | null;
	maxScore: number;
};

export type ColumnInfo = {
	index: number;
	letter: string;
	header: string;
	role: ColumnRole;
	confidence: Confidence;
	reason: string;
	fill: number;
	ghost: boolean;
	component?: ComponentSuggestion;
	outcomeCode?: string;
};

export type MetadataKind = 'cpmk_component_matrix' | 'cpl_cpmk_matrix' | 'threshold' | 'achievement_summary' | 'unknown';

export type MetadataRegion = {
	kinds: MetadataKind[];
	startRow: number;
	endRow: number;
	startCol: number;
	endCol: number;
	range: string;
	labels: string[];
};

export type OfferingHint = { courseNameHint: string; sectionHint: string | null; isPractical: boolean };

export type RowKind = 'student' | 'excluded' | 'empty';

export type RowClassification = {
	row: number;
	kind: RowKind;
	reason?: string;
};

export type SheetAnalysis = {
	sheetName: string;
	headerRow: number | null;
	headerSpan: number;
	nimColumn: number | null;
	nameColumn: number | null;
	firstDataRow: number | null;
	rows: RowClassification[];
	studentRowCount: number;
	columns: ColumnInfo[];
	mainBlockEnd: number | null;
	metadataRegions: MetadataRegion[];
	weightsTotalPercent: number | null;
	offeringHint: OfferingHint;
	fingerprint: string;
	issues: ImportIssue[];
};

export type SheetMapping = {
	headerRow: number;
	nimColumn: number;
	nameColumn: number | null;
	components: { column: number; code: string; name: string; type: ComponentType; weightPercent: number | null; maxScore: number }[];
	cpmkColumns: { column: number; code: string }[];
	cplColumns: { column: number; code: string }[];
	firstDataRow: number;
	excludedRows: number[];
};
