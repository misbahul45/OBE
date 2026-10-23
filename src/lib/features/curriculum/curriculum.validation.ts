import { z } from 'zod';
import { optionalText } from '#lib/shared/http/zod.ts';
import { parseCodeList } from '#lib/shared/help/accreditation-codes.ts';

const uuid = (label: string) => z.uuid(`${label} tidak valid`);

export function normalizeOutcomeCode(kind: 'CPL' | 'CPMK', raw: string): string | null {
	const match = new RegExp(`^${kind}\\s*[-_. ]?\\s*0*([0-9]{1,2})$`, 'i').exec(raw.trim());
	return match ? `${kind}-${Number(match[1])}` : null;
}

const outcomeCode = (kind: 'CPL' | 'CPMK') =>
	z
		.string({ error: `Kode ${kind} wajib diisi` })
		.transform((value, ctx) => {
			const normalized = normalizeOutcomeCode(kind, value);
			if (!normalized) ctx.addIssue({ code: 'custom', message: `Kode ${kind} harus berformat ${kind}-n (contoh ${kind}-1)` });
			return normalized ?? value;
		});

const optionalNumber = (min: number, max: number, label: string) =>
	z
		.preprocess(
			(value) => (value === '' || value === undefined ? null : value),
			z.union([z.null(), z.coerce.number()]).refine((value) => value === null || (Number.isFinite(value) && value >= min && value <= max), `${label} harus antara ${min} dan ${max}`)
		)
		.optional()
		.transform((value) => value ?? null);

const accreditationCodes = (kind: 'WA' | 'WK', label: string) =>
	z
		.string()
		.optional()
		.transform((value, ctx) => {
			const { codes, invalid } = parseCodeList(value ?? '', kind);
			if (invalid.length) ctx.addIssue({ code: 'custom', message: `${label} tidak dikenal: ${invalid.join(', ')}. Gunakan format ${kind}-n, contoh ${kind}-1` });
			return codes;
		});

export const cplSchema = z.object({
	code: outcomeCode('CPL'),
	title: z.string({ error: 'Judul wajib diisi' }).trim().min(3, 'Judul minimal 3 karakter').max(200, 'Judul maksimal 200 karakter'),
	description: optionalText(2000),
	graduateAttributes: accreditationCodes('WA', 'Atribut lulusan'),
	knowledgeProfiles: accreditationCodes('WK', 'Profil pengetahuan'),
	sortOrder: z.coerce.number().int().min(0).max(999).default(0)
});

export const cpmkSchema = z.object({
	courseId: uuid('Mata kuliah'),
	code: outcomeCode('CPMK'),
	description: optionalText(2000),
	taxonomyLevel: optionalText(20)
});

export const courseCplMappingSchema = z.object({
	courseId: uuid('Mata kuliah'),
	cplId: uuid('CPL'),
	contribution: optionalNumber(0, 100, 'Kontribusi'),
	approvalSource: optionalText(200)
});

export const cpmkCplMappingSchema = z.object({
	cpmkId: uuid('CPMK'),
	cplId: uuid('CPL'),
	weight: z.coerce.number({ error: 'Bobot wajib diisi' }).gt(0, 'Bobot harus lebih dari 0').max(1000, 'Bobot terlalu besar')
});

export const componentTypes = ['uts', 'uas', 'tugas', 'kuis', 'proyek', 'praktikum', 'kehadiran', 'softskill', 'lainnya'] as const;

export const componentSchema = z.object({
	offeringId: uuid('Penawaran kelas'),
	code: z
		.string({ error: 'Kode wajib diisi' })
		.trim()
		.transform((value) => value.toUpperCase())
		.pipe(z.string().regex(/^[A-Z0-9-]{1,20}$/, 'Kode 1-20 karakter huruf besar, angka, atau tanda hubung')),
	name: z.string({ error: 'Nama wajib diisi' }).trim().min(2, 'Nama minimal 2 karakter').max(150, 'Nama maksimal 150 karakter'),
	type: z.enum(componentTypes).default('lainnya'),
	weightPercent: optionalNumber(0, 100, 'Bobot'),
	maxScore: z.coerce.number().gt(0, 'Nilai maksimum harus lebih dari 0').max(1000).default(100),
	isRequired: z.coerce.boolean().default(true)
});

export const assessmentCpmkMappingSchema = z.object({
	componentId: uuid('Komponen'),
	cpmkId: uuid('CPMK'),
	coefficient: z.coerce.number().gt(0, 'Koefisien harus lebih dari 0').max(1000).default(1)
});

export const policySchema = z.object({
	name: z.string({ error: 'Nama kebijakan wajib diisi' }).trim().min(3, 'Nama minimal 3 karakter').max(120),
	scaleMax: z.coerce.number().gt(0).max(1000).default(100),
	achievementThreshold: optionalNumber(0, 1000, 'Ambang nilai'),
	classAchievementRatio: optionalNumber(0, 100, 'Rasio ketercapaian kelas'),
	weightTolerance: z.coerce.number().min(0, 'Toleransi minimal 0').max(0.1, 'Toleransi maksimal 0,1').default(0.01),
	aggregationMethod: z.enum(['not_configured', 'simple_mean', 'credit_weighted_mean']).default('not_configured'),
	notes: optionalText(2000)
});

export const cplTargetSchema = z.object({
	policyId: uuid('Kebijakan'),
	cplId: uuid('CPL'),
	target: z.coerce.number({ error: 'Target wajib diisi' }).min(0, 'Target minimal 0').max(1000, 'Target terlalu besar')
});

export type CurriculumActor = { id: string; role: string };

export function componentWeightSummary(components: { weightPercent: number | null; isActive?: boolean }[], tolerancePercent = 0.5) {
	const active = components.filter((c) => c.isActive !== false);
	const complete = active.length > 0 && active.every((c) => c.weightPercent !== null);
	const total = Math.round(active.reduce((sum, c) => sum + (c.weightPercent ?? 0), 0) * 10000) / 10000;
	return { total: complete ? total : null, complete, ok: complete && Math.abs(total - 100) <= tolerancePercent, count: active.length };
}
