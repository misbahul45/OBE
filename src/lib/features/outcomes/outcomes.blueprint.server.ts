import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { DbExecutor } from '#lib/shared/db/client.server.ts';
import { importBatches, importSheetMappings } from '#lib/features/imports/imports.schema.ts';
import type { ObeBlueprint, StoredBlueprint } from '#lib/features/imports/obe-blueprint.types.ts';

export type OfferingBlueprint = { blueprint: ObeBlueprint; fileName: string; sheetName: string; batchId: string };

export async function loadBlueprints(db: DbExecutor, offeringIds: string[]): Promise<Map<string, OfferingBlueprint>> {
	const found = new Map<string, OfferingBlueprint>();
	if (offeringIds.length === 0) return found;
	const rows = await db
		.select({
			offeringId: importSheetMappings.offeringId,
			sheetName: importSheetMappings.sheetName,
			mapping: importSheetMappings.mapping,
			batchId: importSheetMappings.batchId,
			fileName: importBatches.fileName
		})
		.from(importSheetMappings)
		.innerJoin(importBatches, eq(importBatches.id, importSheetMappings.batchId))
		.where(and(inArray(importSheetMappings.offeringId, offeringIds), eq(importSheetMappings.status, 'committed'), sql`jsonb_exists(${importSheetMappings.mapping}, 'blueprint')`))
		.orderBy(desc(importSheetMappings.updatedAt));
	for (const row of rows) {
		if (!row.offeringId || found.has(row.offeringId)) continue;
		const blueprint = (row.mapping as StoredBlueprint).blueprint;
		if (blueprint) found.set(row.offeringId, { blueprint, fileName: row.fileName, sheetName: row.sheetName, batchId: row.batchId });
	}
	return found;
}
