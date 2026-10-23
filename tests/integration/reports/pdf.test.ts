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

describe('transkrip mahasiswa PDF', () => {
	test('menghasilkan PDF valid yang memuat identitas, mata kuliah, komponen, dan hasil CPMK/CPL', async () => {
		const s = await scene();
		const profile = await getStudentProfile(ctx.db, 'all', s.student.id);
		const bytes = await renderStudentTranscript(profile, { compress: false, generatedAt: new Date('2026-03-04T05:06:00Z') });
		expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe('%PDF-');
		const text = pdfText(bytes);
		for (const expected of ['Transkrip Capaian Pembelajaran', 'Mahasiswa Pdf Uji', s.student.nim, 'Biologi Sel Uji', 'Mata Kuliah Lain Uji', 'Nilai Akhir', 'CPMK-1', 'CPL-1', 'Dihasilkan']) expect(text).toContain(expected);
		expect(text).toMatch(/Nilai Akhir.*\b88\b/);
		expect(text).not.toContain('Nilai Referensi Excel');
		expect(pageCount(bytes)).toBe(1);
		expect(text).toContain('Halaman 1 dari 1');
	});

	test('mengikuti struktur transkrip acuan: kop UNAIR, identitas, ringkasan semester, CPL lintas mata kuliah, lalu per mata kuliah', async () => {
		const s = await scene();
		const profile = await getStudentProfile(ctx.db, 'all', s.student.id);
		const bytes = await renderStudentTranscript(profile, { compress: false, generatedAt: new Date('2026-03-04T05:06:00Z') });
		const text = pdfText(bytes);
		const courseAt = text.indexOf('1. Biologi Sel Uji');
		const after = (label: string) => text.indexOf(label, courseAt);
		const order = [
			...['UNIVERSITAS AIRLANGGA', 'Fakultas Sains dan Teknologi', 'Transkrip Capaian Pembelajaran', 'Identitas Mahasiswa', 'Ringkasan per Semester', 'Capaian CPL Lintas Mata Kuliah', '1. Biologi Sel Uji'].map((label) => ({ label, at: text.indexOf(label) })),
			...['Komponen Penilaian', 'Capaian CPMK', 'Capaian CPL', 'Halaman 1 dari 1'].map((label) => ({ label, at: after(label) }))
		];
		for (const entry of order) expect(entry.at, entry.label).toBeGreaterThanOrEqual(0);
		expect(order.map((entry) => entry.at)).toEqual([...order.map((entry) => entry.at)].sort((a, b) => a - b));
		expect(Buffer.from(bytes).toString('latin1')).toContain('/Subtype /Image');
		for (const column of ['Semester', 'SKS', 'Rata-rata Nilai Akhir', 'Nilai Gabungan', 'Mata Kuliah Terpakai', 'Bobot', 'Hasil Hitung', 'Target', 'Status']) expect(text, column).toContain(column);
	});

	test('nilai referensi Excel tampil di tabel terpisah dan tidak bercampur dengan hasil hitung sistem', async () => {
		const s = await scene();
		const profile = await getStudentProfile(ctx.db, 'all', s.student.id);
		const withReference = { ...profile, enrollments: profile.enrollments.map((e) => ({ ...e, cpmk: e.cpmk.map((r) => ({ ...r, reference: 77.5 })), cpl: e.cpl.map((r) => ({ ...r, reference: 66 })) })) };
		const text = pdfText(await renderStudentTranscript(withReference, { compress: false }));
		expect(text).toContain('Nilai Referensi Excel (bukan hasil hitung sistem)');
		expect(text).toMatch(/CPMK-1 77,5/);
		expect(text).toMatch(/CPL-1 66/);
		expect(text.indexOf('Hasil Hitung')).toBeLessThan(text.indexOf('Nilai Referensi Excel'));
	});

	test('mahasiswa tanpa riwayat tetap menghasilkan dokumen dengan keterangan, dan dokumen panjang menjadi beberapa halaman', async () => {
		const empty = await renderStudentTranscript({ student: { id: 'x', nim: '990000999999', name: 'Tanpa Riwayat', cohortYear: null }, enrollments: [], semesters: [], cplSummary: [], revisions: [], policy: null, scopeLimited: false }, { compress: false });
		expect(pdfText(empty)).toContain('Belum ada riwayat mata kuliah');
		const base = await getStudentProfile(ctx.db, 'all', (await scene()).student.id);
		const many = { ...base, enrollments: Array.from({ length: 30 }, (_, i) => ({ ...base.enrollments[0], enrollmentId: `e${i}`, courseName: `Mata Kuliah ${i}` })) };
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
		const text = pdfText(await renderStudentTranscript(profile, { compress: false }));
		expect(text).toContain('Biologi Sel Uji');
		expect(text).not.toContain('Mata Kuliah Lain Uji');
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
