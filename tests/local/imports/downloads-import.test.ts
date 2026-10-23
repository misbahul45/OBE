import { describe, expect, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { count, countDistinct } from 'drizzle-orm';
import { assessmentScores, enrollments, students } from '#lib/shared/db/schema.ts';
import { commitImport } from '#lib/features/imports/imports.commit.server.ts';
import { evaluateGate, planSheet } from '#lib/features/imports/imports.plan.server.ts';
import { ImportBlockedError, type SheetImportInput } from '#lib/features/imports/imports.plan.types.ts';
import { analyzeSheet, suggestMapping } from '#lib/features/imports/sheet-analysis.ts';
import { readWorkbook } from '#lib/features/imports/workbook-reader.server.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { createOffering, createTerm, createUser } from '../../support/factories.ts';
import { createBatch } from '../../support/imports.ts';

const directory = process.env.OBE_LOCAL_EXCEL_DIR || join(homedir(), 'Downloads');
const files = existsSync(directory)
	? readdirSync(directory)
			.filter((name) => /^(Semester \d+|Capaian_CPMK.*)\.xlsx$/i.test(name))
			.sort()
	: [];

const suite = files.length > 0 ? describe : describe.skip;
const ctx = useIsolatedDatabase('local_real_import');
const longTimeout = 300_000;

type Prepared = { file: string; input: SheetImportInput };
const prepared: Prepared[] = [];

suite(`impor Excel asli ke PostgreSQL terisolasi (${files.length} berkas)`, () => {
	test('setiap sheet dapat direncanakan; hanya sheet berbobot bukan 100% yang ditahan', async () => {
		const actor = await createUser(ctx.db, { role: 'super_admin' });
		const batch = await createBatch(ctx.db, actor.id);
		const blocked: string[] = [];
		let sheetCount = 0;
		const { semester } = await createTerm(ctx.db);
		for (const file of files) {
			for (const grid of readWorkbook(readFileSync(join(directory, file)), file).sheets) {
				sheetCount++;
				const mapping = suggestMapping(analyzeSheet(grid))!;
				const offering = await createOffering(ctx.db, { semesterId: semester.id });
				const input: SheetImportInput = { sheetName: grid.name, offeringId: offering.id, grid, mapping, acknowledgements: { numericNim: true }, include: true };
				const plan = await planSheet(ctx.db, input);
				const gate = evaluateGate(plan, { strategy: 'upsert', errorPolicy: 'skip_invalid_rows', confirmations: { scoreUpdates: true, weightChanges: true }, acknowledgements: { numericNim: true } });
				if (gate.length) blocked.push(`${file}:${grid.name}:${[...new Set(gate.map((g) => g.code))].join('+')}`);
				else prepared.push({ file, input });
			}
		}
		void batch;
		console.log(JSON.stringify({ sheet: sheetCount, siapImpor: prepared.length, ditahan: blocked.length, alasanDitahan: blocked.map((b) => b.split(':').pop()) }));
		expect(blocked.every((b) => b.endsWith('SHEET_ERRORS'))).toBe(true);
		expect(blocked.length).toBeLessThanOrEqual(5);
		expect(prepared.length).toBeGreaterThan(95);
	}, longTimeout);

	test('impor pertama menulis semua sheet siap dan tidak ada duplikat mahasiswa', async () => {
		const actor = await createUser(ctx.db, { role: 'super_admin' });
		let scoresNew = 0;
		let enrollmentsNew = 0;
		for (const { input } of prepared) {
			const batch = await createBatch(ctx.db, actor.id);
			const result = await commitImport(ctx.db, {
				batchId: batch.id,
				actor: { id: actor.id, role: 'super_admin' },
				sheets: [input],
				strategy: 'upsert',
				errorPolicy: 'skip_invalid_rows',
				confirmations: { scoreUpdates: true, weightChanges: true }
			});
			scoresNew += result.summary.scoresNew;
			enrollmentsNew += result.summary.enrollmentsNew;
		}
		const [{ n }] = await ctx.db.select({ n: count() }).from(students);
		const [{ distinct }] = await ctx.db.select({ distinct: countDistinct(students.nim) }).from(students);
		const [{ e }] = await ctx.db.select({ e: count() }).from(enrollments);
		const [{ s }] = await ctx.db.select({ s: count() }).from(assessmentScores);
		console.log(JSON.stringify({ mahasiswaUnik: Number(n), enrollment: Number(e), skor: Number(s) }));
		expect(Number(n)).toBe(Number(distinct));
		expect(Number(e)).toBe(enrollmentsNew);
		expect(Number(s)).toBe(scoresNew);
		expect(Number(n)).toBeLessThan(Number(e));
	}, longTimeout);

	test('impor ulang seluruh sheet tidak mengubah satu baris pun (idempotent pada data nyata)', async () => {
		const actor = await createUser(ctx.db, { role: 'super_admin' });
		const before = await Promise.all([students, enrollments, assessmentScores].map(async (t) => Number((await ctx.db.select({ n: count() }).from(t))[0].n)));
		let changed = 0;
		for (const { input } of prepared) {
			const batch = await createBatch(ctx.db, actor.id);
			const result = await commitImport(ctx.db, {
				batchId: batch.id,
				actor: { id: actor.id, role: 'super_admin' },
				sheets: [input],
				strategy: 'upsert',
				errorPolicy: 'skip_invalid_rows',
				confirmations: { scoreUpdates: false, weightChanges: false }
			});
			const s = result.summary;
			changed += s.studentsNew + s.enrollmentsNew + s.scoresNew + s.scoresUpdated + s.referencesNew + s.referencesUpdated + s.componentsNew;
		}
		const after = await Promise.all([students, enrollments, assessmentScores].map(async (t) => Number((await ctx.db.select({ n: count() }).from(t))[0].n)));
		expect(changed).toBe(0);
		expect(after).toEqual(before);
	}, longTimeout);

	test('sheet berbobot salah ditolak keras walau pengguna memilih melewati baris bergalat', async () => {
		const bad = files.flatMap((file) => readWorkbook(readFileSync(join(directory, file)), file).sheets.map((grid) => ({ file, grid }))).find(({ grid }) => analyzeSheet(grid).weightsTotalPercent !== null && analyzeSheet(grid).weightsTotalPercent !== 100);
		if (!bad) return;
		const actor = await createUser(ctx.db, { role: 'super_admin' });
		const batch = await createBatch(ctx.db, actor.id);
		const offering = await createOffering(ctx.db);
		const input: SheetImportInput = { sheetName: bad.grid.name, offeringId: offering.id, grid: bad.grid, mapping: suggestMapping(analyzeSheet(bad.grid))!, acknowledgements: { numericNim: true }, include: true };
		await expect(
			commitImport(ctx.db, { batchId: batch.id, actor: { id: actor.id, role: 'super_admin' }, sheets: [input], strategy: 'upsert', errorPolicy: 'skip_invalid_rows', confirmations: { scoreUpdates: true, weightChanges: true } })
		).rejects.toBeInstanceOf(ImportBlockedError);
	}, longTimeout);
});
