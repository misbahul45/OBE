import { mkdirSync, writeFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { createDb } from '#lib/shared/db/client.server.ts';
import { resetTestDatabase } from '#lib/shared/db/test-database.server.ts';
import { courses, user } from '#lib/shared/db/schema.ts';
import { createAuth } from '#lib/features/auth/auth.factory.server.ts';
import { generateTemporaryPassword } from '#lib/features/auth/index.ts';
import { ensureSuperAdmin } from '#lib/features/auth/superadmin.service.server.ts';
import { activateSemester, assignLecturer, createAcademicYear, createCourse, createOffering, createSemester } from '#lib/features/academic/index.server.ts';
import { createLecturerAccount } from '#lib/features/lecturers/index.server.ts';
import { activatePolicy, createCpl, createCpmk, createDraftPolicy, listComponents, setAssessmentCpmkMapping, setCplTarget, setCpmkCplMapping } from '#lib/features/curriculum/index.server.ts';
import { commitBatch, saveSheetSettings, stageUpload } from '#lib/features/imports/index.server.ts';
import { recomputeOffering } from '#lib/features/outcomes/index.server.ts';
import { seedProgramBlueprint } from '#lib/features/profiles/index.server.ts';
import { buildSemesterWorkbook } from '../tests/fixtures/builders/templates.ts';
import { credentialsPath, stateDirectory, type E2eState } from '../tests/support/e2e/credentials.ts';

function required(name: string): string {
	const value = process.env[name];
	if (!value) {
		console.error(`Variabel lingkungan ${name} belum diatur`);
		process.exit(1);
	}
	return value;
}

const testUrl = required('TEST_DATABASE_URL');
await resetTestDatabase(testUrl);

const { client, db } = createDb(testUrl);
const auth = createAuth({ db, secret: required('BETTER_AUTH_SECRET'), baseURL: required('ORIGIN'), rateLimitEnabled: false });

try {
	const adminPassword = generateTemporaryPassword(20);
	const adminEmail = 'admin@e2e.invalid';
	await ensureSuperAdmin({ auth, db }, { email: adminEmail, name: 'Admin Uji E2E', password: adminPassword });
	const [admin] = await db.select({ id: user.id, role: user.role }).from(user).where(eq(user.email, adminEmail)).limit(1);
	const actor = { id: admin.id, role: admin.role as string };

	const year = 2026;
	const academicYear = await createAcademicYear(db, actor, { startYear: year });
	const created = await createSemester(db, actor, { academicYearId: academicYear.id, term: 'ganjil', startDate: `${year}-08-01`, endDate: `${year + 1}-01-31` });
	const semester = await activateSemester(db, actor, created.id);

	const courseA = await createCourse(db, actor, { code: 'E2EA', name: 'Mata Kuliah Uji A', credits: 3 });
	const courseB = await createCourse(db, actor, { code: 'E2EB', name: 'Kelas Uji B', credits: 2 });
	await createCourse(db, actor, { code: 'E2EX', name: 'Mata Kuliah Uji C', credits: 2 });
	const offeringA = await createOffering(db, actor, { courseId: courseA.id, semesterId: semester.id, section: 'A' });
	const offeringB = await createOffering(db, actor, { courseId: courseB.id, semesterId: semester.id, section: 'T1' });

	const lecturerAInfo = await createLecturerAccount({ auth, db }, actor, { name: 'Dosen Uji Satu', email: 'dosen.satu@e2e.invalid', lecturerCode: 'E2E1' });
	const lecturerBInfo = await createLecturerAccount({ auth, db }, actor, { name: 'Dosen Uji Dua', email: 'dosen.dua@e2e.invalid', lecturerCode: 'E2E2' });
	await db.update(user).set({ mustChangePassword: false }).where(eq(user.email, lecturerAInfo.email));
	await db.update(user).set({ mustChangePassword: false }).where(eq(user.email, lecturerBInfo.email));
	await assignLecturer(db, actor, { offeringId: offeringA.id, lecturerId: lecturerAInfo.lecturerId });
	await assignLecturer(db, actor, { offeringId: offeringB.id, lecturerId: lecturerBInfo.lecturerId });

	const cpl = [];
	for (const [i, title] of ['Dasar ilmu biomedis', 'Analisis data biomedis', 'Pengembangan solusi teknologi kesehatan'].entries()) cpl.push(await createCpl(db, actor, { code: `CPL-${i + 1}`, title, sortOrder: i }));
	const cpmk = [];
	for (let i = 1; i <= 5; i++) cpmk.push(await createCpmk(db, actor, { courseId: courseA.id, code: `CPMK-${i}` }));
	const cplOf = [0, 0, 1, 2, 2];
	for (const [i, item] of cpmk.entries()) await setCpmkCplMapping(db, actor, { cpmkId: item.id, cplId: cpl[cplOf[i]].id, weight: 1 });

	const policy = await createDraftPolicy(db, actor, { name: 'Kebijakan uji E2E', scaleMax: 100, achievementThreshold: 70, classAchievementRatio: 70, weightTolerance: 0.01, aggregationMethod: 'simple_mean' });
	for (const item of cpl) await setCplTarget(db, actor, { policyId: policy.id, cplId: item.id, target: 70 });
	await activatePolicy(db, actor, policy.id);

	const upload = await stageUpload(db, actor, { name: 'seed-e2e.xlsx', bytes: buildSemesterWorkbook() });
	if (!upload.ok) throw new Error(upload.message);
	await saveSheetSettings(db, actor, upload.batchId, 'Mata Kuliah Uji A', { offeringId: offeringA.id, acknowledgeNumericNim: true });
	await saveSheetSettings(db, actor, upload.batchId, 'Kelas Uji B T1', { include: false });
	const committed = await commitBatch(db, actor, upload.batchId, { strategy: 'upsert', errorPolicy: 'block_on_error', confirmations: { scoreUpdates: true, weightChanges: true } });
	if (!committed.ok) throw new Error(committed.blockers.map((b) => b.message).join('; '));

	const { components } = await listComponents(db, offeringA.id);
	for (const [i, component] of components.entries()) await setAssessmentCpmkMapping(db, actor, { componentId: component.id, cpmkId: cpmk[i % cpmk.length].id, coefficient: 1 });
	await recomputeOffering(db, actor, offeringA.id, 'e2e_seed');
	await seedProgramBlueprint(db);

	const [storedA] = await db.select({ id: courses.id }).from(courses).where(eq(courses.code, 'E2EA')).limit(1);
	const state: E2eState = {
		admin: { email: adminEmail, password: adminPassword, name: 'Admin Uji E2E' },
		lecturerA: { email: lecturerAInfo.email, password: lecturerAInfo.temporaryPassword, name: 'Dosen Uji Satu' },
		lecturerB: { email: lecturerBInfo.email, password: lecturerBInfo.temporaryPassword, name: 'Dosen Uji Dua' },
		ids: { offeringA: offeringA.id, offeringB: offeringB.id, courseA: storedA.id, courseB: courseB.id }
	};
	mkdirSync(stateDirectory, { recursive: true });
	writeFileSync(credentialsPath, JSON.stringify(state, null, '\t'));
	console.log('Seed E2E selesai: 2 dosen, 2 kelas, 15 mahasiswa sintetis pada kelas A.');
} finally {
	await client.end();
}
