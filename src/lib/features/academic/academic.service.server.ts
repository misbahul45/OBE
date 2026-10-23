import { and, eq, ne } from 'drizzle-orm';
import type { Database } from '#lib/shared/db/client.server.ts';
import { isForeignKeyViolation, isUniqueViolation } from '#lib/shared/db/errors.ts';
import { NotFoundError, ValidationError } from '#lib/shared/http/errors.ts';
import { parseOrThrow } from '#lib/shared/http/zod.ts';
import { recordAudit } from '#lib/features/audit/index.server.ts';
import { academicYears, courseOfferings, courses, lecturerAssignments, semesters } from './academic.schema.ts';
import { academicYearSchema, assignmentSchema, courseSchema, offeringSchema, semesterSchema, termLabels, type AcademicActor } from './academic.validation.ts';

const audit = (actor: AcademicActor) => ({ actorId: actor.id, actorRole: actor.role });

export async function createAcademicYear(db: Database, actor: AcademicActor, input: unknown) {
	const { startYear } = parseOrThrow(academicYearSchema, input);
	try {
		const [year] = await db.insert(academicYears).values({ code: `${startYear}/${startYear + 1}`, startYear }).returning();
		await recordAudit(db, { ...audit(actor), action: 'academic_year.create', entityType: 'academic_year', entityId: year.id, summary: `Tahun akademik ${year.code} dibuat`, after: year });
		return year;
	} catch (error) {
		if (isUniqueViolation(error)) throw new ValidationError({ startYear: [`Tahun akademik ${startYear}/${startYear + 1} sudah ada`] });
		throw error;
	}
}

export async function createSemester(db: Database, actor: AcademicActor, input: unknown) {
	const data = parseOrThrow(semesterSchema, input);
	const [year] = await db.select().from(academicYears).where(eq(academicYears.id, data.academicYearId)).limit(1);
	if (!year) throw new ValidationError({ academicYearId: ['Tahun akademik tidak ditemukan'] });
	try {
		const [semester] = await db
			.insert(semesters)
			.values({ ...data, name: `${termLabels[data.term]} ${year.code}` })
			.returning();
		await recordAudit(db, { ...audit(actor), action: 'semester.create', entityType: 'semester', entityId: semester.id, summary: `Semester ${semester.name} dibuat`, after: semester });
		return semester;
	} catch (error) {
		if (isUniqueViolation(error)) throw new ValidationError({ term: [`Semester ${termLabels[data.term]} untuk ${year.code} sudah ada`] });
		throw error;
	}
}

export async function activateSemester(db: Database, actor: AcademicActor, semesterId: string) {
	return db.transaction(async (tx) => {
		const [target] = await tx.select().from(semesters).where(eq(semesters.id, semesterId)).limit(1);
		if (!target) throw new NotFoundError('Semester tidak ditemukan.');
		const previous = await tx.update(semesters).set({ status: 'closed' }).where(and(eq(semesters.status, 'active'), ne(semesters.id, semesterId))).returning({ id: semesters.id });
		await tx.update(academicYears).set({ isActive: false }).where(and(eq(academicYears.isActive, true), ne(academicYears.id, target.academicYearId)));
		await tx.update(academicYears).set({ isActive: true }).where(eq(academicYears.id, target.academicYearId));
		const [activated] = await tx.update(semesters).set({ status: 'active' }).where(eq(semesters.id, semesterId)).returning();
		await recordAudit(tx, {
			...audit(actor),
			action: 'semester.activate',
			entityType: 'semester',
			entityId: semesterId,
			summary: `Semester ${activated.name} diaktifkan`,
			before: { previousActive: previous.map((p) => p.id) },
			after: { status: 'active' }
		});
		return activated;
	});
}

export async function closeSemester(db: Database, actor: AcademicActor, semesterId: string) {
	const [closed] = await db.update(semesters).set({ status: 'closed' }).where(eq(semesters.id, semesterId)).returning();
	if (!closed) throw new NotFoundError('Semester tidak ditemukan.');
	await recordAudit(db, { ...audit(actor), action: 'semester.close', entityType: 'semester', entityId: semesterId, summary: `Semester ${closed.name} ditutup`, after: { status: 'closed' } });
	return closed;
}

export async function createCourse(db: Database, actor: AcademicActor, input: unknown) {
	const data = parseOrThrow(courseSchema, input);
	try {
		const [course] = await db.insert(courses).values(data).returning();
		await recordAudit(db, { ...audit(actor), action: 'course.create', entityType: 'course', entityId: course.id, summary: `Mata kuliah ${course.code} dibuat`, after: course });
		return course;
	} catch (error) {
		if (isUniqueViolation(error)) throw new ValidationError({ code: [`Kode ${data.code} sudah dipakai mata kuliah lain`] });
		throw error;
	}
}

export async function updateCourse(db: Database, actor: AcademicActor, courseId: string, input: unknown) {
	const data = parseOrThrow(courseSchema, input);
	const [before] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
	if (!before) throw new NotFoundError('Mata kuliah tidak ditemukan.');
	try {
		const [after] = await db.update(courses).set(data).where(eq(courses.id, courseId)).returning();
		await recordAudit(db, { ...audit(actor), action: 'course.update', entityType: 'course', entityId: courseId, summary: `Mata kuliah ${after.code} diperbarui`, before, after });
		return after;
	} catch (error) {
		if (isUniqueViolation(error)) throw new ValidationError({ code: [`Kode ${data.code} sudah dipakai mata kuliah lain`] });
		throw error;
	}
}

export async function setCourseActive(db: Database, actor: AcademicActor, courseId: string, isActive: boolean) {
	const [after] = await db.update(courses).set({ isActive }).where(eq(courses.id, courseId)).returning();
	if (!after) throw new NotFoundError('Mata kuliah tidak ditemukan.');
	await recordAudit(db, { ...audit(actor), action: isActive ? 'course.activate' : 'course.deactivate', entityType: 'course', entityId: courseId, summary: `Mata kuliah ${after.code} ${isActive ? 'diaktifkan' : 'dinonaktifkan'}`, after: { isActive } });
	return after;
}

export async function createOffering(db: Database, actor: AcademicActor, input: unknown) {
	const data = parseOrThrow(offeringSchema, input);
	try {
		const [offering] = await db.insert(courseOfferings).values(data).returning();
		await recordAudit(db, { ...audit(actor), action: 'offering.create', entityType: 'course_offering', entityId: offering.id, summary: `Penawaran kelas ${data.section} dibuat`, after: offering });
		return offering;
	} catch (error) {
		if (isUniqueViolation(error)) throw new ValidationError({ section: ['Kelas ini sudah ada untuk mata kuliah dan semester tersebut'] });
		if (isForeignKeyViolation(error)) throw new ValidationError({ courseId: ['Mata kuliah atau semester tidak ditemukan'] });
		throw error;
	}
}

export async function assignLecturer(db: Database, actor: AcademicActor, input: unknown) {
	const data = parseOrThrow(assignmentSchema, input);
	try {
		const [assignment] = await db.insert(lecturerAssignments).values(data).returning();
		await recordAudit(db, { ...audit(actor), action: 'lecturer_assignment.create', entityType: 'lecturer_assignment', entityId: assignment.id, summary: 'Dosen ditugaskan ke penawaran kelas', after: assignment });
		return assignment;
	} catch (error) {
		if (isUniqueViolation(error)) throw new ValidationError({ lecturerId: ['Dosen sudah ditugaskan pada kelas ini'] });
		if (isForeignKeyViolation(error)) throw new ValidationError({ lecturerId: ['Dosen atau penawaran kelas tidak ditemukan'] });
		throw error;
	}
}

export async function removeAssignment(db: Database, actor: AcademicActor, assignmentId: string) {
	const [removed] = await db.delete(lecturerAssignments).where(eq(lecturerAssignments.id, assignmentId)).returning();
	if (!removed) throw new NotFoundError('Penugasan tidak ditemukan.');
	await recordAudit(db, { ...audit(actor), action: 'lecturer_assignment.delete', entityType: 'lecturer_assignment', entityId: assignmentId, summary: 'Penugasan dosen dicabut', before: removed });
	return removed;
}
