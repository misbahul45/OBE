import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildAutoMapWorkbook, buildSemesterWorkbook, buildSemesterWorkbookChanged, buildSinyalWorkbook } from './templates.ts';
import { buildCorruptWorkbook, buildHiddenSheetWorkbook, buildMultiHeaderWorkbook, buildNoStudentIdWorkbook, buildVariationsWorkbook } from './variations.ts';

export const fixtureFiles = {
	'semester-1-multi-sheet.synthetic.xlsx': buildSemesterWorkbook,
	'semester-1-multi-sheet-changed.synthetic.xlsx': buildSemesterWorkbookChanged,
	'automap.synthetic.xlsx': buildAutoMapWorkbook,
	'sin-sistem-kontrol-cpmk-t1.synthetic.xlsx': buildSinyalWorkbook,
	'variations.synthetic.xlsx': buildVariationsWorkbook,
	'multi-header.synthetic.xlsx': buildMultiHeaderWorkbook,
	'hidden-sheet.synthetic.xlsx': buildHiddenSheetWorkbook,
	'invalid-no-student-id.xlsx': buildNoStudentIdWorkbook,
	'invalid-corrupt.xlsx': buildCorruptWorkbook
} as const;

export function writeFixtures(directory = resolve(import.meta.dir, '../workbooks')): string[] {
	mkdirSync(directory, { recursive: true });
	return Object.entries(fixtureFiles).map(([name, build]) => {
		const path = resolve(directory, name);
		writeFileSync(path, build());
		return path;
	});
}

if (import.meta.main) {
	const written = writeFixtures();
	console.log(`${written.length} fixture sintetis ditulis ke tests/fixtures/workbooks`);
}
