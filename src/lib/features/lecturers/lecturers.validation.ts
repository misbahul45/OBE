import { z } from 'zod';
import { optionalText } from '#lib/shared/http/zod.ts';

export const lecturerSchema = z.object({
	name: z.string({ error: 'Nama wajib diisi' }).trim().min(3, 'Nama minimal 3 karakter').max(120, 'Nama maksimal 120 karakter'),
	email: z
		.string({ error: 'Email wajib diisi' })
		.trim()
		.min(1, 'Email wajib diisi')
		.pipe(z.email('Format email tidak valid'))
		.transform((value) => value.toLowerCase()),
	lecturerCode: optionalText(20).refine((value) => value === null || /^[A-Za-z0-9._-]{2,20}$/.test(value), 'Kode dosen 2-20 karakter huruf, angka, titik, garis').transform((value) => (value === null ? null : value.toUpperCase())),
	nidn: optionalText(16).refine((value) => value === null || /^\d{8,16}$/.test(value), 'NIDN harus 8-16 digit angka')
});

export const lecturerUpdateSchema = lecturerSchema.omit({ email: true });
