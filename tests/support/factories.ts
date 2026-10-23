import { randomUUID } from 'node:crypto';
import type { Database } from '#lib/shared/db/client.server.ts';
import {
	academicYears,
	assessmentComponents,
	courseOfferings,
	courses,
	enrollments,
	lecturers,
	semesters,
	students,
	user
} from '#lib/shared/db/schema.ts';

let sequence = 0;
const next = () => ++sequence;

export async function createUser(db: Database, overrides: Partial<typeof user.$inferInsert> = {}) {
	const n = next();
	const [row] = await db
		.insert(user)
		.values({ id: `usr_${randomUUID()}`, name: `Pengguna Uji ${n}`, email: `pengguna${n}@uji.invalid`, role: 'lecturer', ...overrides })
		.returning();
	return row;
}

export async function createLecturer(db: Database) {
	const account = await createUser(db);
	const [lecturer] = await db.insert(lecturers).values({ userId: account.id, lecturerCode: `DSN${next()}` }).returning();
	return { account, lecturer };
}

export async function createTerm(db: Database, overrides: { term?: 'ganjil' | 'genap' | 'pendek'; status?: 'planned' | 'active' | 'closed'; startYear?: number } = {}) {
	const startYear = overrides.startYear ?? 2000 + (next() % 99);
	const [year] = await db.insert(academicYears).values({ code: `${startYear}/${startYear + 1}`, startYear }).returning();
	const [semester] = await db
		.insert(semesters)
		.values({
			academicYearId: year.id,
			term: overrides.term ?? 'ganjil',
			name: `Semester Uji ${startYear}`,
			startDate: `${startYear}-08-01`,
			endDate: `${startYear + 1}-01-31`,
			status: overrides.status ?? 'planned'
		})
		.returning();
	return { year, semester };
}

export async function createCourse(db: Database, overrides: Partial<typeof courses.$inferInsert> = {}) {
	const n = next();
	const [row] = await db.insert(courses).values({ code: `UJI${100 + n}`, name: `Mata Kuliah Uji ${n}`, credits: 3, ...overrides }).returning();
	return row;
}

export async function createOffering(db: Database, overrides: { courseId?: string; semesterId?: string; section?: string } = {}) {
	const courseId = overrides.courseId ?? (await createCourse(db)).id;
	const semesterId = overrides.semesterId ?? (await createTerm(db)).semester.id;
	const [row] = await db.insert(courseOfferings).values({ courseId, semesterId, section: overrides.section ?? 'A' }).returning();
	return row;
}

export async function createStudent(db: Database, overrides: Partial<typeof students.$inferInsert> = {}) {
	const n = next();
	const [row] = await db
		.insert(students)
		.values({ nim: `99000${String(n).padStart(6, '0')}`, name: `Mahasiswa Uji ${String(n).padStart(3, '0')}`, ...overrides })
		.returning();
	return row;
}

export async function createEnrollment(db: Database, overrides: { studentId?: string; offeringId?: string } = {}) {
	const studentId = overrides.studentId ?? (await createStudent(db)).id;
	const offeringId = overrides.offeringId ?? (await createOffering(db)).id;
	const [row] = await db.insert(enrollments).values({ studentId, offeringId }).returning();
	return row;
}

export async function createComponent(db: Database, overrides: Partial<typeof assessmentComponents.$inferInsert> & { offeringId?: string } = {}) {
	const offeringId = overrides.offeringId ?? (await createOffering(db)).id;
	const n = next();
	const [row] = await db
		.insert(assessmentComponents)
		.values({ code: `K${n}`, name: `Komponen Uji ${n}`, ...overrides, offeringId })
		.returning();
	return row;
}
