import { describe, expect, test } from 'bun:test';
import { assessmentCpmkMappingSchema, componentSchema, componentWeightSummary, cplSchema, cpmkSchema, normalizeOutcomeCode, policySchema } from '#lib/features/curriculum/curriculum.validation.ts';

const uuid = '3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b';

describe('normalizeOutcomeCode', () => {
	test('berbagai penulisan dinormalisasi ke bentuk baku', () => {
		for (const raw of ['CPL 3', 'cpl-3', 'CPL3', 'CPL_03', ' cpl 03 ']) expect(normalizeOutcomeCode('CPL', raw)).toBe('CPL-3');
		expect(normalizeOutcomeCode('CPMK', 'cpmk 12')).toBe('CPMK-12');
	});

	test('jenis yang salah, tanpa nomor, atau terlalu panjang ditolak', () => {
		for (const raw of ['CPMK-1', 'CPL', 'CPL-100', 'CPL-x', '']) expect(normalizeOutcomeCode('CPL', raw)).toBeNull();
	});
});

describe('skema kurikulum', () => {
	test('CPL dan CPMK memakai kode ternormalisasi dan menolak kode salah dengan pesan', () => {
		expect(cplSchema.parse({ code: 'cpl 2', title: 'Pengetahuan dasar' }).code).toBe('CPL-2');
		expect(cpmkSchema.parse({ courseId: uuid, code: 'CPMK3' }).code).toBe('CPMK-3');
		const bad = cplSchema.safeParse({ code: 'CPMK-1', title: 'Judul sah' });
		expect(bad.error!.issues.map((i) => i.message)).toContain('Kode CPL harus berformat CPL-n (contoh CPL-1)');
	});

	test('bobot komponen kosong berarti belum dikonfigurasi (null), bukan 0', () => {
		const base = { offeringId: uuid, code: 'uts-1', name: 'UTS' };
		expect(componentSchema.parse({ ...base, weightPercent: '' }).weightPercent).toBeNull();
		expect(componentSchema.parse({ ...base, weightPercent: undefined }).weightPercent).toBeNull();
		expect(componentSchema.parse({ ...base, weightPercent: '0' }).weightPercent).toBe(0);
		expect(componentSchema.parse({ ...base, weightPercent: '25.5' }).weightPercent).toBe(25.5);
		expect(componentSchema.parse({ ...base }).code).toBe('UTS-1');
		expect(componentSchema.safeParse({ ...base, weightPercent: '101' }).success).toBe(false);
	});

	test('koefisien dan bobot pemetaan harus positif', () => {
		expect(assessmentCpmkMappingSchema.safeParse({ componentId: uuid, cpmkId: uuid, coefficient: 0 }).success).toBe(false);
		expect(assessmentCpmkMappingSchema.parse({ componentId: uuid, cpmkId: uuid }).coefficient).toBe(1);
	});

	test('kebijakan: ambang kosong tetap null dan metode agregasi bawaan belum dikonfigurasi', () => {
		const policy = policySchema.parse({ name: 'Kebijakan Uji', achievementThreshold: '', classAchievementRatio: '' });
		expect(policy).toMatchObject({ achievementThreshold: null, classAchievementRatio: null, aggregationMethod: 'not_configured', scaleMax: 100, weightTolerance: 0.01 });
		expect(policySchema.safeParse({ name: 'Kebijakan Uji', classAchievementRatio: 120 }).success).toBe(false);
		expect(policySchema.safeParse({ name: 'Kebijakan Uji', aggregationMethod: 'median' }).success).toBe(false);
	});
});

describe('componentWeightSummary', () => {
	test('lengkap dan berjumlah 100 dinyatakan ok; komponen nonaktif tidak dihitung', () => {
		expect(componentWeightSummary([{ weightPercent: 40 }, { weightPercent: 60 }, { weightPercent: 10, isActive: false }])).toEqual({ total: 100, complete: true, ok: true, count: 2 });
	});

	test('bobot hilang menandai tidak lengkap tanpa mengisi nol; jumlah salah tidak ok', () => {
		expect(componentWeightSummary([{ weightPercent: 40 }, { weightPercent: null }])).toMatchObject({ total: null, complete: false, ok: false });
		expect(componentWeightSummary([{ weightPercent: 60 }, { weightPercent: 60 }])).toMatchObject({ total: 120, complete: true, ok: false });
		expect(componentWeightSummary([])).toMatchObject({ complete: false, ok: false, count: 0 });
	});
});

describe('bidang angka opsional', () => {
	test('kunci yang tidak dikirim sama sekali, kosong, dan undefined seluruhnya menjadi null', () => {
		const base = { name: 'Kebijakan Uji' };
		expect(policySchema.parse(base).achievementThreshold).toBeNull();
		expect(policySchema.parse({ ...base, achievementThreshold: undefined }).achievementThreshold).toBeNull();
		expect(policySchema.parse({ ...base, achievementThreshold: '' }).achievementThreshold).toBeNull();
		expect(policySchema.parse({ ...base, achievementThreshold: '0' }).achievementThreshold).toBe(0);
		expect(policySchema.parse({ ...base, achievementThreshold: 62 }).achievementThreshold).toBe(62);
	});
});
