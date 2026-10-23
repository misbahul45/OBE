import { eq } from 'drizzle-orm';
import type { Database } from '#lib/shared/db/client.server.ts';
import { ValidationError } from '#lib/shared/http/errors.ts';
import { appRoles } from '#lib/features/auth/index.ts';
import { courseOfferings, courses } from '#lib/features/academic/academic.schema.ts';
import { createOffering, getActiveSemester } from '#lib/features/academic/index.server.ts';
import { assertBatchOpen, loadBatch, saveSheetSettings, type ImportActor } from './imports.batch.server.ts';
import { pickOffering, resolveSheet } from './sheet-target.ts';

export type AutoMapEntry = { sheet: string; courseCode: string; courseName: string; section: string; created: boolean };
export type AutoMapSkip = { sheet: string; reason: string };
export type AutoMapResult = { semesterName: string; mapped: AutoMapEntry[]; skipped: AutoMapSkip[]; alreadyMapped: number };

export async function autoMapBatchSheets(db: Database, actor: ImportActor, batchId: string): Promise<AutoMapResult> {
	await assertBatchOpen(db, actor, batchId);
	const semester = await getActiveSemester(db);
	if (!semester) throw new ValidationError({ semester: ['Belum ada semester aktif. Super Admin perlu mengaktifkan semester pada menu Tahun akademik sebelum sheet dapat dipetakan.'] });

	const loaded = await loadBatch(db, actor, batchId);
	const catalog = await db.select({ id: courses.id, code: courses.code, name: courses.name }).from(courses).where(eq(courses.isActive, true));
	const semesterOfferings = await db
		.select({ id: courseOfferings.id, courseCode: courses.code, section: courseOfferings.section })
		.from(courseOfferings)
		.innerJoin(courses, eq(courses.id, courseOfferings.courseId))
		.where(eq(courseOfferings.semesterId, semester.id));
	const used = new Set(loaded.sheets.map((sheet) => sheet.row.offeringId).filter((id): id is string => id !== null));
	const canCreate = actor.role === appRoles.superAdmin;

	const mapped: AutoMapEntry[] = [];
	const skipped: AutoMapSkip[] = [];
	let alreadyMapped = 0;

	for (const sheet of loaded.sheets) {
		const name = sheet.row.sheetName;
		if (sheet.stored.mapping === null) continue;
		if (sheet.row.offeringId !== null) {
			alreadyMapped += 1;
			continue;
		}
		const resolved = resolveSheet(name, catalog);
		if (!resolved) {
			skipped.push({ sheet: name, reason: 'Nama sheet tidak cocok dengan mata kuliah mana pun. Pilih kelas secara manual.' });
			continue;
		}
		const { course, section } = resolved;
		const courseId = catalog.find((entry) => entry.code === course.code)!.id;
		const existing = pickOffering(semesterOfferings, resolved);

		let offeringId = existing?.id ?? null;
		let targetSection = existing?.section ?? section;
		let created = false;
		if (!offeringId && canCreate) {
			offeringId = (await createOffering(db, actor, { courseId, semesterId: semester.id, section })).id;
			semesterOfferings.push({ id: offeringId, courseCode: course.code, section });
			created = true;
		}
		if (!offeringId) {
			skipped.push({ sheet: name, reason: `Kelas ${course.name} ${targetSection} belum dibuka pada ${semester.name}. Minta Super Admin membukanya.` });
			continue;
		}
		if (used.has(offeringId)) {
			skipped.push({ sheet: name, reason: `Sheet lain pada berkas ini sudah dipetakan ke ${course.name} kelas ${targetSection}. Pilih kelas secara manual.` });
			continue;
		}
		try {
			await saveSheetSettings(db, actor, batchId, name, { offeringId });
		} catch (error) {
			if (error instanceof ValidationError) {
				skipped.push({ sheet: name, reason: `Anda tidak ditugaskan pada ${course.name} kelas ${targetSection}.` });
				continue;
			}
			throw error;
		}
		used.add(offeringId);
		mapped.push({ sheet: name, courseCode: course.code, courseName: course.name, section: targetSection, created });
	}

	return { semesterName: semester.name, mapped, skipped, alreadyMapped };
}
