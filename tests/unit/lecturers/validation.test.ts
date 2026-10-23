import { describe, expect, test } from 'bun:test';
import { lecturerSchema, lecturerUpdateSchema } from '#lib/features/lecturers/lecturers.validation.ts';

describe('lecturerSchema', () => {
	test('email dinormalisasi, kode dosen menjadi huruf besar, kolom opsional kosong menjadi null', () => {
		const result = lecturerSchema.parse({ name: ' Dosen Uji ', email: ' Dosen.Uji@Kampus.AC.ID ', lecturerCode: 'dsn-01', nidn: '' });
		expect(result).toEqual({ name: 'Dosen Uji', email: 'dosen.uji@kampus.ac.id', lecturerCode: 'DSN-01', nidn: null });
	});

	test('input tambahan seperti peran diabaikan sehingga tidak ada eskalasi hak dari formulir', () => {
		const result = lecturerSchema.parse({ name: 'Dosen Uji', email: 'a@b.test', role: 'super_admin', banned: false } as never);
		expect(Object.keys(result).sort()).toEqual(['email', 'lecturerCode', 'name', 'nidn']);
	});

	test('email, kode, dan NIDN tidak valid ditolak dengan pesan per bidang', () => {
		const result = lecturerSchema.safeParse({ name: 'Dosen Uji', email: 'bukan-email', lecturerCode: 'a b', nidn: '123' });
		expect(result.success).toBe(false);
		const byField = Object.fromEntries(result.error!.issues.map((i) => [String(i.path[0]), i.message]));
		expect(byField.email).toBe('Format email tidak valid');
		expect(byField.lecturerCode).toContain('Kode dosen');
		expect(byField.nidn).toBe('NIDN harus 8-16 digit angka');
	});

	test('pembaruan tidak mengizinkan perubahan email', () => {
		expect(Object.keys(lecturerUpdateSchema.parse({ name: 'Dosen Uji', email: 'x@y.test' } as never))).not.toContain('email');
	});
});
