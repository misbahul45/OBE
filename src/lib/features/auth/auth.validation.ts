import { z } from 'zod';
import { passwordIssues } from './password-policy.ts';

export const loginInputSchema = z.object({
	email: z
		.string({ error: 'Email wajib diisi' })
		.trim()
		.min(1, 'Email wajib diisi')
		.pipe(z.email('Format email tidak valid'))
		.transform((value) => value.toLowerCase()),
	password: z.string({ error: 'Password wajib diisi' }).min(1, 'Password wajib diisi').max(128, 'Password terlalu panjang')
});

export const changePasswordSchema = z
	.object({
		currentPassword: z.string({ error: 'Password saat ini wajib diisi' }).min(1, 'Password saat ini wajib diisi'),
		newPassword: z.string({ error: 'Password baru wajib diisi' }).superRefine((value, ctx) => {
			for (const message of passwordIssues(value)) ctx.addIssue({ code: 'custom', message });
		}),
		confirmPassword: z.string({ error: 'Konfirmasi password wajib diisi' }).min(1, 'Konfirmasi password wajib diisi')
	})
	.superRefine((value, ctx) => {
		if (value.newPassword !== value.confirmPassword) ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Konfirmasi tidak sama dengan password baru' });
		if (value.newPassword === value.currentPassword) ctx.addIssue({ code: 'custom', path: ['newPassword'], message: 'Password baru harus berbeda dari password saat ini' });
	});

export const profileNameSchema = z.object({
	name: z
		.string({ error: 'Nama wajib diisi' })
		.transform((value) => value.trim().replace(/\s+/g, ' '))
		.pipe(z.string().min(2, 'Nama minimal 2 karakter').max(100, 'Nama maksimal 100 karakter'))
});

export type FieldErrors = Record<string, string[]>;

export function fieldErrorsOf(error: z.ZodError): FieldErrors {
	const out: FieldErrors = {};
	for (const issue of error.issues) {
		const key = String(issue.path[0] ?? 'form');
		(out[key] ??= []).push(issue.message);
	}
	return out;
}
