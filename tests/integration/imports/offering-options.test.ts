import { describe, expect, test } from 'bun:test';
import { activateSemester, createOffering } from '#lib/features/academic/index.server.ts';
import { offeringOptionsFor } from '#lib/features/imports/index.server.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { createCourse, createTerm, createUser } from '../../support/factories.ts';

const ctx = useIsolatedDatabase('imports_offering_options');

describe('pilihan kelas pada wizard impor', () => {
	test('memuat seluruh kelas semester aktif walau jumlahnya melebihi satu halaman (100)', async () => {
		const adminUser = await createUser(ctx.db, { role: 'super_admin' });
		const admin = { id: adminUser.id, role: 'super_admin' };
		const { semester } = await createTerm(ctx.db);
		await activateSemester(ctx.db, admin, semester.id);
		for (let index = 0; index < 125; index += 1) {
			const course = await createCourse(ctx.db, { name: `Mata Kuliah Banyak ${index}` });
			await createOffering(ctx.db, admin, { courseId: course.id, semesterId: semester.id, section: 'A' });
		}
		const options = await offeringOptionsFor(ctx.db, admin);
		expect(options).toHaveLength(125);
		expect(new Set(options.map((option) => option.id)).size).toBe(125);
	});
});
