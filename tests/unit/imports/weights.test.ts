import { describe, expect, test } from 'bun:test';
import { extractHeaderWeight, parseWeight, sumWeights, weightsMatchTotal } from '#lib/features/imports/weights.ts';

describe('parseWeight', () => {
	test('tanda persen eksplisit', () => {
		expect(parseWeight('10%')).toEqual({ ok: true, percent: 10, form: 'percent_sign', ambiguous: false });
		expect(parseWeight(' 15 % ')).toMatchObject({ ok: true, percent: 15 });
		expect(parseWeight('12,5%')).toMatchObject({ ok: true, percent: 12.5 });
	});

	test('pecahan titik dan koma dibaca sebagai persen', () => {
		expect(parseWeight(0.1)).toEqual({ ok: true, percent: 10, form: 'fraction', ambiguous: false });
		expect(parseWeight('0.1')).toMatchObject({ ok: true, percent: 10, form: 'fraction' });
		expect(parseWeight('0,1')).toMatchObject({ ok: true, percent: 10, form: 'fraction' });
		expect(parseWeight(0.25)).toMatchObject({ percent: 25 });
	});

	test('angka 1 ambigu (100% atau penanda), angka lebih dari 1 adalah persen', () => {
		expect(parseWeight(1)).toEqual({ ok: true, percent: 100, form: 'fraction', ambiguous: true });
		expect(parseWeight(25)).toEqual({ ok: true, percent: 25, form: 'percent_number', ambiguous: false });
		expect(parseWeight(0)).toMatchObject({ ok: true, percent: 0 });
	});

	test('teks tidak terbaca, kosong, dan di luar rentang ditolak', () => {
		expect(parseWeight('sepuluh persen')).toEqual({ ok: false, reason: 'UNPARSEABLE' });
		expect(parseWeight('')).toEqual({ ok: false, reason: 'EMPTY' });
		expect(parseWeight(null)).toEqual({ ok: false, reason: 'EMPTY' });
		expect(parseWeight(150)).toEqual({ ok: false, reason: 'OUT_OF_RANGE' });
		expect(parseWeight('101%')).toEqual({ ok: false, reason: 'OUT_OF_RANGE' });
		expect(parseWeight(-5)).toEqual({ ok: false, reason: 'OUT_OF_RANGE' });
	});
});

describe('extractHeaderWeight', () => {
	test('mengambil bobot dari akhir teks header dan membersihkan labelnya', () => {
		expect(extractHeaderWeight('UTS (25 %)')).toEqual({ percent: 25, withoutWeight: 'UTS' });
		expect(extractHeaderWeight('Kuis (12,5%)')).toEqual({ percent: 12.5, withoutWeight: 'Kuis' });
		expect(extractHeaderWeight('Tugas')).toEqual({ percent: null, withoutWeight: 'Tugas' });
	});

	test('memakai persentase terakhir bila ada beberapa', () => {
		expect(extractHeaderWeight('UTS (Midterm) # Studi Kasus (10%) (20 %)').percent).toBe(20);
	});
});

describe('sumWeights dan weightsMatchTotal', () => {
	test('bobot lengkap dijumlahkan, bobot hilang menandai tidak lengkap', () => {
		expect(sumWeights([5, 5, 5, 20, 10, 15, 20, 20])).toEqual({ total: 100, complete: true });
		expect(sumWeights([50, null, 30])).toEqual({ total: 80, complete: false });
	});

	test('toleransi dalam poin persen', () => {
		expect(weightsMatchTotal(100, 0.5)).toBe(true);
		expect(weightsMatchTotal(99.6, 0.5)).toBe(true);
		expect(weightsMatchTotal(95, 0.5)).toBe(false);
		expect(weightsMatchTotal(105, 0.5)).toBe(false);
	});
});
