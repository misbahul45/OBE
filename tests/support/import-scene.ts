import type { Database } from '#lib/shared/db/client.server.ts';
import { activateSemester, assignLecturer, createOffering, getActiveSemester } from '#lib/features/academic/index.server.ts';
import { createCpmk } from '#lib/features/curriculum/index.server.ts';
import { cplDefinitions } from '#lib/shared/db/schema.ts';
import { createCourse, createLecturer, createTerm, createUser } from './factories.ts';

export type SceneActor = { id: string; role: string };

export async function createImportScene(db: Database) {
	const adminUser = await createUser(db, { role: 'super_admin' });
	const admin: SceneActor = { id: adminUser.id, role: 'super_admin' };
	const semester = (await getActiveSemester(db)) ?? (await activateSemester(db, admin, (await createTerm(db)).semester.id));

	const courseA = await createCourse(db, { name: 'Kelas Uji B' });
	const courseB = await createCourse(db, { name: 'Mata Kuliah Uji A' });
	const offeringA = await createOffering(db, admin, { courseId: courseA.id, semesterId: semester.id, section: 'T1' });
	const offeringB = await createOffering(db, admin, { courseId: courseB.id, semesterId: semester.id, section: 'A' });
	const a = await createLecturer(db);
	const b = await createLecturer(db);
	await assignLecturer(db, admin, { offeringId: offeringA.id, lecturerId: a.lecturer.id });
	await assignLecturer(db, admin, { offeringId: offeringB.id, lecturerId: b.lecturer.id });
	return {
		admin,
		semester,
		offeringA,
		offeringB,
		courseA,
		courseB,
		lecturerA: { id: a.account.id, role: 'lecturer' } as SceneActor,
		lecturerB: { id: b.account.id, role: 'lecturer' } as SceneActor
	};
}

export async function defineCpmk(db: Database, admin: SceneActor, courseId: string, codes: string[]) {
	for (const code of codes) await createCpmk(db, admin, { courseId, code });
}

export async function ensureCpl(db: Database, codes: string[]) {
	await db.insert(cplDefinitions).values(codes.map((code, i) => ({ code, title: `Capaian ${code}`, sortOrder: i }))).onConflictDoNothing();
}
