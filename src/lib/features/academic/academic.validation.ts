import { z } from 'zod';
import { optionalText } from '#lib/shared/http/zod.ts';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal harus berformat YYYY-MM-DD');
const id = (label: string) => z.uuid(`${label} tidak valid`);

export const termLabels = { ganjil: 'Ganjil', genap: 'Genap', pendek: 'Pendek' } as const;

export const academicYearSchema = z.object({
	startYear: z.coerce.number({ error: 'Tahun mulai wajib diisi' }).int('Tahun harus bilangan bulat').min(2000, 'Tahun minimal 2000').max(2100, 'Tahun maksimal 2100')
});

export const semesterSchema = z
	.object({
		academicYearId: id('Tahun akademik'),
		term: z.enum(['ganjil', 'genap', 'pendek'], { error: 'Jenis semester wajib dipilih' }),
		startDate: isoDate,
		endDate: isoDate
	})
	.refine((value) => value.endDate >= value.startDate, { path: ['endDate'], message: 'Tanggal akhir tidak boleh sebelum tanggal mulai' });

export const courseSchema = z.object({
	code: z
		.string({ error: 'Kode wajib diisi' })
		.trim()
		.transform((value) => value.toUpperCase())
		.pipe(z.string().regex(/^[A-Z0-9]{2,12}$/, 'Kode 2-12 karakter huruf besar atau angka tanpa spasi')),
	name: z.string({ error: 'Nama wajib diisi' }).trim().min(3, 'Nama minimal 3 karakter').max(150, 'Nama maksimal 150 karakter'),
	credits: z.coerce.number({ error: 'SKS wajib diisi' }).int('SKS harus bilangan bulat').min(1, 'SKS minimal 1').max(12, 'SKS maksimal 12'),
	description: optionalText(1000)
});

export const offeringSchema = z.object({
	courseId: id('Mata kuliah'),
	semesterId: id('Semester'),
	section: z
		.string()
		.trim()
		.optional()
		.transform((value) => (value ? value.toUpperCase() : 'A'))
		.pipe(z.string().regex(/^[A-Z0-9]{1,6}$/, 'Kelas 1-6 karakter huruf besar atau angka'))
});

export const assignmentSchema = z.object({
	offeringId: id('Penawaran kelas'),
	lecturerId: id('Dosen'),
	role: z.enum(['coordinator', 'member']).default('member')
});

export type AcademicActor = { id: string; role: string };
