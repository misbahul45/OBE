import { describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { importBatches, importMappingPresets, importRowIssues, importSheetMappings, importStagedFiles, user } from '#lib/shared/db/schema.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { createUser } from '../../support/factories.ts';
import { expectDatabaseRejection, pgCodes } from '../../support/postgres-error.ts';

const ctx = useIsolatedDatabase('imports_schema');

async function createBatch() {
	const uploader = await createUser(ctx.db);
	const [batch] = await ctx.db
		.insert(importBatches)
		.values({ uploaderId: uploader.id, fileName: 'contoh.xlsx', fileSha256: 'a'.repeat(64), fileSize: 1024, fileKind: 'xlsx' })
		.returning();
	return { uploader, batch };
}

describe('import_staged_files', () => {
	test('isi biner kembali identik byte demi byte', async () => {
		const { batch } = await createBatch();
		const bytes = Buffer.from([0, 1, 2, 127, 128, 254, 255]);
		await ctx.db.insert(importStagedFiles).values({ batchId: batch.id, content: bytes, contentType: 'application/octet-stream', expiresAt: new Date(Date.now() + 3600_000) });
		const [row] = await ctx.db.select().from(importStagedFiles).where(eq(importStagedFiles.batchId, batch.id));
		expect(Buffer.compare(row.content, bytes)).toBe(0);
	});

	test('menghapus batch ikut menghapus berkas staging, mapping sheet, dan isu baris', async () => {
		const { batch } = await createBatch();
		await ctx.db.insert(importStagedFiles).values({ batchId: batch.id, content: Buffer.from('x'), contentType: 'text/csv', expiresAt: new Date() });
		await ctx.db.insert(importSheetMappings).values({ batchId: batch.id, sheetName: 'S1', fingerprint: 'fp', mapping: { kolom: [] } });
		await ctx.db.insert(importRowIssues).values({ batchId: batch.id, sheetName: 'S1', severity: 'warning', code: 'X', message: 'uji' });
		await ctx.db.delete(importBatches).where(eq(importBatches.id, batch.id));
		expect((await ctx.db.select().from(importStagedFiles).where(eq(importStagedFiles.batchId, batch.id))).length).toBe(0);
		expect((await ctx.db.select().from(importSheetMappings).where(eq(importSheetMappings.batchId, batch.id))).length).toBe(0);
		expect((await ctx.db.select().from(importRowIssues).where(eq(importRowIssues.batchId, batch.id))).length).toBe(0);
	});
});

describe('import_sheet_mappings dan presets', () => {
	test('satu sheet hanya dipetakan sekali per batch', async () => {
		const { batch } = await createBatch();
		await ctx.db.insert(importSheetMappings).values({ batchId: batch.id, sheetName: 'Pancasila', fingerprint: 'fp', mapping: {} });
		const failure = await expectDatabaseRejection(() => ctx.db.insert(importSheetMappings).values({ batchId: batch.id, sheetName: 'Pancasila', fingerprint: 'fp2', mapping: {} }));
		expect(failure.code).toBe(pgCodes.uniqueViolation);
	});

	test('preset mapping unik per fingerprint struktur sheet', async () => {
		const { uploader } = await createBatch();
		await ctx.db.insert(importMappingPresets).values({ fingerprint: 'struktur-1', name: 'Template A', mapping: {}, createdBy: uploader.id });
		const failure = await expectDatabaseRejection(() =>
			ctx.db.insert(importMappingPresets).values({ fingerprint: 'struktur-1', name: 'Template B', mapping: {}, createdBy: uploader.id })
		);
		expect(failure.code).toBe(pgCodes.uniqueViolation);
	});

	test('pengunggah yang masih punya batch tidak dapat dihapus', async () => {
		const { uploader } = await createBatch();
		const failure = await expectDatabaseRejection(() => ctx.db.delete(user).where(eq(user.id, uploader.id)));
		expect(failure.code).toBe(pgCodes.foreignKeyViolation);
	});
});
