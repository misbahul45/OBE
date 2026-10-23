import { z } from 'zod';
import { optionalText } from '#lib/shared/http/zod.ts';
import { cqiActionStatuses, cqiStatuses } from './cqi.workflow.ts';

const optionalUuid = z.preprocess((value) => (value === '' || value === undefined ? null : value), z.union([z.null(), z.string().uuid('Pilihan tidak valid')]));

const optionalNumber = (label: string) =>
	z.preprocess(
		(value) => (value === '' || value === undefined || value === null ? null : typeof value === 'string' ? Number(value.replace(',', '.')) : value),
		z.union([z.null(), z.number().refine((n) => Number.isFinite(n), `${label} harus berupa angka`)])
	);

export const priorities = ['low', 'medium', 'high', 'critical'] as const;
export const priorityLabels: Record<(typeof priorities)[number], string> = { low: 'Rendah', medium: 'Sedang', high: 'Tinggi', critical: 'Kritis' };

export const findingSchema = z.object({
	title: z.string({ error: 'Judul wajib diisi' }).trim().min(5, 'Judul minimal 5 karakter').max(200, 'Judul maksimal 200 karakter'),
	description: z.string({ error: 'Deskripsi wajib diisi' }).trim().min(10, 'Deskripsi minimal 10 karakter').max(4000, 'Deskripsi maksimal 4000 karakter'),
	priority: z.enum(priorities, { error: 'Prioritas tidak valid' }).default('medium'),
	semesterId: optionalUuid,
	offeringId: optionalUuid,
	cplId: optionalUuid,
	cpmkId: optionalUuid
});

export const findingUpdateSchema = z.object({
	title: findingSchema.shape.title,
	description: findingSchema.shape.description,
	priority: findingSchema.shape.priority,
	rootCause: optionalText(4000)
});

const isoDate = z
	.string({ error: 'Tenggat wajib diisi' })
	.regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
	.refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value), 'Tanggal tidak valid');

export const actionSchema = z.object({
	description: z.string({ error: 'Deskripsi tindakan wajib diisi' }).trim().min(5, 'Deskripsi minimal 5 karakter').max(1000, 'Deskripsi maksimal 1000 karakter'),
	picUserId: z.string({ error: 'Penanggung jawab wajib dipilih' }).trim().min(1, 'Penanggung jawab wajib dipilih'),
	dueDate: isoDate
});

export const evidenceSchema = z
	.object({
		title: z.string({ error: 'Judul bukti wajib diisi' }).trim().min(3, 'Judul minimal 3 karakter').max(200, 'Judul maksimal 200 karakter'),
		url: optionalText(500).refine((value) => value === null || /^https?:\/\/[^\s]+$/i.test(value), 'Tautan harus diawali http:// atau https://'),
		note: optionalText(1000),
		actionId: optionalUuid
	})
	.refine((value) => value.url !== null || value.note !== null, { message: 'Isi tautan atau catatan bukti', path: ['url'] });

export const evaluationSchema = z.object({
	metricLabel: z.string({ error: 'Nama indikator wajib diisi' }).trim().min(3, 'Nama indikator minimal 3 karakter').max(120, 'Nama indikator maksimal 120 karakter'),
	valueBefore: optionalNumber('Nilai sebelum'),
	valueAfter: optionalNumber('Nilai sesudah'),
	conclusion: z.string({ error: 'Kesimpulan wajib diisi' }).trim().min(5, 'Kesimpulan minimal 5 karakter').max(2000, 'Kesimpulan maksimal 2000 karakter')
});

export const statusSchema = z.enum(cqiStatuses, { error: 'Status tidak valid' });
export const actionStatusSchema = z.enum(cqiActionStatuses, { error: 'Status tindakan tidak valid' });
