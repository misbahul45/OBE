import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { and, eq, inArray } from 'drizzle-orm';
import { createDb } from '#lib/shared/db/client.server.ts';
import { activateSemester, createAcademicYear, createSemester, getActiveSemester } from '#lib/features/academic/index.server.ts';
import { academicYears, semesters } from '#lib/features/academic/academic.schema.ts';
import { user } from '#lib/features/auth/auth.schema.ts';
import { autoMapBatchSheets, commitBatch, runDryRun, saveSheetSettings, stageUpload, type DryRunOptions, type DryRunResult } from '#lib/features/imports/index.server.ts';
import { importBatches } from '#lib/features/imports/imports.schema.ts';
import { allIssues } from '#lib/features/imports/validation.ts';

function option(name: string, fallback?: string): string {
	const index = process.argv.indexOf(name);
	const value = index >= 0 ? process.argv[index + 1] : fallback;
	if (!value) {
		console.error(`Opsi ${name} wajib diisi`);
		process.exit(1);
	}
	return value;
}

const url = process.env.DATABASE_URL;
if (!url) {
	console.error('Variabel lingkungan DATABASE_URL belum diatur');
	process.exit(1);
}

const directory = option('--dir', join(homedir(), 'Downloads'));
const actorEmail = option('--actor').toLowerCase();
const startYear = Number(option('--year', '2025'));
const term = option('--term', 'genap') as 'ganjil' | 'genap';
const levels = option('--levels', '1,2,3,4,5,6,7').split(',').map(Number);
const commit = process.argv.includes('--commit');
const knownNimLengths = new Set(option('--nim-lengths', '8,9,11,12').split(',').map(Number));
const options: DryRunOptions = { strategy: 'upsert', errorPolicy: 'skip_invalid_rows', confirmations: { scoreUpdates: false, weightChanges: false } };

const { client, db } = createDb(url);

async function ensureSemester(actor: { id: string; role: string }) {
	const code = `${startYear}/${startYear + 1}`;
	let [year] = await db.select().from(academicYears).where(eq(academicYears.code, code)).limit(1);
	if (!year) year = await createAcademicYear(db, actor, { startYear });
	let [semester] = await db.select().from(semesters).where(and(eq(semesters.academicYearId, year.id), eq(semesters.term, term))).limit(1);
	if (!semester) {
		const dates = term === 'genap' ? { startDate: `${startYear + 1}-02-01`, endDate: `${startYear + 1}-07-31` } : { startDate: `${startYear}-08-01`, endDate: `${startYear + 1}-01-31` };
		semester = await createSemester(db, actor, { academicYearId: year.id, term, ...dates });
	}
	const active = await getActiveSemester(db);
	if (active && active.id !== semester.id) throw new Error(`Semester aktif saat ini ${active.name} berbeda dari ${semester.name}; berhenti agar tidak berpindah diam-diam`);
	if (!active) semester = await activateSemester(db, actor, semester.id);
	return semester;
}

function nimLengthsAreKnown(plan: DryRunResult['plans'][number]) {
	return plan.rows.length > 0 && plan.rows.every((row) => knownNimLengths.has(row.nim.length) && !row.nim.startsWith('0'));
}

const histogram = (values: (string | number)[]) => {
	const counts = new Map<string, number>();
	for (const value of values) counts.set(String(value), (counts.get(String(value)) ?? 0) + 1);
	return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, count]) => `${key}:${count}`).join(',');
};

function tally(plans: DryRunResult['plans']) {
	const counts = new Map<string, number>();
	for (const plan of plans.filter((p) => p.included))
		for (const issue of allIssues(plan.validation)) counts.set(`${issue.severity}:${issue.code}`, (counts.get(`${issue.severity}:${issue.code}`) ?? 0) + 1);
	return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([key, value]) => `${key}=${value}`).join(', ') || 'tidak ada';
}

function explain(plan: DryRunResult['plans'][number]) {
	const issues = allIssues(plan.validation);
	const sheetLevel = [...new Set(issues.filter((i) => i.severity === 'error' && (i.row === null || i.row === undefined)).map((i) => `${i.code}: ${i.message}`.slice(0, 170)))];
	const rowLevel = histogram(issues.filter((i) => i.severity === 'error' && i.row !== null && i.row !== undefined).map((i) => i.code));
	return `panjang NIM {${histogram(plan.rows.map((r) => r.nim.length))}} digit awal {${histogram(plan.rows.map((r) => r.nim[0]))}} galat sheet [${sheetLevel.join(' ; ') || '-'}] galat baris {${rowLevel || '-'}}`;
}

try {
	const [actorRow] = await db.select({ id: user.id, role: user.role }).from(user).where(and(eq(user.email, actorEmail), eq(user.role, 'super_admin'))).limit(1);
	if (!actorRow) {
		console.error('Akun Super Admin untuk --actor tidak ditemukan');
		process.exit(1);
	}
	const actor = { id: actorRow.id, role: String(actorRow.role) };
	const semester = await ensureSemester(actor);
	console.log(`Semester aktif: ${semester.name} | mode: ${commit ? 'SIMPAN' : 'latihan (tanpa menyimpan nilai)'}`);

	const totals = { sheets: 0, imported: 0, excluded: 0, rowsValid: 0, rowsWarning: 0, rowsRejected: 0, scores: 0, studentsNew: 0, enrollmentsNew: 0 };
	for (const level of levels) {
		const fileName = `Semester ${level}.xlsx`;
		const bytes = new Uint8Array(readFileSync(join(directory, fileName)));
		const sha = createHash('sha256').update(bytes).digest('hex');
		const [open] = await db
			.select({ id: importBatches.id })
			.from(importBatches)
			.where(and(eq(importBatches.uploaderId, actor.id), eq(importBatches.fileSha256, sha), inArray(importBatches.status, ['uploaded', 'mapped', 'validated'])))
			.limit(1);
		let batchId = open?.id;
		if (!batchId) {
			const staged = await stageUpload(db, actor, { name: fileName, bytes });
			if (!staged.ok) {
				console.log(`${fileName}: GAGAL diunggah: ${staged.message}`);
				continue;
			}
			batchId = staged.batchId;
		}

		const mapped = await autoMapBatchSheets(db, actor, batchId);
		let result = await runDryRun(db, actor, batchId, options);
		for (const plan of result.plans.filter((p) => p.included && p.needsNumericNimAck)) {
			if (nimLengthsAreKnown(plan)) await saveSheetSettings(db, actor, batchId, plan.sheet, { acknowledgeNumericNim: true });
		}
		result = await runDryRun(db, actor, batchId, options);

		const excluded: string[] = [];
		for (const blocker of result.blockers) {
			if (excluded.some((entry) => entry.startsWith(`${blocker.sheet} [`))) continue;
			const plan = result.plans.find((p) => p.sheet === blocker.sheet);
			if (plan && !plan.included) continue;
			if (plan) console.log(`    ~ ${blocker.sheet.trim()} [${blocker.code}] ${explain(plan)}`);
			await saveSheetSettings(db, actor, batchId, blocker.sheet, { include: false });
			excluded.push(`${blocker.sheet} [${blocker.code}]`);
		}
		if (excluded.length) result = await runDryRun(db, actor, batchId, options);

		const included = result.plans.filter((p) => p.included);
		console.log(`\n${fileName}: ${result.plans.length} sheet, dipetakan otomatis ${mapped.mapped.length} (kelas baru ${mapped.mapped.filter((m) => m.created).length}), sudah terpetakan ${mapped.alreadyMapped}, dilewati pemetaan ${mapped.skipped.length}`);
		if (mapped.skipped.length) console.log(`  tanpa kelas: ${mapped.skipped.map((s) => s.sheet.trim()).join(' | ')}`);
		console.log(`  dikecualikan: ${excluded.length ? excluded.join(' | ') : 'tidak ada'}`);
		console.log(`  baris sah ${result.summary.rowsValid}, peringatan ${result.summary.rowsWarning}, ditolak ${result.summary.rowsRejected}; mahasiswa baru ${result.summary.studentsNew}, pendaftaran baru ${result.summary.enrollmentsNew}, nilai baru ${result.summary.scoresNew}`);
		console.log(`  isu: ${tally(result.plans)}`);
		console.log(`  blocker tersisa: ${result.blockers.length}`);

		totals.sheets += result.plans.length;
		totals.imported += included.length;
		totals.excluded += result.plans.length - included.length;
		totals.rowsValid += result.summary.rowsValid;
		totals.rowsWarning += result.summary.rowsWarning;
		totals.rowsRejected += result.summary.rowsRejected;

		if (commit && result.blockers.length === 0 && included.length > 0) {
			const saved = await commitBatch(db, actor, batchId, options);
			if (saved.ok) {
				totals.scores += saved.summary.scoresNew;
				totals.studentsNew += saved.summary.studentsNew;
				totals.enrollmentsNew += saved.summary.enrollmentsNew;
				console.log(`  TERSIMPAN: nilai baru ${saved.summary.scoresNew}, mahasiswa baru ${saved.summary.studentsNew}, pendaftaran baru ${saved.summary.enrollmentsNew}, perhitungan ulang ${saved.recompute}`);
			} else {
				console.log(`  PENYIMPANAN DITAHAN: ${saved.blockers.map((b) => `${b.sheet} [${b.code}]`).join(' | ')}`);
			}
		}
	}
	console.log(`\nRINGKASAN: sheet ${totals.sheets}, diimpor ${totals.imported}, dikecualikan ${totals.excluded}; baris sah ${totals.rowsValid}, peringatan ${totals.rowsWarning}, ditolak ${totals.rowsRejected}${commit ? `; tersimpan: mahasiswa baru ${totals.studentsNew}, pendaftaran ${totals.enrollmentsNew}, nilai ${totals.scores}` : ''}`);
} finally {
	await client.end();
}
