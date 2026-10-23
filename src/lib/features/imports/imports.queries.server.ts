import { and, asc, count, desc, eq, ilike, inArray, sql, type SQL } from 'drizzle-orm';
import type { Database } from '#lib/shared/db/client.server.ts';
import { toCsv } from '#lib/shared/format/csv.ts';
import { courseOfferings, courses, semesters } from '#lib/features/academic/academic.schema.ts';
import { assessmentScores } from '#lib/features/assessment/assessment.schema.ts';
import { user } from '#lib/features/auth/auth.schema.ts';
import { appRoles } from '#lib/features/auth/index.ts';
import { maskNim } from '#lib/features/audit/index.server.ts';
import { enrollments } from '#lib/features/enrollments/enrollments.schema.ts';
import { students } from '#lib/features/students/students.schema.ts';
import { importBatches, importRowIssues, importSheetMappings } from './imports.schema.ts';
import { assertBatchAccess, type ImportActor } from './imports.batch.server.ts';

export type BatchListFilters = { page?: number; pageSize?: number; status?: typeof importBatches.$inferSelect.status; search?: string };

const like = (value: string) => `%${value.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export async function listBatches(db: Database, actor: ImportActor, filters: BatchListFilters = {}) {
	const pageSize = Math.min(100, Math.max(1, Math.trunc(filters.pageSize ?? 20)));
	const page = Math.max(1, Math.trunc(filters.page ?? 1));
	const where: (SQL | undefined)[] = [
		actor.role === appRoles.superAdmin ? undefined : eq(importBatches.uploaderId, actor.id),
		filters.status ? eq(importBatches.status, filters.status) : undefined,
		filters.search ? ilike(importBatches.fileName, like(filters.search)) : undefined
	];
	const [{ total }] = await db.select({ total: count() }).from(importBatches).where(and(...where));
	const rows = await db
		.select({
			id: importBatches.id,
			fileName: importBatches.fileName,
			status: importBatches.status,
			createdAt: importBatches.createdAt,
			finishedAt: importBatches.finishedAt,
			uploaderName: user.name,
			totalRows: importBatches.totalRows,
			errorRows: importBatches.errorRows,
			scoresInserted: importBatches.scoresInserted,
			scoresUpdated: importBatches.scoresUpdated,
			sheetCount: sql<number>`(select count(*)::int from ${importSheetMappings} where ${importSheetMappings.batchId} = ${importBatches.id})`
		})
		.from(importBatches)
		.innerJoin(user, eq(user.id, importBatches.uploaderId))
		.where(and(...where))
		.orderBy(desc(importBatches.createdAt))
		.limit(pageSize)
		.offset((page - 1) * pageSize);
	return { rows: rows.map((r) => ({ ...r, sheetCount: Number(r.sheetCount) })), total: Number(total), page, pageSize, pageCount: Math.max(1, Math.ceil(Number(total) / pageSize)) };
}

export async function getBatchDetail(db: Database, actor: ImportActor, batchId: string) {
	const batch = await assertBatchAccess(db, actor, batchId);
	const [uploader] = await db.select({ name: user.name }).from(user).where(eq(user.id, batch.uploaderId)).limit(1);
	const sheets = await db
		.select({
			sheetName: importSheetMappings.sheetName,
			status: importSheetMappings.status,
			include: importSheetMappings.include,
			rowCount: importSheetMappings.rowCount,
			offeringId: importSheetMappings.offeringId,
			courseCode: courses.code,
			courseName: courses.name,
			section: courseOfferings.section,
			semesterName: semesters.name
		})
		.from(importSheetMappings)
		.leftJoin(courseOfferings, eq(courseOfferings.id, importSheetMappings.offeringId))
		.leftJoin(courses, eq(courses.id, courseOfferings.courseId))
		.leftJoin(semesters, eq(semesters.id, courseOfferings.semesterId))
		.where(eq(importSheetMappings.batchId, batchId))
		.orderBy(asc(importSheetMappings.sheetName));
	const issueTotals = await db
		.select({ severity: importRowIssues.severity, n: count() })
		.from(importRowIssues)
		.where(eq(importRowIssues.batchId, batchId))
		.groupBy(importRowIssues.severity);
	const issues = await db
		.select()
		.from(importRowIssues)
		.where(eq(importRowIssues.batchId, batchId))
		.orderBy(sql`case ${importRowIssues.severity} when 'error' then 0 when 'warning' then 1 else 2 end`, asc(importRowIssues.sheetName), asc(importRowIssues.rowNumber))
		.limit(200);
	const affected = await db
		.selectDistinct({ id: students.id, nim: students.nim, name: students.name })
		.from(assessmentScores)
		.innerJoin(enrollments, eq(enrollments.id, assessmentScores.enrollmentId))
		.innerJoin(students, eq(students.id, enrollments.studentId))
		.where(eq(assessmentScores.sourceBatchId, batchId))
		.orderBy(asc(students.name))
		.limit(30);
	const [{ affectedTotal }] = await db
		.select({ affectedTotal: sql<number>`count(distinct ${enrollments.studentId})::int` })
		.from(assessmentScores)
		.innerJoin(enrollments, eq(enrollments.id, assessmentScores.enrollmentId))
		.where(eq(assessmentScores.sourceBatchId, batchId));
	return {
		batch,
		uploaderName: uploader?.name ?? '—',
		sheets,
		issueTotals: Object.fromEntries(issueTotals.map((t) => [t.severity, Number(t.n)])) as Partial<Record<'error' | 'warning' | 'info', number>>,
		issues,
		affectedStudents: affected.map((s) => ({ id: s.id, nimMasked: maskNim(s.nim), name: s.name })),
		affectedTotal: Number(affectedTotal)
	};
}

export async function buildIssuesCsv(db: Database, actor: ImportActor, batchId: string): Promise<string> {
	await assertBatchAccess(db, actor, batchId);
	const issues = await db
		.select()
		.from(importRowIssues)
		.where(and(eq(importRowIssues.batchId, batchId), inArray(importRowIssues.severity, ['error', 'warning', 'info'])))
		.orderBy(asc(importRowIssues.sheetName), asc(importRowIssues.rowNumber), asc(importRowIssues.code));
	return toCsv(
		['Sheet', 'Baris', 'Kolom', 'Bidang', 'Tingkat', 'Kode', 'Pesan'],
		issues.map((i) => [i.sheetName, i.rowNumber, i.columnRef, i.field, i.severity, i.code, i.message])
	);
}
