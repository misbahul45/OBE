import { maskNim } from '#lib/features/audit/index.server.ts';
import { allIssues } from './validation.ts';
import type { DryRunOptions, DryRunResult, LoadedBatch } from './imports.batch.server.ts';
import type { ColumnChoice, DryRunSheetView, DryRunView, WizardBatch, WizardColumn, WizardSheet } from './imports.view.ts';

const previewRowCap = 12;
const previewColCap = 40;
const columnEditorCap = 60;
const sampleRowCap = 8;
const issueCap = 30;

const editableRoles = new Set(['component', 'cpmk', 'cpl', 'ignored']);

function columnChoice(sheet: LoadedBatch['sheets'][number], index: number): { choice: ColumnChoice; code: string; name: string; type: WizardColumn['type']; weight: string; max: string } {
	const mapping = sheet.stored.mapping;
	const suggestion = sheet.analysis.columns.find((c) => c.index === index);
	const base = {
		code: suggestion?.component?.code ?? suggestion?.outcomeCode ?? '',
		name: suggestion?.component?.name ?? suggestion?.header ?? '',
		type: suggestion?.component?.type ?? 'lainnya',
		weight: suggestion?.component?.weightPercent != null ? String(suggestion.component.weightPercent) : '',
		max: String(suggestion?.component?.maxScore ?? 100)
	} as const;
	if (!mapping) return { choice: 'ignore', ...base };
	const component = mapping.components.find((c) => c.column === index);
	if (component) return { choice: 'component', code: component.code, name: component.name, type: component.type, weight: component.weightPercent != null ? String(component.weightPercent) : '', max: String(component.maxScore) };
	const cpmk = mapping.cpmkColumns.find((c) => c.column === index);
	if (cpmk) return { choice: 'cpmk', ...base, code: cpmk.code };
	const cpl = mapping.cplColumns.find((c) => c.column === index);
	if (cpl) return { choice: 'cpl', ...base, code: cpl.code };
	return { choice: 'ignore', ...base };
}

function previewOf(sheet: LoadedBatch['sheets'][number]): WizardSheet['preview'] {
	const { grid, analysis } = sheet;
	const mapping = sheet.stored.mapping;
	const headerRow = mapping?.headerRow ?? analysis.headerRow ?? null;
	const nimColumn = mapping?.nimColumn ?? analysis.nimColumn;
	const span = analysis.headerSpan || 1;
	const firstRow = headerRow ? Math.max(1, headerRow - span + 1) : 1;
	const lastRow = Math.min(grid.rowCount, firstRow + previewRowCap - 1);
	const cols = Math.min(grid.colCount, previewColCap);
	const rows: { row: number; cells: string[] }[] = [];
	for (let r = firstRow; r <= lastRow; r++) {
		const cells: string[] = [];
		for (let c = 0; c < cols; c++) {
			const cell = grid.rows[r - 1]?.[c];
			let text = cell?.display ?? '';
			if (headerRow && r > headerRow && c === nimColumn && /^\d{6,15}$/.test(text.trim())) text = maskNim(text.trim());
			cells.push(text.length > 40 ? `${text.slice(0, 39)}…` : text);
		}
		rows.push({ row: r, cells });
	}
	return { startRow: firstRow, headers: Array.from({ length: cols }, (_, c) => analysis.columns.find((col) => col.index === c)?.letter ?? String.fromCharCode(65 + (c % 26))), rows };
}

function numericNimOf(sheet: LoadedBatch['sheets'][number]): boolean {
	const mapping = sheet.stored.mapping;
	const nimColumn = mapping?.nimColumn ?? sheet.analysis.nimColumn;
	if (nimColumn == null) return false;
	return sheet.analysis.rows.some((r) => r.kind === 'student' && sheet.grid.rows[r.row - 1]?.[nimColumn]?.kind === 'number');
}

export function toWizardBatch(loaded: LoadedBatch): WizardBatch {
	const sheets: WizardSheet[] = loaded.sheets.map((sheet) => {
		const mapping = sheet.stored.mapping;
		const columns: WizardColumn[] = sheet.analysis.columns
			.filter((c) => editableRoles.has(c.role) && c.index !== (mapping?.nimColumn ?? sheet.analysis.nimColumn) && c.index !== (mapping?.nameColumn ?? sheet.analysis.nameColumn))
			.slice(0, columnEditorCap)
			.map((c) => ({
				index: c.index,
				letter: c.letter,
				header: c.header,
				detectedRole: c.role,
				confidence: c.confidence,
				reason: c.reason,
				ghost: c.ghost,
				...columnChoice(sheet, c.index)
			}));
		return {
			name: sheet.row.sheetName,
			include: sheet.row.include && mapping !== null,
			hasMapping: mapping !== null,
			offeringId: sheet.row.offeringId,
			source: sheet.stored.source,
			numericNim: numericNimOf(sheet),
			numericNimAcknowledged: sheet.settings.numericNim,
			headerRow: mapping?.headerRow ?? sheet.analysis.headerRow,
			firstDataRow: mapping?.firstDataRow ?? sheet.analysis.firstDataRow,
			nimColumn: mapping?.nimColumn ?? sheet.analysis.nimColumn,
			nameColumn: mapping ? mapping.nameColumn : sheet.analysis.nameColumn,
			excludedRows: (mapping?.excludedRows ?? []).join(', '),
			studentRowCount: sheet.analysis.studentRowCount,
			weightsTotalPercent: sheet.analysis.weightsTotalPercent,
			hint: [sheet.analysis.offeringHint.courseNameHint, sheet.analysis.offeringHint.sectionHint].filter(Boolean).join(' · '),
			notes: sheet.analysis.issues.map((issue) => ({ severity: issue.severity, message: issue.message })),
			columns,
			preview: previewOf(sheet)
		};
	});
	return { id: loaded.batch.id, fileName: loaded.batch.fileName, status: loaded.batch.status, sheets, skipped: loaded.skipped };
}

export function toDryRunView(result: DryRunResult, options: DryRunOptions): DryRunView {
	const sheets: DryRunSheetView[] = result.plans.map((plan) => {
		const issues = allIssues(plan.validation);
		const ranked = [...issues].sort((a, b) => ({ error: 0, warning: 1, info: 2 })[a.severity] - { error: 0, warning: 1, info: 2 }[b.severity]);
		return {
			name: plan.sheet,
			included: plan.included,
			summary: plan.summary,
			components: plan.components,
			sampleRows: plan.rows.slice(0, sampleRowCap).map((row) => ({
				row: row.row,
				nimMasked: row.nimMasked,
				name: row.name,
				student: row.studentAction,
				nameConflict: row.nameConflict,
				scores: row.scores,
				blank: row.blankComponents
			})),
			issues: ranked.slice(0, issueCap).map((i) => ({ severity: i.severity, code: i.code, message: i.message, row: i.row, column: i.column })),
			issueCount: issues.length
		};
	});
	return {
		summary: result.summary,
		blockers: result.blockers,
		issueTotals: result.issueTotals,
		sheets,
		strategy: options.strategy,
		errorPolicy: options.errorPolicy
	};
}
