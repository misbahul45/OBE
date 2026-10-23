import { eq } from 'drizzle-orm';
import { createDb } from '#lib/shared/db/client.server.ts';
import { courseOfferings, courses, user } from '#lib/shared/db/schema.ts';
import { createAuth } from '#lib/features/auth/auth.factory.server.ts';
import { generateTemporaryPassword } from '#lib/features/auth/index.ts';
import { ensureSuperAdmin } from '#lib/features/auth/superadmin.service.server.ts';
import { activateSemester, assignLecturer, createAcademicYear, createCourse, createOffering, createSemester, getActiveSemester } from '#lib/features/academic/index.server.ts';
import { createLecturerAccount } from '#lib/features/lecturers/index.server.ts';
import { activatePolicy, cloneActivePolicyAsDraft, createCpl, createCpmk, createDraftPolicy, getActivePolicy, listComponents, listCpl, listCpmkByCourse, setAssessmentCpmkMapping, setCplTarget, setCpmkCplMapping } from '#lib/features/curriculum/index.server.ts';
import { recomputeOfferings } from '#lib/features/outcomes/index.server.ts';
import { commitBatch, saveSheetSettings, stageUpload } from '#lib/features/imports/index.server.ts';
import { buildSemesterWorkbook } from '../tests/fixtures/builders/templates.ts';

function required(name: string): string {
	const value = process.env[name];
	if (!value) {
		console.error(`Variabel lingkungan ${name} belum diatur`);
		process.exit(1);
	}
	return value;
}

const databaseUrl = required('DATABASE_URL');
const host = new URL(databaseUrl).hostname;
if (process.env.NODE_ENV === 'production' || !['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) {
	console.error('Seed demo hanya boleh dijalankan pada basis data lokal non-produksi.');
	process.exit(1);
}

const { client, db } = createDb(databaseUrl);
let created = false;
const auth = createAuth({ db, secret: required('BETTER_AUTH_SECRET'), baseURL: required('ORIGIN'), rateLimitEnabled: false });

try {
	const [admin] = await db.select({ id: user.id, role: user.role }).from(user).where(eq(user.email, required('SUPERADMIN_EMAIL'))).limit(1);
	if (!admin) {
		console.error('Super Admin belum ada. Jalankan `bun run seed:superadmin` terlebih dahulu.');
		process.exit(1);
	}
	const actor = { id: admin.id, role: admin.role as string };
	const demoAdminPassword = generateTemporaryPassword(20);
	const demoAdmin = await ensureSuperAdmin({ auth, db }, { email: 'admin.demo@demo.invalid', name: 'Admin Demo', password: demoAdminPassword });
	if (demoAdmin.status === 'created') console.log(`Akun admin demo lokal dibuat: admin.demo@demo.invalid | password: ${demoAdminPassword}`);
	const [existing] = await db.select({ id: courses.id }).from(courses).where(eq(courses.code, 'DEMOA')).limit(1);
	if (!existing) {

		let semester = await getActiveSemester(db);
		if (!semester) {
			const year = new Date().getFullYear();
			const academicYear = await createAcademicYear(db, actor, { startYear: year });
			const created = await createSemester(db, actor, { academicYearId: academicYear.id, term: 'ganjil', startDate: `${year}-08-01`, endDate: `${year + 1}-01-31` });
			semester = await activateSemester(db, actor, created.id);
		}

		const courseA = await createCourse(db, actor, { code: 'DEMOA', name: 'Mata Kuliah Uji A', credits: 3, description: 'Data sintetis untuk demo; bukan data mahasiswa sebenarnya.' });
		const courseB = await createCourse(db, actor, { code: 'DEMOB', name: 'Kelas Uji B', credits: 2, description: 'Data sintetis untuk demo; bukan data mahasiswa sebenarnya.' });
		const offeringA = await createOffering(db, actor, { courseId: courseA.id, semesterId: semester.id, section: 'A' });
		const offeringB = await createOffering(db, actor, { courseId: courseB.id, semesterId: semester.id, section: 'T1' });

		const lecturerA = await createLecturerAccount({ auth, db }, actor, { name: 'Dosen Demo Satu', email: 'dosen.demo1@demo.invalid', lecturerCode: 'DEMO1' });
		const lecturerB = await createLecturerAccount({ auth, db }, actor, { name: 'Dosen Demo Dua', email: 'dosen.demo2@demo.invalid', lecturerCode: 'DEMO2' });
		await assignLecturer(db, actor, { offeringId: offeringA.id, lecturerId: lecturerA.lecturerId });
		await assignLecturer(db, actor, { offeringId: offeringB.id, lecturerId: lecturerB.lecturerId });

		for (const [i, title] of ['Dasar ilmu biomedis', 'Analisis data biomedis', 'Pengembangan solusi teknologi kesehatan'].entries())
			await createCpl(db, actor, { code: `CPL-${i + 1}`, title, sortOrder: i });
		const cpmkIds: string[] = [];
		for (let i = 1; i <= 5; i++) cpmkIds.push((await createCpmk(db, actor, { courseId: courseA.id, code: `CPMK-${i}` })).id);

		const upload = await stageUpload(db, actor, { name: 'demo-nilai-sintetis.xlsx', bytes: buildSemesterWorkbook() });
		if (!upload.ok) throw new Error(upload.message);
		await saveSheetSettings(db, actor, upload.batchId, 'Mata Kuliah Uji A', { offeringId: offeringA.id, acknowledgeNumericNim: true });
		await saveSheetSettings(db, actor, upload.batchId, 'Kelas Uji B T1', { offeringId: offeringB.id, acknowledgeNumericNim: true });
		const result = await commitBatch(db, actor, upload.batchId, { strategy: 'upsert', errorPolicy: 'block_on_error', confirmations: { scoreUpdates: true, weightChanges: true } });
		if (!result.ok) throw new Error(result.blockers.map((b) => b.message).join('; '));

		const { components } = await listComponents(db, offeringA.id);
		for (const [i, component] of components.entries()) await setAssessmentCpmkMapping(db, actor, { componentId: component.id, cpmkId: cpmkIds[i % cpmkIds.length], coefficient: 1 });

		created = true;
		console.log('Data demo sintetis dibuat: 2 kelas, 2 dosen, 3 CPL, 5 CPMK, 29 mahasiswa sintetis.');
		console.log(`Password sementara ${lecturerA.email}: ${lecturerA.temporaryPassword}`);
		console.log(`Password sementara ${lecturerB.email}: ${lecturerB.temporaryPassword}`);
		console.log('Simpan password di atas sekarang; keduanya tidak akan ditampilkan lagi dan wajib diganti saat masuk pertama kali.');
	}

	const [courseA] = await db.select({ id: courses.id }).from(courses).where(eq(courses.code, 'DEMOA')).limit(1);
	const cpl = await listCpl(db);
	const cpmk = await listCpmkByCourse(db, courseA.id);
	const cplFor = new Map([['CPMK-1', 'CPL-1'], ['CPMK-2', 'CPL-1'], ['CPMK-3', 'CPL-2'], ['CPMK-4', 'CPL-3'], ['CPMK-5', 'CPL-3']]);
	let changes = 0;
	for (const item of cpmk) {
		const target = cpl.find((c) => c.code === cplFor.get(item.code));
		if (target) {
			await setCpmkCplMapping(db, actor, { cpmkId: item.id, cplId: target.id, weight: 1 });
		}
	}
	let policy = await getActivePolicy(db);
	if (!policy) {
		const draft = await createDraftPolicy(db, actor, { name: 'Kebijakan demo', scaleMax: 100, achievementThreshold: 70, classAchievementRatio: 70, weightTolerance: 0.01, aggregationMethod: 'simple_mean' });
		for (const item of cpl) await setCplTarget(db, actor, { policyId: draft.id, cplId: item.id, target: 70 });
		await activatePolicy(db, actor, draft.id);
		changes++;
	} else if (cpl.some((item) => policy!.targets[item.id] === undefined)) {
		const draft = await cloneActivePolicyAsDraft(db, actor);
		for (const item of cpl) if (policy.targets[item.id] === undefined) await setCplTarget(db, actor, { policyId: draft.id, cplId: item.id, target: 70 });
		await activatePolicy(db, actor, draft.id);
		changes++;
	}
	const offerings = await db.select({ id: courseOfferings.id }).from(courseOfferings).where(eq(courseOfferings.courseId, courseA.id));
	await recomputeOfferings(db, actor, offerings.map((o) => o.id), 'seed_demo');
	if (!created) console.log(changes ? 'Data demo sudah ada; kebijakan dan pemetaan CPL dilengkapi.' : 'Data demo sudah ada; tidak ada perubahan.');
} finally {
	await client.end();
}
