import { beforeAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { assignLecturer } from '#lib/features/academic/index.server.ts';
import { addAction, addEvaluation, addEvidence, createFinding, getFindingDetail, listFindings, transitionFinding, updateActionStatus, updateFinding } from '#lib/features/cqi/index.server.ts';
import { auditLogs, cqiFindings, user } from '#lib/shared/db/schema.ts';
import { ConflictError, NotFoundError, ValidationError } from '#lib/shared/http/errors.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { createLecturer, createOffering, createUser } from '../../support/factories.ts';

const ctx = useIsolatedDatabase('cqi');
let admin: { id: string; role: string };

beforeAll(async () => {
	const row = await createUser(ctx.db, { role: 'super_admin' });
	admin = { id: row.id, role: 'super_admin' };
});

const valid = { title: 'CPMK-2 di bawah ambang kelas', description: 'Rasio ketercapaian kelas rendah selama dua semester berturut-turut.' };

async function reachEvaluating(findingId: string, pic: string) {
	await transitionFinding(ctx.db, admin, findingId, 'analysis');
	await updateFinding(ctx.db, admin, findingId, { ...valid, priority: 'high', rootCause: 'Materi prasyarat lemah' });
	await transitionFinding(ctx.db, admin, findingId, 'planned');
	const action = await addAction(ctx.db, admin, findingId, { description: 'Tambah kuis mingguan', picUserId: pic, dueDate: '2026-12-01' });
	await transitionFinding(ctx.db, admin, findingId, 'in_progress');
	await updateActionStatus(ctx.db, admin, action.id, 'done');
	await transitionFinding(ctx.db, admin, findingId, 'evaluating');
	return action;
}

describe('pembuatan temuan', () => {
	test('kode berurutan per tahun, semester diturunkan dari kelas, dan dicatat di audit', async () => {
		const offering = await createOffering(ctx.db);
		const first = await createFinding(ctx.db, admin, { ...valid, offeringId: offering.id }, new Date('2031-03-01T00:00:00Z'));
		const second = await createFinding(ctx.db, admin, valid, new Date('2031-09-01T00:00:00Z'));
		const nextYear = await createFinding(ctx.db, admin, valid, new Date('2032-01-02T00:00:00Z'));
		expect([first.code, second.code, nextYear.code]).toEqual(['CQI-2031-001', 'CQI-2031-002', 'CQI-2032-001']);
		expect(first).toMatchObject({ status: 'open', priority: 'medium', semesterId: offering.semesterId, createdBy: admin.id });
		const logs = await ctx.db.select().from(auditLogs).where(eq(auditLogs.entityId, first.id));
		expect(logs.map((l) => l.action)).toContain('cqi.finding.create');
	});

	test('masukan tidak valid dan referensi yang tidak ada ditolak dengan pesan per bidang', async () => {
		await expect(createFinding(ctx.db, admin, { title: 'abc', description: 'pendek' })).rejects.toMatchObject({ fieldErrors: { title: [expect.any(String)], description: [expect.any(String)] } });
		const failure = await createFinding(ctx.db, admin, { ...valid, cplId: '3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b' }).catch((e) => e);
		expect(failure).toBeInstanceOf(ValidationError);
	});

	test('hanya Super Admin yang dapat membuat dan mengubah alur temuan', async () => {
		const lecturer = await createLecturer(ctx.db);
		const actor = { id: lecturer.account.id, role: 'lecturer' };
		await expect(createFinding(ctx.db, actor, valid)).rejects.toBeInstanceOf(NotFoundError);
		const finding = await createFinding(ctx.db, admin, valid);
		await expect(transitionFinding(ctx.db, actor, finding.id, 'analysis')).rejects.toBeInstanceOf(NotFoundError);
		await expect(updateFinding(ctx.db, actor, finding.id, { ...valid, priority: 'low' })).rejects.toBeInstanceOf(NotFoundError);
		await expect(addAction(ctx.db, actor, finding.id, { description: 'Tindakan', picUserId: actor.id, dueDate: '2026-12-01' })).rejects.toBeInstanceOf(NotFoundError);
	});
});

describe('alur status', () => {
	test('setiap gerbang menahan transisi sampai syaratnya terpenuhi, lalu temuan dapat ditutup', async () => {
		const lecturer = await createLecturer(ctx.db);
		const finding = await createFinding(ctx.db, admin, valid);
		const id = finding.id;

		await expect(transitionFinding(ctx.db, admin, id, 'closed')).rejects.toBeInstanceOf(ValidationError);
		await transitionFinding(ctx.db, admin, id, 'analysis');
		const noRoot = await transitionFinding(ctx.db, admin, id, 'planned').catch((e) => e);
		expect(noRoot.fieldErrors.status).toEqual(['Isi akar masalah sebelum menyusun rencana tindakan.']);
		await updateFinding(ctx.db, admin, id, { ...valid, rootCause: 'Materi prasyarat lemah' });
		await transitionFinding(ctx.db, admin, id, 'planned');

		const noAction = await transitionFinding(ctx.db, admin, id, 'in_progress').catch((e) => e);
		expect(noAction.fieldErrors.status[0]).toContain('minimal satu tindakan');
		const action = await addAction(ctx.db, admin, id, { description: 'Tambah kuis mingguan', picUserId: lecturer.account.id, dueDate: '2026-12-01' });
		await transitionFinding(ctx.db, admin, id, 'in_progress');

		const early = await transitionFinding(ctx.db, admin, id, 'evaluating').catch((e) => e);
		expect(early.fieldErrors.status.length).toBeGreaterThanOrEqual(1);
		await updateActionStatus(ctx.db, admin, action.id, 'done');
		await transitionFinding(ctx.db, admin, id, 'evaluating');

		const notReady = await transitionFinding(ctx.db, admin, id, 'closed').catch((e) => e);
		expect(notReady.fieldErrors.status).toHaveLength(2);
		await addEvaluation(ctx.db, admin, id, { metricLabel: 'Rasio CPMK-2', valueBefore: '55,5', valueAfter: '72', conclusion: 'Membaik setelah kuis mingguan' });
		await addEvidence(ctx.db, admin, id, { title: 'Notulen rapat kurikulum', url: 'https://contoh.id/notulen' });
		const closed = await transitionFinding(ctx.db, admin, id, 'closed');
		expect(closed.status).toBe('closed');
		expect(closed.closedAt).toBeInstanceOf(Date);

		await expect(transitionFinding(ctx.db, admin, id, 'open')).rejects.toBeInstanceOf(ValidationError);
		await expect(updateFinding(ctx.db, admin, id, { ...valid, priority: 'low' })).rejects.toBeInstanceOf(ConflictError);
		await expect(addAction(ctx.db, admin, id, { description: 'Terlambat', picUserId: lecturer.account.id, dueDate: '2027-01-01' })).rejects.toBeInstanceOf(ConflictError);
		await expect(addEvidence(ctx.db, admin, id, { title: 'Bukti lain', note: 'Terlambat' })).rejects.toBeInstanceOf(ConflictError);
		const trail = (await ctx.db.select().from(auditLogs).where(eq(auditLogs.entityId, id))).filter((l) => l.action === 'cqi.finding.transition');
		expect(trail.length).toBe(5);
	});

	test('pembatalan boleh dari status berjalan mana pun dan bersifat final', async () => {
		const finding = await createFinding(ctx.db, admin, valid);
		await transitionFinding(ctx.db, admin, finding.id, 'analysis');
		const cancelled = await transitionFinding(ctx.db, admin, finding.id, 'cancelled');
		expect(cancelled).toMatchObject({ status: 'cancelled' });
		expect(cancelled.closedAt).toBeInstanceOf(Date);
		await expect(transitionFinding(ctx.db, admin, finding.id, 'analysis')).rejects.toBeInstanceOf(ValidationError);
		await expect(transitionFinding(ctx.db, admin, finding.id, 'tidak-ada')).rejects.toBeInstanceOf(ValidationError);
		await expect(transitionFinding(ctx.db, admin, 'bukan-uuid', 'analysis')).rejects.toBeInstanceOf(NotFoundError);
	});

	test('evaluasi hanya dapat dicatat saat berstatus evaluasi', async () => {
		const finding = await createFinding(ctx.db, admin, valid);
		await expect(addEvaluation(ctx.db, admin, finding.id, { metricLabel: 'Rasio', conclusion: 'Belum waktunya' })).rejects.toBeInstanceOf(ConflictError);
	});
});

describe('tindakan', () => {
	test('penanggung jawab harus pengguna aktif dan perubahan status mengikuti aturan', async () => {
		const lecturer = await createLecturer(ctx.db);
		const finding = await createFinding(ctx.db, admin, valid);
		const missing = await addAction(ctx.db, admin, finding.id, { description: 'Tindakan uji', picUserId: 'tidak-ada', dueDate: '2026-12-01' }).catch((e) => e);
		expect(missing.fieldErrors.picUserId).toBeDefined();
		await ctx.db.update(user).set({ banned: true }).where(eq(user.id, lecturer.account.id));
		const banned = await addAction(ctx.db, admin, finding.id, { description: 'Tindakan uji', picUserId: lecturer.account.id, dueDate: '2026-12-01' }).catch((e) => e);
		expect(banned).toBeInstanceOf(ValidationError);

		const active = await createLecturer(ctx.db);
		const action = await addAction(ctx.db, admin, finding.id, { description: 'Tindakan uji', picUserId: active.account.id, dueDate: '2026-12-01' });
		const started = await updateActionStatus(ctx.db, admin, action.id, 'in_progress');
		expect(started).toMatchObject({ status: 'in_progress', completedAt: null });
		const done = await updateActionStatus(ctx.db, admin, action.id, 'done');
		expect(done.completedAt).toBeInstanceOf(Date);
		await expect(updateActionStatus(ctx.db, admin, action.id, 'planned')).rejects.toBeInstanceOf(ValidationError);
		await expect(updateActionStatus(ctx.db, admin, action.id, 'selesai-banget')).rejects.toThrow();
	});

	test('tenggat terlewati ditandai terlambat sampai tindakan selesai', async () => {
		const pic = await createLecturer(ctx.db);
		const finding = await createFinding(ctx.db, admin, { ...valid, title: 'Temuan tenggat uji' });
		const late = await addAction(ctx.db, admin, finding.id, { description: 'Tindakan terlambat', picUserId: pic.account.id, dueDate: '2026-01-10' });
		await addAction(ctx.db, admin, finding.id, { description: 'Tindakan masih lama', picUserId: pic.account.id, dueDate: '2026-03-10' });
		const now = new Date('2026-02-01T05:00:00Z');
		const detail = await getFindingDetail(ctx.db, admin, finding.id, now);
		expect(detail.actions.map((a) => [a.dueDate, a.overdue])).toEqual([['2026-01-10', true], ['2026-03-10', false]]);
		const listed = (await listFindings(ctx.db, admin, { search: 'tenggat uji' }, now)).rows[0];
		expect(listed).toMatchObject({ actionTotal: 2, actionDone: 0, actionOverdue: 1 });
		await updateActionStatus(ctx.db, admin, late.id, 'done');
		expect((await getFindingDetail(ctx.db, admin, finding.id, now)).actions[0].overdue).toBe(false);
	});
});

describe('bukti', () => {
	test('bukti terhubung ke tindakan dari temuan yang sama saja', async () => {
		const pic = await createLecturer(ctx.db);
		const one = await createFinding(ctx.db, admin, valid);
		const two = await createFinding(ctx.db, admin, valid);
		const actionOfTwo = await addAction(ctx.db, admin, two.id, { description: 'Tindakan temuan dua', picUserId: pic.account.id, dueDate: '2026-12-01' });
		const failure = await addEvidence(ctx.db, admin, one.id, { title: 'Bukti silang', note: 'catatan', actionId: actionOfTwo.id }).catch((e) => e);
		expect(failure).toBeInstanceOf(ValidationError);
		expect(failure.fieldErrors.actionId).toBeDefined();
		const ok = await addEvidence(ctx.db, admin, two.id, { title: 'Bukti sah', note: 'catatan', actionId: actionOfTwo.id });
		expect(ok).toMatchObject({ findingId: two.id, actionId: actionOfTwo.id, addedBy: admin.id });
	});
});

describe('akses dosen', () => {
	test('dosen hanya melihat temuan di kelasnya atau yang menugaskannya, dan hanya mengubah tindakannya sendiri', async () => {
		const mine = await createLecturer(ctx.db);
		const other = await createLecturer(ctx.db);
		const actor = { id: mine.account.id, role: 'lecturer' };
		const myOffering = await createOffering(ctx.db);
		await assignLecturer(ctx.db, admin, { offeringId: myOffering.id, lecturerId: mine.lecturer.id });

		const inMyClass = await createFinding(ctx.db, admin, { ...valid, title: 'Temuan kelas saya', offeringId: myOffering.id });
		const assignedToMe = await createFinding(ctx.db, admin, { ...valid, title: 'Temuan tugas saya' });
		const unrelated = await createFinding(ctx.db, admin, { ...valid, title: 'Temuan tak terkait' });
		const myAction = await addAction(ctx.db, admin, assignedToMe.id, { description: 'Tindakan saya', picUserId: actor.id, dueDate: '2026-12-01' });
		const theirAction = await addAction(ctx.db, admin, unrelated.id, { description: 'Tindakan dosen lain', picUserId: other.account.id, dueDate: '2026-12-01' });

		const visible = (await listFindings(ctx.db, actor, { pageSize: 100 })).rows.map((r) => r.id);
		expect(visible).toContain(inMyClass.id);
		expect(visible).toContain(assignedToMe.id);
		expect(visible).not.toContain(unrelated.id);
		const forbidden = await getFindingDetail(ctx.db, actor, unrelated.id).catch((e) => e);
		const missing = await getFindingDetail(ctx.db, actor, '3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b').catch((e) => e);
		expect(forbidden).toBeInstanceOf(NotFoundError);
		expect(forbidden.message).toBe(missing.message);

		const detail = await getFindingDetail(ctx.db, actor, assignedToMe.id);
		expect(detail).toMatchObject({ canEdit: false, canAddEvidence: true, transitions: [] });
		expect(detail.actions[0].canUpdate).toBe(true);
		expect((await getFindingDetail(ctx.db, actor, inMyClass.id)).canAddEvidence).toBe(false);

		expect((await updateActionStatus(ctx.db, actor, myAction.id, 'in_progress')).status).toBe('in_progress');
		await expect(updateActionStatus(ctx.db, actor, theirAction.id, 'done')).rejects.toBeInstanceOf(NotFoundError);
		await expect(addEvidence(ctx.db, actor, unrelated.id, { title: 'Bukti', note: 'catatan' })).rejects.toBeInstanceOf(NotFoundError);
		await expect(addEvidence(ctx.db, actor, inMyClass.id, { title: 'Bukti', note: 'catatan' })).rejects.toBeInstanceOf(NotFoundError);
		const evidence = await addEvidence(ctx.db, actor, assignedToMe.id, { title: 'Bukti saya', note: 'catatan' });
		expect(evidence.addedBy).toBe(actor.id);
	});
});

describe('daftar temuan', () => {
	test('diurutkan menurut prioritas, mendukung filter dan pencarian literal', async () => {
		const marker = `Urut${Math.random().toString(36).slice(2, 7)}`;
		const low = await createFinding(ctx.db, admin, { ...valid, title: `${marker} rendah`, priority: 'low' });
		const critical = await createFinding(ctx.db, admin, { ...valid, title: `${marker} kritis`, priority: 'critical' });
		const high = await createFinding(ctx.db, admin, { ...valid, title: `${marker} tinggi`, priority: 'high' });
		const rows = (await listFindings(ctx.db, admin, { search: marker })).rows;
		expect(rows.map((r) => r.id)).toEqual([critical.id, high.id, low.id]);
		expect((await listFindings(ctx.db, admin, { search: marker, priority: 'high' })).total).toBe(1);
		await transitionFinding(ctx.db, admin, low.id, 'cancelled');
		expect((await listFindings(ctx.db, admin, { search: marker, status: 'cancelled' })).rows.map((r) => r.id)).toEqual([low.id]);
		expect((await listFindings(ctx.db, admin, { search: '%' })).total).toBe(0);
	});

	test('detail menampilkan transisi berikutnya beserta penghalangnya', async () => {
		const pic = await createLecturer(ctx.db);
		const finding = await createFinding(ctx.db, admin, valid);
		await reachEvaluating(finding.id, pic.account.id);
		const detail = await getFindingDetail(ctx.db, admin, finding.id);
		const closing = detail.transitions.find((t) => t.to === 'closed')!;
		expect(closing.blockers).toHaveLength(2);
		expect(detail.transitions.find((t) => t.to === 'in_progress')!.blockers).toEqual([]);
		expect(detail.canEdit).toBe(true);
		const row = (await ctx.db.select().from(cqiFindings).where(eq(cqiFindings.id, finding.id)))[0];
		expect(row.status).toBe('evaluating');
	});
});
