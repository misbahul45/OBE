import { describe, expect, test } from 'bun:test';
import { actionSchema, evaluationSchema, evidenceSchema, findingSchema } from '#lib/features/cqi/cqi.validation.ts';
import { allowedActionTransitions, allowedTransitions, canActionTransition, canTransition, cqiStatuses, isFinal, transitionBlockers, type TransitionContext } from '#lib/features/cqi/cqi.workflow.ts';

const base: TransitionContext = { rootCause: null, actions: [], evidenceCount: 0, evaluationCount: 0 };

describe('transisi status temuan', () => {
	test('hanya mengizinkan jalur yang terdefinisi dan status akhir tidak dapat berpindah lagi', () => {
		expect(allowedTransitions('open')).toEqual(['analysis', 'cancelled']);
		expect(canTransition('open', 'planned')).toBe(false);
		expect(canTransition('analysis', 'planned')).toBe(true);
		expect(canTransition('evaluating', 'in_progress')).toBe(true);
		for (const final of ['closed', 'cancelled'] as const) {
			expect(isFinal(final)).toBe(true);
			for (const target of cqiStatuses) expect(canTransition(final, target)).toBe(false);
		}
		for (const status of cqiStatuses) if (status !== 'closed' && status !== 'cancelled') expect(canTransition(status, 'cancelled')).toBe(true);
	});

	test('tidak ada status yang berpindah ke dirinya sendiri', () => {
		for (const status of cqiStatuses) expect(canTransition(status, status)).toBe(false);
	});
});

describe('gerbang transisi', () => {
	test('rencana tindakan memerlukan akar masalah', () => {
		expect(transitionBlockers('analysis', 'planned', base)).toEqual(['Isi akar masalah sebelum menyusun rencana tindakan.']);
		expect(transitionBlockers('analysis', 'planned', { ...base, rootCause: '   ' })).toHaveLength(1);
		expect(transitionBlockers('analysis', 'planned', { ...base, rootCause: 'Materi prasyarat lemah' })).toEqual([]);
	});

	test('memulai tindakan memerlukan minimal satu tindakan yang tidak dibatalkan', () => {
		expect(transitionBlockers('planned', 'in_progress', base)).toHaveLength(1);
		expect(transitionBlockers('planned', 'in_progress', { ...base, actions: [{ status: 'cancelled' }] })).toHaveLength(1);
		expect(transitionBlockers('planned', 'in_progress', { ...base, actions: [{ status: 'planned' }] })).toEqual([]);
	});

	test('evaluasi memerlukan semua tindakan selesai atau dibatalkan dan minimal satu selesai', () => {
		expect(transitionBlockers('in_progress', 'evaluating', { ...base, actions: [{ status: 'done' }, { status: 'in_progress' }] })).toEqual(['Selesaikan atau batalkan seluruh tindakan sebelum evaluasi.']);
		expect(transitionBlockers('in_progress', 'evaluating', { ...base, actions: [{ status: 'cancelled' }] })).toEqual(['Minimal satu tindakan harus berstatus selesai sebelum evaluasi.']);
		expect(transitionBlockers('in_progress', 'evaluating', { ...base, actions: [{ status: 'done' }, { status: 'cancelled' }] })).toEqual([]);
	});

	test('menutup temuan memerlukan evaluasi dan bukti sekaligus', () => {
		expect(transitionBlockers('evaluating', 'closed', base)).toHaveLength(2);
		expect(transitionBlockers('evaluating', 'closed', { ...base, evaluationCount: 1 })).toEqual(['Lampirkan minimal satu bukti tindak lanjut sebelum menutup temuan.']);
		expect(transitionBlockers('evaluating', 'closed', { ...base, evaluationCount: 1, evidenceCount: 2 })).toEqual([]);
	});

	test('transisi yang tidak terdefinisi dijelaskan dengan nama status', () => {
		expect(transitionBlockers('open', 'closed', base)[0]).toContain('Temuan baru');
		expect(transitionBlockers('closed', 'open', base)[0]).toContain('Selesai');
	});
});

describe('status tindakan', () => {
	test('selesai dan dibatalkan bersifat final; berjalan boleh kembali direncanakan', () => {
		expect(allowedActionTransitions('done')).toEqual([]);
		expect(canActionTransition('cancelled', 'planned')).toBe(false);
		expect(canActionTransition('in_progress', 'planned')).toBe(true);
		expect(canActionTransition('planned', 'done')).toBe(true);
	});
});

describe('validasi masukan', () => {
	test('temuan: judul dan deskripsi wajib, relasi kosong menjadi null, prioritas bawaan sedang', () => {
		const ok = findingSchema.parse({ title: 'CPMK-2 di bawah ambang', description: 'Rasio ketercapaian kelas rendah dua semester.', semesterId: '', offeringId: undefined });
		expect(ok).toMatchObject({ priority: 'medium', semesterId: null, offeringId: null, cplId: null, cpmkId: null });
		expect(findingSchema.safeParse({ title: 'abc', description: 'pendek' }).success).toBe(false);
		expect(findingSchema.safeParse({ title: 'Judul valid', description: 'Deskripsi cukup panjang', offeringId: 'bukan-uuid' }).success).toBe(false);
	});

	test('tindakan: tenggat harus tanggal kalender yang valid', () => {
		const input = { description: 'Tambah kuis mingguan', picUserId: 'usr_1' };
		expect(actionSchema.safeParse({ ...input, dueDate: '2026-02-30' }).success).toBe(false);
		expect(actionSchema.safeParse({ ...input, dueDate: '30/01/2026' }).success).toBe(false);
		expect(actionSchema.parse({ ...input, dueDate: '2026-02-28' }).dueDate).toBe('2026-02-28');
		expect(actionSchema.safeParse({ ...input, picUserId: '  ', dueDate: '2026-02-28' }).success).toBe(false);
	});

	test('bukti: wajib punya tautan atau catatan, dan tautan hanya http/https', () => {
		expect(evidenceSchema.safeParse({ title: 'Notulen rapat' }).success).toBe(false);
		expect(evidenceSchema.safeParse({ title: 'Notulen rapat', url: 'javascript:alert(1)' }).success).toBe(false);
		expect(evidenceSchema.safeParse({ title: 'Notulen rapat', url: 'ftp://contoh.id/a' }).success).toBe(false);
		expect(evidenceSchema.parse({ title: 'Notulen rapat', url: 'https://contoh.id/notulen' }).url).toBe('https://contoh.id/notulen');
		expect(evidenceSchema.parse({ title: 'Notulen rapat', note: 'Disimpan di arsip prodi' }).note).toBe('Disimpan di arsip prodi');
	});

	test('evaluasi: angka dapat memakai koma desimal, kosong menjadi null, bukan angka ditolak', () => {
		const ok = evaluationSchema.parse({ metricLabel: 'Rasio CPMK-2', valueBefore: '55,5', valueAfter: '', conclusion: 'Membaik setelah tindakan' });
		expect(ok).toMatchObject({ valueBefore: 55.5, valueAfter: null });
		expect(evaluationSchema.safeParse({ metricLabel: 'Rasio CPMK-2', valueBefore: 'abc', conclusion: 'Membaik setelah tindakan' }).success).toBe(false);
	});
});
