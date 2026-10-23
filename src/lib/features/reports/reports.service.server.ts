import type { Database } from '#lib/shared/db/client.server.ts';
import { assertOfferingAccess } from '#lib/features/academic/index.server.ts';
import { recordAudit } from '#lib/features/audit/index.server.ts';
import { getOfferingAnalytics, getOfferingRoster } from '#lib/features/outcomes/index.server.ts';
import { getStudentProfile, type StudentScope } from '#lib/features/students/index.server.ts';
import { renderClassReport, renderStudentTranscript } from './reports.pdf.server.ts';
import { reportContentTypes, safeReportFileName, type ReportFile } from './reports.types.ts';

export type ReportActor = { id: string; role: string };

export async function downloadStudentTranscript(db: Database, actor: ReportActor, scope: StudentScope, studentId: string): Promise<ReportFile> {
	const profile = await getStudentProfile(db, scope, studentId);
	const body = await renderStudentTranscript(profile);
	await recordAudit(db, {
		actorId: actor.id,
		actorRole: actor.role,
		action: 'report.download',
		entityType: 'student',
		entityId: studentId,
		summary: 'Transkrip PDF mahasiswa diunduh',
		after: { kind: 'student_transcript', enrollments: profile.enrollments.length, scopeLimited: profile.scopeLimited }
	});
	return { fileName: safeReportFileName(['transkrip', studentId.slice(0, 8)], 'pdf'), contentType: reportContentTypes.pdf, body };
}

export async function downloadClassReport(db: Database, actor: ReportActor, offeringId: string): Promise<ReportFile> {
	await assertOfferingAccess(db, actor, offeringId);
	const [analytics, roster] = await Promise.all([getOfferingAnalytics(db, offeringId), getOfferingRoster(db, offeringId)]);
	const body = await renderClassReport(analytics, roster);
	await recordAudit(db, {
		actorId: actor.id,
		actorRole: actor.role,
		action: 'report.download',
		entityType: 'course_offering',
		entityId: offeringId,
		summary: 'Laporan kelas PDF diunduh',
		after: { kind: 'class_report', students: roster.length }
	});
	return { fileName: safeReportFileName(['laporan-kelas', analytics.offering.courseCode, analytics.offering.section], 'pdf'), contentType: reportContentTypes.pdf, body };
}

export function reportResponse(file: ReportFile): Response {
	return new Response(typeof file.body === 'string' ? file.body : new Uint8Array(file.body), {
		headers: {
			'content-type': file.contentType,
			'content-disposition': `attachment; filename="${file.fileName}"`,
			'cache-control': 'no-store',
			'x-content-type-options': 'nosniff'
		}
	});
}
