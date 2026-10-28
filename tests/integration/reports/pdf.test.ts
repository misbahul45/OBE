import { beforeAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { activatePolicy, createCpl, createCpmk, createDraftPolicy, setAssessmentCpmkMapping, setCplTarget, setCpmkCplMapping } from '#lib/features/curriculum/index.server.ts';
import { assignLecturer } from '#lib/features/academic/index.server.ts';
import { getOfferingAnalytics, getOfferingRoster, recomputeOffering } from '#lib/features/outcomes/index.server.ts';
import { downloadClassReport, downloadStudentTranscript, renderClassReport, renderStudentTranscript } from '#lib/features/reports/index.server.ts';
import { getStudentProfile } from '#lib/features/students/index.server.ts';
import { assessmentScores, auditLogs } from '#lib/shared/db/schema.ts';
import { NotFoundError } from '#lib/shared/http/errors.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { createComponent, createCourse, createEnrollment, createLecturer, createOffering, createStudent, createTerm, createUser } from '../../support/factories.ts';

const ctx = useIsolatedDatabase('reports_pdf');
let admin: { id: string; role: string };
let yearSeed = 2001;

beforeAll(async () => {
	const user = await createUser(ctx.db, { role: 'super_admin' });
	admin = { id: user.id, role: 'super_admin' };
	const cpl = await createCpl(ctx.db, admin, { code: 'CPL-1', title: 'Dasar biomedis' });
	const policy = await createDraftPolicy(ctx.db, admin, { name: 'Kebijakan uji PDF', achievementThreshold: 70, classAchievementRatio: 70, aggregationMethod: 'simple_mean' });
	await setCplTarget(ctx.db, admin, { policyId: policy.id, cplId: cpl.id, target: 75 });
	await activatePolicy(ctx.db, admin, policy.id);
});

function pdfText(bytes: Uint8Array): string {
	const raw = Buffer.from(bytes).toString('latin1');
	const lines: string[] = [];
	for (const array of raw.matchAll(/\[((?:<[0-9a-fA-F]*>|\s|-?\d+(?:\.\d+)?)+)\]\s*TJ/g)) {
		lines.push([...array[1].matchAll(/<([0-9a-fA-F]*)>/g)].map((m) => Buffer.from(m[1], 'hex').toString('latin1')).join(''));
	}
	return lines.join('\n').replace(/\s+/g, ' ');
}

const pageCount = (bytes: Uint8Array) => Number(/\/Count (\d+)/.exec(Buffer.from(bytes).toString('latin1'))?.[1] ?? 0);

async function scene() {
	const term = await createTerm(ctx.db, { startYear: yearSeed });
	yearSeed += 1;
	const course = await createCourse(ctx.db, { name: 'Biologi Sel Uji', credits: 3 });
	const other = await createCourse(ctx.db, { name: 'Mata Kuliah Lain Uji', credits: 2 });
	const offering = await createOffering(ctx.db, { courseId: course.id, semesterId: term.semester.id });
	const otherOffering = await createOffering(ctx.db, { courseId: other.id, semesterId: term.semester.id });
	const student = await createStudent(ctx.db, { name: 'Mahasiswa Pdf Uji' });
	const component = await createComponent(ctx.db, { offeringId: offering.id, code: 'UTS', weightPercent: 100 });
	const otherComponent = await createComponent(ctx.db, { offeringId: otherOffering.id, code: 'UAS', weightPercent: 100 });
	const cpmk = await createCpmk(ctx.db, admin, { courseId: course.id, code: 'CPMK-1' });
	await setAssessmentCpmkMapping(ctx.db, admin, { componentId: component.id, cpmkId: cpmk.id });
	const cpl = (await ctx.db.query.cplDefinitions.findFirst())!;
	await setCpmkCplMapping(ctx.db, admin, { cpmkId: cpmk.id, cplId: cpl.id, weight: 1 });
	const enrollment = await createEnrollment(ctx.db, { offeringId: offering.id, studentId: student.id });
	const otherEnrollment = await createEnrollment(ctx.db, { offeringId: otherOffering.id, studentId: student.id });
	await ctx.db.insert(assessmentScores).values([{ enrollmentId: enrollment.id, componentId: component.id, score: 88 }, { enrollmentId: otherEnrollment.id, componentId: otherComponent.id, score: 61 }]);
	await recomputeOffering(ctx.db, admin, offering.id, 'uji');
	return { course, offering, otherOffering, student };
}

describe('PDF capaian pembelajaran mahasiswa', () => {
	test('memuat identitas dan hanya CPL yang telah dicapai, tanpa rincian per semester atau per mata kuliah', async () => {
		const s = await scene();
		const profile = await getStudentProfile(ctx.db, 'all', s.student.id);
		const bytes = await renderStudentTranscript(profile, { compress: false, generatedAt: new Date('2026-03-04T05:06:00Z') });
		expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe('%PDF-');
		const text = pdfText(bytes);
		for (const expected of ['Capaian Pembelajaran Lulusan', 'Mahasiswa Pdf Uji', s.student.nim, 'CPL yang Telah Dicapai', 'CPL-1', 'Dasar biomedis', '1 dari 1 CPL tercapai', 'Dihasilkan']) expect(text).toContain(expected);
		expect(text).toMatch(/CPL-1 Dasar biomedis 88\b/);
		for (const absent of ['Ringkasan per Semester', 'Biologi Sel Uji', 'Mata Kuliah Lain Uji', 'Komponen Penilaian', 'Nilai Referensi Excel']) expect(text).not.toContain(absent);
		expect(pageCount(bytes)).toBe(1);
		expect(text).toContain('Halaman 1 dari 1');
	});

	test('mengikuti urutan: kop UNAIR, identitas, daftar CPL tercapai, lalu nomor halaman', async () => {
		const s = await scene();
		const profile = await getStudentProfile(ctx.db, 'all', s.student.id);
		const bytes = await renderStudentTranscript(profile, { compress: false, generatedAt: new Date('2026-03-04T05:06:00Z') });
		const text = pdfText(bytes);
		const order = ['UNIVERSITAS AIRLANGGA', 'Fakultas Sains dan Teknologi', 'Capaian Pembelajaran Lulusan', 'Identitas Mahasiswa', 'CPL yang Telah Dicapai', 'Halaman 1 dari 1'].map((label) => ({ label, at: text.indexOf(label) }));
		for (const entry of order) expect(entry.at, entry.label).toBeGreaterThanOrEqual(0);
		expect(order.map((entry) => entry.at)).toEqual([...order.map((entry) => entry.at)].sort((a, b) => a - b));
		expect(Buffer.from(bytes).toString('latin1')).toContain('/Subtype /Image');
		for (const column of ['No', 'CPL', 'Capaian Pembelajaran Lulusan', 'Nilai', 'Ambang', 'Mata Kuliah Pendukung']) expect(text, column).toContain(column);
	});

	test('CPL yang belum tercapai tidak dimuat dan ringkasan menyebut jumlahnya', async () => {
		const s = await scene();
		const profile = await getStudentProfile(ctx.db, 'all', s.student.id);
		const base = profile.cplSummary[0];
		const mixed = { ...profile, cplSummary: [base, { ...base, code: 'CPL-2', title: 'CPL belum tercapai uji', achievement: 'belum_tercapai' as const }, { ...base, code: 'CPL-3', title: 'CPL tanpa nilai uji', achievement: 'belum_cukup_data' as const }] };
		const text = pdfText(await renderStudentTranscript(mixed, { compress: false }));
		expect(text).toContain('1 dari 3 CPL tercapai (1 belum dapat dinilai)');
		expect(text).toContain('CPL-1');
		expect(text).not.toContain('CPL belum tercapai uji');
		expect(text).not.toContain('CPL tanpa nilai uji');
	});

	test('ambang dari Excel disebut sebagai sumbernya, dan tanpa CPL tercapai ada keterangan', async () => {
		const s = await scene();
		const profile = await getStudentProfile(ctx.db, 'all', s.student.id);
		const base = profile.cplSummary[0];
		const excel = { ...profile, cplSummary: [{ ...base, targetSource: 'excel' as const, target: 62 }] };
		expect(pdfText(await renderStudentTranscript(excel, { compress: false }))).toContain('ambang pada berkas Excel');
		const none = { ...profile, cplSummary: [{ ...base, achievement: 'belum_tercapai' as const }] };
		expect(pdfText(await renderStudentTranscript(none, { compress: false }))).toContain('Belum ada CPL yang mencapai ambang');
	});

	test('mahasiswa tanpa nilai CPL tetap menghasilkan dokumen dengan keterangan, dan daftar panjang menjadi beberapa halaman', async () => {
		const empty = await renderStudentTranscript({ student: { id: 'x', nim: '990000999999', name: 'Tanpa Riwayat', cohortYear: null }, enrollments: [], cplSummary: [], revisions: [], policy: null, scopeLimited: false }, { compress: false });
		expect(pdfText(empty)).toContain('Belum ada nilai CPL pada cakupan ini');
		const base = await getStudentProfile(ctx.db, 'all', (await scene()).student.id);
		const many = { ...base, cplSummary: Array.from({ length: 70 }, (_, i) => ({ ...base.cplSummary[0], code: `CPL-${i + 1}`, title: `Capaian panjang ${i + 1} ${'uraian '.repeat(12)}` })) };
		const long = await renderStudentTranscript(many, { compress: false });
		expect(pageCount(long)).toBeGreaterThan(2);
		expect(pdfText(long)).toContain('Halaman 1 dari');
	});

	test('unduhan dicatat di audit tanpa NIM maupun nama, dan nama berkas tidak memuat data pribadi', async () => {
		const s = await scene();
		const file = await downloadStudentTranscript(ctx.db, admin, 'all', s.student.id);
		expect(file.contentType).toBe('application/pdf');
		expect(file.fileName).toMatch(/^transkrip-[0-9a-f]{8}\.pdf$/);
		expect(file.fileName).not.toContain(s.student.nim);
		const logs = await ctx.db.select().from(auditLogs).where(eq(auditLogs.entityId, s.student.id));
		const entry = logs.find((l) => l.action === 'report.download')!;
		expect(entry).toMatchObject({ actorId: admin.id, entityType: 'student' });
		expect(JSON.stringify(entry)).not.toContain(s.student.nim);
		expect(JSON.stringify(entry)).not.toContain('Mahasiswa Pdf Uji');
	});

	test('dosen hanya mendapat mata kuliah dalam cakupannya dan ditolak untuk mahasiswa di luar cakupan', async () => {
		const s = await scene();
		const file = await downloadStudentTranscript(ctx.db, { id: admin.id, role: 'lecturer' }, [s.offering.id], s.student.id);
		expect(file.body).toBeInstanceOf(Uint8Array);
		const profile = await getStudentProfile(ctx.db, [s.offering.id], s.student.id);
		expect(profile.enrollments.map((e) => e.courseName)).toEqual(['Biologi Sel Uji']);
		const text = pdfText(await renderStudentTranscript(profile, { compress: false }));
		expect(text).toContain('cakupan pengguna');
		const stranger = await createStudent(ctx.db);
		await expect(downloadStudentTranscript(ctx.db, admin, [s.offering.id], stranger.id)).rejects.toBeInstanceOf(NotFoundError);
		const logsBefore = (await ctx.db.select().from(auditLogs).where(eq(auditLogs.entityId, stranger.id))).length;
		expect(logsBefore).toBe(0);
	});
});

describe('laporan kelas PDF', () => {
	test('memuat komponen, ketercapaian CPMK/CPL, dan daftar mahasiswa', async () => {
		const s = await scene();
		const [analytics, roster] = await Promise.all([getOfferingAnalytics(ctx.db, s.offering.id), getOfferingRoster(ctx.db, s.offering.id)]);
		const text = pdfText(await renderClassReport(analytics, roster, { compress: false }));
		for (const expected of ['Laporan Capaian Kelas', 'Biologi Sel Uji', 'Komponen penilaian', 'Ketercapaian CPMK', 'Ketercapaian CPL', 'Daftar mahasiswa', 'Mahasiswa Pdf Uji', 'Lengkap']) expect(text).toContain(expected);
	});

	test('akses diperiksa per kelas dan unduhan diaudit', async () => {
		const s = await scene();
		const lecturer = await createLecturer(ctx.db);
		await assignLecturer(ctx.db, admin, { offeringId: s.offering.id, lecturerId: lecturer.lecturer.id });
		const actor = { id: lecturer.account.id, role: 'lecturer' };
		const file = await downloadClassReport(ctx.db, actor, s.offering.id);
		expect(file.fileName).toMatch(/^laporan-kelas-.+-A\.pdf$/);
		await expect(downloadClassReport(ctx.db, actor, s.otherOffering.id)).rejects.toBeInstanceOf(NotFoundError);
		const audit = await ctx.db.select().from(auditLogs).where(eq(auditLogs.entityId, s.offering.id));
		expect(audit.filter((l) => l.action === 'report.download')).toHaveLength(1);
		const none = await ctx.db.select().from(auditLogs).where(eq(auditLogs.entityId, s.otherOffering.id));
		expect(none.filter((l) => l.action === 'report.download')).toHaveLength(0);
	});
});
