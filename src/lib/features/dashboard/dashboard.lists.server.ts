import { count, desc, eq } from 'drizzle-orm';
import type { Database } from '#lib/shared/db/client.server.ts';
import { accessibleOfferingIds, getActiveSemester, listOfferings } from '#lib/features/academic/index.server.ts';
import { importBatches } from '#lib/features/imports/imports.schema.ts';
import { getOfferingAnalytics, getProgramAnalytics } from '#lib/features/outcomes/index.server.ts';
import { courses } from '#lib/features/academic/academic.schema.ts';
import { cplDefinitions } from '#lib/features/curriculum/curriculum.schema.ts';
import { graduateProfiles } from '#lib/features/profiles/profiles.schema.ts';
import { appRoles } from '#lib/features/auth/index.ts';
import { buildSetupSteps } from './dashboard.setup.ts';
import type { CourseSummary } from './dashboard.types.ts';

export type { CourseSummary };

export type DashboardActor = { id: string; role: string };

export async function listCourseSummaries(db: Database, actor: DashboardActor): Promise<{ semester: { id: string; name: string } | null; rows: CourseSummary[] }> {
	const accessible = await accessibleOfferingIds(db, actor);
	const semester = await getActiveSemester(db);
	if (!semester) return { semester: null, rows: [] };
	const list = await listOfferings(db, { accessible, semesterId: semester.id, pageSize: 100 });
	const rows: CourseSummary[] = [];
	for (const offering of list.rows) {
		const analytics = await getOfferingAnalytics(db, offering.id);
		const weights = analytics.weights;
		rows.push({
			offeringId: offering.id,
			courseCode: offering.courseCode,
			courseName: offering.courseName,
			section: offering.section,
			credits: offering.credits,
			students: analytics.studentCount,
			components: weights.count,
			weightsState: weights.count === 0 ? 'none' : !weights.complete ? 'incomplete' : weights.ok ? 'ok' : 'mismatch',
			finalMean: analytics.finalScore.mean,
			cpmk: analytics.cpmk.map((c) => ({ code: c.code, mean: c.mean, meetsClassRatio: c.meetsClassRatio })),
			warnings: analytics.warnings
		});
	}
	return { semester: { id: semester.id, name: semester.name }, rows };
}

export async function recentImports(db: Database, actor: DashboardActor, limit = 5) {
	const rows = await db
		.select({ id: importBatches.id, fileName: importBatches.fileName, status: importBatches.status, createdAt: importBatches.createdAt })
		.from(importBatches)
		.where(actor.role === appRoles.superAdmin ? undefined : eq(importBatches.uploaderId, actor.id))
		.orderBy(desc(importBatches.createdAt))
		.limit(limit);
	return rows;
}

export async function adminDashboard(db: Database, actor: DashboardActor) {
	const [program, imports, [cplRow], [profileRow], [courseRow]] = await Promise.all([
		getProgramAnalytics(db),
		recentImports(db, actor, 6),
		db.select({ value: count() }).from(cplDefinitions),
		db.select({ value: count() }).from(graduateProfiles),
		db.select({ value: count() }).from(courses)
	]);
	const setup = buildSetupSteps({
		cpl: cplRow.value,
		profiles: profileRow.value,
		semesterActive: program.semester !== null,
		courses: courseRow.value,
		offerings: program.totals.offerings,
		lecturers: program.totals.lecturers,
		activePolicy: program.policy !== null,
		committedImports: program.totals.committedImports
	});
	return { program, imports, setup };
}

export async function lecturerDashboard(db: Database, actor: DashboardActor) {
	const [courses, imports] = await Promise.all([listCourseSummaries(db, actor), recentImports(db, actor, 5)]);
	return { ...courses, imports };
}
