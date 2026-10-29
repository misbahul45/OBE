import { describe, expect, test } from 'bun:test';
import { bestFields, cplAchievements, fieldFits, fitCategory, isPredictedLinear, linearitySummary, profileFits, tracerDefaults } from '#lib/features/tracer/tracer.calc.ts';

const inputs = [
	{ code: 'A', value: 80, target: 70 },
	{ code: 'B', value: 63, target: 70 },
	{ code: 'C', value: 70, target: 70 }
];

describe('contoh hitung pada dokumen OBE: T=70, S=(80,63,70), bobot profil (3,2,1)', () => {
	const achievements = cplAchievements(inputs);
	const profile = { code: 'PL1', name: 'Analis Data', weights: { A: 3, B: 2, C: 1 } };

	test('capaian, status tercapai, dan gap per CPL', () => {
		expect(achievements.map((a) => a.capaian)).toEqual([1, 0.9, 1]);
		expect(achievements.map((a) => a.achieved)).toEqual([true, false, true]);
		expect(achievements.map((a) => a.gap)).toEqual([0, 7, 0]);
	});

	test('skor P 96,7, cakupan 66,7, indeks 87,7, kategori Sangat Sesuai', () => {
		const [fit] = profileFits([profile], achievements);
		expect(fit.score).toBeCloseTo(96.67, 1);
		expect(fit.coverage).toBeCloseTo(66.67, 1);
		expect(fit.index).toBeCloseTo(87.67, 1);
		expect(fit.category).toBe('Sangat Sesuai');
		expect(fit.dataShare).toBe(1);
	});

	test('kecocokan bidang kerja berbobot F = Σ r·MIN(S/R,1) / Σ r × 100 dan versi berbasis gap', () => {
		const field = { code: 'BK1', name: 'Bidang Uji', profiles: { PL1: 1 } };
		const fits = profileFits([profile], achievements);
		const [result] = fieldFits([field], [profile], achievements, fits);
		expect(result.weighted).toBeCloseTo(((3 * 1 + 2 * 0.9 + 1 * 1) / 6) * 100, 1);
		expect(result.gapBased).toBeCloseTo((1 - (2 * 7) / (6 * 70)) * 100, 1);
		expect(result.viaProfile).toBeCloseTo(87.67, 1);
		expect(isPredictedLinear(result)).toBe(true);
		expect(isPredictedLinear(result, 99)).toBe(false);
	});
});

describe('ketentuan data yang kurang', () => {
	test('CPL tanpa nilai atau tanpa ambang tidak dihitung sebagai nol dan tidak mengubah penyebut', () => {
		const achievements = cplAchievements([
			{ code: 'A', value: 80, target: 70 },
			{ code: 'B', value: null, target: 70 },
			{ code: 'C', value: 50, target: null }
		]);
		expect(achievements[1]).toMatchObject({ capaian: null, achieved: null, gap: null });
		expect(achievements[2]).toMatchObject({ capaian: null, achieved: null });
		const [fit] = profileFits([{ code: 'PL1', name: 'Uji', weights: { A: 1, B: 1, C: 1 } }], achievements);
		expect(fit.score).toBe(100);
		expect(fit.dataShare).toBeCloseTo(0.3333, 3);
	});

	test('profil tanpa satu pun CPL bernilai tidak dinilai, dan bidang tanpa bobot menghasilkan null', () => {
		const achievements = cplAchievements([{ code: 'A', value: null, target: 70 }]);
		const [fit] = profileFits([{ code: 'PL1', name: 'Uji', weights: { A: 1 } }], achievements);
		expect(fit).toMatchObject({ score: null, index: null, category: null, dataShare: 0 });
		const [result] = fieldFits([{ code: 'BK1', name: 'Uji', profiles: { PL1: 3 } }], [{ code: 'PL1', name: 'Uji', weights: { A: 1 } }], achievements, [fit]);
		expect(result).toMatchObject({ weighted: null, gapBased: null, viaProfile: null });
		expect(isPredictedLinear(result)).toBeNull();
	});

	test('batas kategori mengikuti ambang 85, 70, 55', () => {
		expect([85, 84.99, 70, 69.99, 55, 54.99].map((v) => fitCategory(v))).toEqual(['Sangat Sesuai', 'Sesuai', 'Sesuai', 'Cukup Sesuai', 'Cukup Sesuai', 'Kurang Sesuai']);
		expect(tracerDefaults.linearThreshold).toBe(70);
	});

	test('peringkat bidang terbaik mengurutkan menurun, memutus seri menurut kode, dan membuang yang tanpa nilai', () => {
		const fits = [
			{ code: 'BK2', name: 'B', weighted: 90, gapBased: null, viaProfile: null },
			{ code: 'BK1', name: 'A', weighted: 90, gapBased: null, viaProfile: null },
			{ code: 'BK3', name: 'C', weighted: null, gapBased: null, viaProfile: null },
			{ code: 'BK10', name: 'D', weighted: 95, gapBased: null, viaProfile: null }
		];
		expect(bestFields(fits, 3).map((f) => f.code)).toEqual(['BK10', 'BK1', 'BK2']);
	});
});

describe('ringkasan linearitas: nyata dibanding prediksi', () => {
	test('menghitung persen linear nyata, matriks, dan kesesuaian hanya dari yang dapat dibandingkan', () => {
		const summary = linearitySummary([
			{ predicted: true, actual: true },
			{ predicted: true, actual: false },
			{ predicted: false, actual: false },
			{ predicted: false, actual: true },
			{ predicted: null, actual: true },
			{ predicted: true, actual: null },
			{ predicted: null, actual: null }
		]);
		expect(summary).toMatchObject({ students: 7, recorded: 5, actualLinear: 3, actualPercent: 60, comparable: 4, agreementPercent: 50 });
		expect(summary.matrix).toEqual({ predictedLinear: { actualLinear: 1, actualNotLinear: 1 }, predictedNotLinear: { actualLinear: 1, actualNotLinear: 1 } });
	});

	test('tanpa isian, persen dan kesesuaian bernilai null, bukan nol', () => {
		const summary = linearitySummary([{ predicted: true, actual: null }]);
		expect(summary).toMatchObject({ recorded: 0, actualPercent: null, comparable: 0, agreementPercent: null });
	});
});
