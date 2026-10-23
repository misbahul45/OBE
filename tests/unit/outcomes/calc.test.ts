import { describe, expect, test } from 'bun:test';
import {
	achievementDistribution,
	aggregateCpl,
	classifyAchievement,
	compareWithReference,
	computeCpl,
	computeCpmk,
	computeFinalScore,
	normalizeScore,
	type CalcComponent,
	type CplMappingInput,
	type CpmkMappingInput
} from '#lib/features/outcomes/outcomes.calc.ts';

const uts: CalcComponent = { id: 'uts', code: 'UTS', weightPercent: 40, maxScore: 100, isRequired: true };
const uas: CalcComponent = { id: 'uas', code: 'UAS', weightPercent: 60, maxScore: 100, isRequired: true };
const cpmk1: CpmkMappingInput = { cpmkId: 'k1', code: 'CPMK-1', components: [{ componentId: 'uts', coefficient: 1 }, { componentId: 'uas', coefficient: 1 }] };
const cpmk2: CpmkMappingInput = { cpmkId: 'k2', code: 'CPMK-2', components: [{ componentId: 'uas', coefficient: 1 }] };

describe('normalizeScore', () => {
	test('menyetarakan skala ke 0-100 sesuai nilai maksimum komponen', () => {
		expect(normalizeScore(40, 50)).toBe(80);
		expect(normalizeScore(7.5, 10)).toBe(75);
		expect(normalizeScore(0, 100)).toBe(0);
	});
});

describe('computeCpmk (rumus v1: rata-rata tertimbang komponen terpetakan)', () => {
	test('hasil referensi hitung tangan: (40*80 + 60*90) / 100 = 86', () => {
		const result = computeCpmk(cpmk1, [uts, uas], { uts: 80, uas: 90 });
		expect(result).toMatchObject({ status: 'complete', value: 86, coverage: 1, missing: [], invalid: [] });
		expect(result.trace).toHaveLength(2);
	});

	test('koefisien pemetaan mengubah kontribusi relatif komponen', () => {
		const weighted: CpmkMappingInput = { ...cpmk1, components: [{ componentId: 'uts', coefficient: 2 }, { componentId: 'uas', coefficient: 1 }] };
		expect(computeCpmk(weighted, [uts, uas], { uts: 80, uas: 90 }).value).toBeCloseTo((2 * 40 * 80 + 60 * 90) / (2 * 40 + 60), 4);
	});

	test('skala komponen berbeda dinormalisasi sebelum dibobot', () => {
		const half: CalcComponent = { ...uts, maxScore: 50 };
		expect(computeCpmk(cpmk1, [half, uas], { uts: 40, uas: 90 }).value).toBe(86);
	});

	test('nilai 0 adalah nilai nyata, bukan kosong', () => {
		expect(computeCpmk(cpmk1, [uts, uas], { uts: 80, uas: 0 })).toMatchObject({ status: 'complete', value: 32 });
	});

	test('komponen wajib kosong membuat CPMK belum lengkap dan tidak dibagi dengan bobot yang tersedia', () => {
		const result = computeCpmk(cpmk1, [uts, uas], { uts: 80, uas: null });
		expect(result).toMatchObject({ status: 'incomplete', value: null, missing: ['UAS'], coverage: 0.5 });
		expect(computeCpmk(cpmk1, [uts, uas], { uts: 80 })).toMatchObject({ status: 'incomplete', missing: ['UAS'] });
	});

	test('CPMK yang hanya memetakan komponen bernilai tetap dapat dihitung walau komponen lain kosong', () => {
		expect(computeCpmk(cpmk2, [uts, uas], { uts: null, uas: 90 })).toMatchObject({ status: 'complete', value: 90 });
	});

	test('komponen opsional yang kosong dikeluarkan dari pembilang dan penyebut', () => {
		const optional: CalcComponent = { id: 'kuis', code: 'KUIS', weightPercent: 20, maxScore: 100, isRequired: false };
		const mapping: CpmkMappingInput = { ...cpmk1, components: [...cpmk1.components, { componentId: 'kuis', coefficient: 1 }] };
		expect(computeCpmk(mapping, [uts, uas, optional], { uts: 80, uas: 90, kuis: null })).toMatchObject({ status: 'complete', value: 86 });
		expect(computeCpmk(mapping, [uts, uas, optional], { uts: 80, uas: 90, kuis: 100 }).value).toBeCloseTo((40 * 80 + 60 * 90 + 20 * 100) / 120, 4);
	});

	test('belum dikonfigurasi: tanpa pemetaan, bobot hilang, komponen tak dikenal, bobot total nol', () => {
		expect(computeCpmk({ ...cpmk1, components: [] }, [uts, uas], { uts: 80, uas: 90 })).toMatchObject({ status: 'not_configured', reason: 'NO_COMPONENT_MAPPING', value: null });
		expect(computeCpmk(cpmk1, [{ ...uts, weightPercent: null }, uas], { uts: 80, uas: 90 })).toMatchObject({ status: 'not_configured', reason: 'WEIGHT_MISSING' });
		expect(computeCpmk({ ...cpmk1, components: [{ componentId: 'hilang', coefficient: 1 }] }, [uts, uas], { uts: 80 })).toMatchObject({ status: 'not_configured', reason: 'COMPONENT_NOT_FOUND' });
		expect(computeCpmk(cpmk1, [{ ...uts, weightPercent: 0 }, { ...uas, weightPercent: 0 }], { uts: 80, uas: 90 })).toMatchObject({ status: 'not_configured', reason: 'ZERO_TOTAL_WEIGHT' });
	});

	test('nilai di luar rentang, negatif, atau bukan angka ditandai tidak valid dan tidak dihitung', () => {
		for (const bad of [101, -1, Number.NaN]) expect(computeCpmk(cpmk1, [uts, uas], { uts: bad, uas: 90 })).toMatchObject({ status: 'incomplete', value: null, invalid: ['UTS'] });
	});
});

describe('computeCpl (dari CPMK terpetakan dengan bobot yang disahkan)', () => {
	const mapping: CplMappingInput = { cplId: 'p1', code: 'CPL-1', cpmk: [{ cpmkId: 'k1', weight: 1 }, { cpmkId: 'k2', weight: 3 }] };

	test('hasil referensi hitung tangan: (86*1 + 90*3) / 4 = 89', () => {
		const scores = { uts: 80, uas: 90 };
		const results = { k1: computeCpmk(cpmk1, [uts, uas], scores), k2: computeCpmk(cpmk2, [uts, uas], scores) };
		expect(computeCpl(mapping, results)).toMatchObject({ status: 'complete', value: 89, coverage: 1 });
	});

	test('satu CPMK belum lengkap membuat CPL belum lengkap, bukan dihitung dari yang tersedia', () => {
		const results = { k1: computeCpmk(cpmk1, [uts, uas], { uts: 80, uas: null }), k2: computeCpmk(cpmk2, [uts, uas], { uts: 80, uas: 90 }) };
		const cpl = computeCpl(mapping, results);
		expect(cpl).toMatchObject({ status: 'incomplete', value: null, coverage: 0.5 });
		expect(cpl.missing).toEqual(['cpmk:k1']);
	});

	test('CPMK belum dikonfigurasi atau pemetaan CPL kosong menghasilkan belum dikonfigurasi', () => {
		const unconfigured = { k1: computeCpmk({ ...cpmk1, components: [] }, [uts, uas], {}), k2: computeCpmk(cpmk2, [uts, uas], { uas: 90 }) };
		expect(computeCpl(mapping, unconfigured).status).toBe('not_configured');
		expect(computeCpl({ ...mapping, cpmk: [] }, {})).toMatchObject({ status: 'not_configured', reason: 'NO_CPMK_MAPPING' });
		expect(computeCpl(mapping, {}).status).toBe('not_configured');
	});
});

describe('computeFinalScore', () => {
	test('lengkap dan bobot berjumlah 100: rata-rata tertimbang', () => {
		expect(computeFinalScore([uts, uas], { uts: 80, uas: 90 })).toEqual({ status: 'complete', value: 86, missing: [] });
	});

	test('bobot hilang atau jumlah bukan 100 tidak dinormalisasi diam-diam', () => {
		expect(computeFinalScore([{ ...uts, weightPercent: null }, uas], { uts: 80, uas: 90 })).toMatchObject({ status: 'not_configured', reason: 'WEIGHT_MISSING' });
		expect(computeFinalScore([{ ...uts, weightPercent: 30 }, uas], { uts: 80, uas: 90 })).toMatchObject({ status: 'not_configured', reason: 'WEIGHT_TOTAL_MISMATCH' });
		expect(computeFinalScore([], {})).toMatchObject({ status: 'not_configured' });
	});

	test('komponen wajib kosong membuat nilai akhir belum lengkap', () => {
		expect(computeFinalScore([uts, uas], { uts: 80 })).toEqual({ status: 'incomplete', value: null, missing: ['UAS'] });
	});
});

describe('ketercapaian dan distribusi', () => {
	test('klasifikasi memisahkan belum cukup data dari belum tercapai dan target belum dikonfigurasi', () => {
		expect(classifyAchievement(75, 70)).toBe('tercapai');
		expect(classifyAchievement(70, 70)).toBe('tercapai');
		expect(classifyAchievement(69.99, 70)).toBe('belum_tercapai');
		expect(classifyAchievement(null, 70)).toBe('belum_cukup_data');
		expect(classifyAchievement(80, null)).toBe('target_belum_dikonfigurasi');
		expect(classifyAchievement(0, 70)).toBe('belum_tercapai');
	});

	test('distribusi menghitung rasio hanya dari yang dapat dinilai', () => {
		expect(achievementDistribution([90, 60, null, 75, null], 70)).toEqual({ achieved: 2, notAchieved: 1, insufficient: 2, unconfigured: 0, total: 5, ratioAchieved: 66.6667 });
		expect(achievementDistribution([90, null], null)).toMatchObject({ unconfigured: 1, insufficient: 1, ratioAchieved: null });
		expect(achievementDistribution([], 70)).toMatchObject({ total: 0, ratioAchieved: null });
	});
});

describe('aggregateCpl lintas mata kuliah', () => {
	const entries = [{ value: 80, credits: 2 }, { value: 90, credits: 4 }, { value: null, credits: 3 }];

	test('tanpa metode terkonfigurasi tidak menghasilkan angka', () => {
		expect(aggregateCpl(entries, 'not_configured')).toMatchObject({ status: 'not_configured', value: null });
	});

	test('rata-rata sederhana dan rata-rata tertimbang SKS memakai hanya nilai lengkap serta melaporkan cakupan', () => {
		expect(aggregateCpl(entries, 'simple_mean')).toEqual({ status: 'complete', value: 85, entries: 3, used: 2, coverage: 0.6667 });
		expect(aggregateCpl(entries, 'credit_weighted_mean')).toMatchObject({ status: 'complete', value: 86.6667, used: 2 });
	});

	test('tanpa data lengkap hasilnya belum cukup data', () => {
		expect(aggregateCpl([{ value: null, credits: 3 }], 'simple_mean')).toMatchObject({ status: 'insufficient', value: null, coverage: 0 });
		expect(aggregateCpl([], 'credit_weighted_mean')).toMatchObject({ status: 'insufficient' });
	});
});

describe('compareWithReference', () => {
	test('selisih dilaporkan bila melebihi toleransi dan diabaikan bila salah satu tidak ada', () => {
		expect(compareWithReference(76.4, 76.421)).toEqual({ differs: false, delta: -0.021 });
		expect(compareWithReference(80, 76.421)).toEqual({ differs: true, delta: 3.579 });
		expect(compareWithReference(null, 76)).toEqual({ differs: false, delta: null });
		expect(compareWithReference(80, 79, 0.5).differs).toBe(true);
	});
});
