import { normalizeHeader, parseOutcomeHeader } from './header.ts';
import { cellAt, type SheetAnalysis, type SheetGrid, type SheetMapping } from './imports.types.ts';
import type { BlueprintClaim, BlueprintCpl, BlueprintCpmk, ObeBlueprint } from './obe-blueprint.types.ts';

const maxBlankRun = 2;
const valueSearchSpan = 3;

const textAt = (grid: SheetGrid, row: number, col: number): string => {
	const cell = cellAt(grid, row, col);
	return cell && typeof cell.value === 'string' ? normalizeHeader(cell.value) : '';
};

const numberAt = (grid: SheetGrid, row: number, col: number): number | null => {
	const cell = cellAt(grid, row, col);
	return cell && cell.kind === 'number' && typeof cell.value === 'number' && Number.isFinite(cell.value) ? cell.value : null;
};

const looseKey = (text: string) => normalizeHeader(text).toLowerCase().replace(/[^a-z0-9]/g, '');

const outcomeCode = (text: string, kind: 'cpmk' | 'cpl'): string | null => {
	const parsed = parseOutcomeHeader(text);
	return parsed && parsed.kind === kind ? parsed.code : null;
};

type Position = { row: number; col: number };

function findLabel(grid: SheetGrid, fromCol: number, test: RegExp): Position | null {
	for (let row = 0; row < grid.rowCount; row++) for (let col = fromCol; col < grid.colCount; col++) if (test.test(textAt(grid, row, col))) return { row, col };
	return null;
}

function numberRightOf(grid: SheetGrid, at: Position | null): number | null {
	if (!at) return null;
	for (let k = 1; k <= valueSearchSpan; k++) {
		const value = numberAt(grid, at.row, at.col + k);
		if (value !== null) return value;
	}
	return null;
}

function readComponentMatrix(grid: SheetGrid, head: Position, mapping: SheetMapping, analysis: SheetAnalysis): BlueprintCpmk[] {
	const codeByKey = new Map<string, string>();
	for (const component of mapping.components) {
		const key = looseKey(analysis.columns[component.column]?.header ?? '');
		if (key !== '' && !codeByKey.has(key)) codeByKey.set(key, component.code);
	}
	const columns: { col: number; code: string | null }[] = [];
	let blanks = 0;
	for (let col = head.col + 1; col < grid.colCount; col++) {
		const text = textAt(grid, head.row, col);
		if (text === '') {
			if (++blanks >= maxBlankRun) break;
			continue;
		}
		blanks = 0;
		columns.push({ col, code: codeByKey.get(looseKey(text)) ?? null });
	}
	if (columns.length > 0 && columns.every((c) => c.code === null) && columns.length === mapping.components.length)
		columns.forEach((c, i) => (c.code = mapping.components[i].code));

	const rows: BlueprintCpmk[] = [];
	for (let row = head.row + 1; row < grid.rowCount; row++) {
		const code = outcomeCode(textAt(grid, row, head.col), 'cpmk');
		if (!code) {
			if (rows.length === 0 && row <= head.row + 2) continue;
			break;
		}
		const components = columns.flatMap((c) => {
			const coefficient = c.code ? numberAt(grid, row, c.col) : null;
			return c.code && coefficient !== null && coefficient > 0 ? [{ componentCode: c.code, coefficient }] : [];
		});
		rows.push({ code, components });
	}
	return rows;
}

function readCplMatrix(grid: SheetGrid, head: Position): BlueprintCpl[] {
	const columns: { col: number; cpmk: string }[] = [];
	let blanks = 0;
	for (let col = head.col + 1; col < grid.colCount; col++) {
		const text = textAt(grid, head.row, col);
		if (text === '') {
			if (++blanks >= maxBlankRun) break;
			continue;
		}
		blanks = 0;
		const code = outcomeCode(text, 'cpmk');
		if (!code) break;
		columns.push({ col, cpmk: code });
	}
	const rows: BlueprintCpl[] = [];
	for (let row = head.row + 1; row < grid.rowCount; row++) {
		const code = outcomeCode(textAt(grid, row, head.col), 'cpl');
		if (!code) break;
		const links = columns.flatMap((c) => {
			const weight = numberAt(grid, row, c.col);
			return weight !== null && weight > 0 ? [{ cpmk: c.cpmk, weight }] : [];
		});
		rows.push({ code, links });
	}
	return rows;
}

function readClaims(grid: SheetGrid, head: Position): BlueprintClaim[] {
	const claims: BlueprintClaim[] = [];
	for (let row = head.row + 1; row < grid.rowCount; row++) {
		const code = outcomeCode(textAt(grid, row, head.col - 1), 'cpmk');
		if (!code) break;
		const achieved = numberAt(grid, row, head.col);
		if (achieved === null) continue;
		const verdict = textAt(grid, row, head.col + 2).toLowerCase();
		claims.push({ cpmk: code, achieved, percent: numberAt(grid, row, head.col + 1), reached: /^tidak/.test(verdict) ? false : /tercapai/.test(verdict) ? true : null });
	}
	return claims;
}

export function extractObeBlueprint(grid: SheetGrid, analysis: SheetAnalysis, mapping: SheetMapping): ObeBlueprint | null {
	const fromCol = (analysis.mainBlockEnd ?? -1) + 1;
	if (fromCol >= grid.colCount) return null;

	const componentHead = findLabel(grid, fromCol, /^cpmk$/i);
	const cplHead = findLabel(grid, fromCol, /^cpl\s*\\\s*cpmk$/i);
	const claimHead = findLabel(grid, fromCol, /^jumlah mahasiswa tercapai/i);

	const blueprint: ObeBlueprint = {
		version: 1,
		cpmk: componentHead ? readComponentMatrix(grid, componentHead, mapping, analysis) : [],
		cpl: cplHead ? readCplMatrix(grid, cplHead) : [],
		thresholds: {
			studentScore: numberRightOf(grid, findLabel(grid, fromCol, /^threshold nilai mahasiswa/i)),
			classRatioPercent: numberRightOf(grid, findLabel(grid, fromCol, /^threshold nilai capaian/i))
		},
		claims: claimHead ? readClaims(grid, claimHead) : [],
		totalStudents: numberRightOf(grid, findLabel(grid, fromCol, /^total mahasiswa/i))
	};

	const empty = blueprint.cpmk.length === 0 && blueprint.cpl.length === 0 && blueprint.claims.length === 0 && blueprint.thresholds.studentScore === null && blueprint.thresholds.classRatioPercent === null;
	return empty ? null : blueprint;
}

export function blueprintCpmkCodes(blueprint: ObeBlueprint): string[] {
	return [...new Set([...blueprint.cpmk.map((c) => c.code), ...blueprint.cpl.flatMap((c) => c.links.map((l) => l.cpmk)), ...blueprint.claims.map((c) => c.cpmk)])].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
}
