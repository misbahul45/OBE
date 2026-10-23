import { describe, expect, test } from 'bun:test';
import { profileNameSchema } from '#lib/features/auth/auth.validation.ts';

describe('profileNameSchema', () => {
	test('memangkas spasi tepi dan merapatkan spasi ganda', () => {
		expect(profileNameSchema.parse({ name: '  Dosen   Uji  Satu ' })).toEqual({ name: 'Dosen Uji Satu' });
	});

	test('menolak nama kosong, terlalu pendek, dan terlalu panjang dengan pesan bahasa Indonesia', () => {
		const messages = (name: unknown) => {
			const result = profileNameSchema.safeParse({ name });
			return result.success ? [] : result.error.issues.map((issue) => issue.message);
		};
		expect(messages('   ')).toContain('Nama minimal 2 karakter');
		expect(messages('A')).toContain('Nama minimal 2 karakter');
		expect(messages('A'.repeat(101))).toContain('Nama maksimal 100 karakter');
		expect(messages(undefined)).toContain('Nama wajib diisi');
	});
});
