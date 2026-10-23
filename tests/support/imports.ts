import { count } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { Database } from '#lib/shared/db/client.server.ts';
import { cplDefinitions, cpmkDefinitions, importBatches } from '#lib/shared/db/schema.ts';
import type { SheetImportInput } from '#lib/features/imports/imports.plan.types.ts';
import type { SheetGrid } from '#lib/features/imports/imports.types.ts';
import { analyzeSheet, suggestMapping } from '#lib/features/imports/sheet-analysis.ts';
import { gridOf, type CellInput } from './grid.ts';

export type SimpleStudent = { nim: string | number | null; name: string | null; uts?: CellInput; uas?: CellInput };

export function simpleSheet(name: string, students: SimpleStudent[], weights: [number, number] = [40, 60]): SheetGrid {
	return gridOf(name, [
		['NO', 'NIM', 'Nama', `UTS (${weights[0]} %)`, `UAS (${weights[1]} %)`],
		...students.map((s, i) => [i + 1, s.nim, s.name, s.uts ?? null, s.uas ?? null])
	]);
}

export function inputFor(grid: SheetGrid, offeringId: string | null, overrides: Partial<SheetImportInput> = {}): SheetImportInput {
	const mapping = suggestMapping(analyzeSheet(grid));
	if (!mapping) throw new Error('pemetaan tidak dapat disarankan untuk grid uji');
	return { sheetName: grid.name, offeringId, grid, mapping, acknowledgements: { numericNim: true }, include: true, ...overrides };
}

export async function createBatch(db: Database, uploaderId: string, overrides: Partial<typeof importBatches.$inferInsert> = {}) {
	const [row] = await db
		.insert(importBatches)
		.values({ uploaderId, fileName: 'uji.xlsx', fileSha256: 'b'.repeat(64), fileSize: 100, fileKind: 'xlsx', ...overrides })
		.returning();
	return row;
}

export async function defineOutcomes(db: Database, courseId: string, cpmkCodes: string[], cplCodes: string[]) {
	if (cpmkCodes.length) await db.insert(cpmkDefinitions).values(cpmkCodes.map((code) => ({ courseId, code }))).onConflictDoNothing();
	if (cplCodes.length) await db.insert(cplDefinitions).values(cplCodes.map((code, i) => ({ code, title: `Capaian ${code}`, sortOrder: i }))).onConflictDoNothing();
}

export async function rowCount(db: Database, table: PgTable): Promise<number> {
	const [row] = await db.select({ n: count() }).from(table);
	return Number(row.n);
}
