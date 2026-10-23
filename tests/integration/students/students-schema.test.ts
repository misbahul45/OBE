import { describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { students } from '#lib/shared/db/schema.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { createStudent } from '../../support/factories.ts';
import { expectDatabaseRejection, pgCodes } from '../../support/postgres-error.ts';

const ctx = useIsolatedDatabase('students_schema');

describe('students.nim', () => {
	test('disimpan sebagai teks dan nol di depan dipertahankan', async () => {
		const row = await createStudent(ctx.db, { nim: '0012345678' });
		const [stored] = await ctx.db.select().from(students).where(eq(students.id, row.id));
		expect(stored.nim).toBe('0012345678');
		expect(typeof stored.nim).toBe('string');
	});

	test('NIM unik', async () => {
		await createStudent(ctx.db, { nim: '99011111111' });
		const failure = await expectDatabaseRejection(() => createStudent(ctx.db, { nim: '99011111111', name: 'Nama Lain' }));
		expect(failure.code).toBe(pgCodes.uniqueViolation);
	});

	test('NIM selain digit atau terlalu pendek ditolak', async () => {
		for (const nim of ['ABC12345', '12345', '9901234567890123', '99-0123456', '1.2345678E10']) {
			const failure = await expectDatabaseRejection(() => createStudent(ctx.db, { nim }));
			expect(failure.code).toBe(pgCodes.checkViolation);
			expect(failure.constraint).toBe('students_nim_digits');
		}
	});

	test('nama kosong ditolak', async () => {
		const failure = await expectDatabaseRejection(() => createStudent(ctx.db, { name: '   ' }));
		expect(failure.constraint).toBe('students_name_not_blank');
	});
});
