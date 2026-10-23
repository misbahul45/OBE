import { describe, expect, test } from 'bun:test';
import { createCpl, listCpl, updateCpl } from '#lib/features/curriculum/index.server.ts';
import { ValidationError } from '#lib/shared/http/errors.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { createUser } from '../../support/factories.ts';

const ctx = useIsolatedDatabase('curriculum_cpl_attributes');

async function actor() {
	const user = await createUser(ctx.db, { role: 'super_admin' });
	return { id: user.id, role: 'super_admin' };
}

describe('atribut WA dan WK pada CPL', () => {
	test('daftar dinormalkan, diurutkan, disimpan sebagai larik, dan dapat diperbarui', async () => {
		const admin = await actor();
		const cpl = await createCpl(ctx.db, admin, { code: 'cpl 1', title: 'Pengetahuan rekayasa', graduateAttributes: 'wa 5, WA-1 ; WA-1', knowledgeProfiles: 'WK-3, wk1' });
		expect(cpl.graduateAttributes).toEqual(['WA-1', 'WA-5']);
		expect(cpl.knowledgeProfiles).toEqual(['WK-1', 'WK-3']);
		const updated = await updateCpl(ctx.db, admin, cpl.id, { code: 'CPL-1', title: 'Pengetahuan rekayasa', graduateAttributes: 'WA-12', knowledgeProfiles: '' });
		expect(updated.graduateAttributes).toEqual(['WA-12']);
		expect(updated.knowledgeProfiles).toEqual([]);
		const listed = (await listCpl(ctx.db)).find((row) => row.id === cpl.id);
		expect(listed?.graduateAttributes).toEqual(['WA-12']);
	});

	test('tanpa isian, atribut berupa larik kosong', async () => {
		const admin = await actor();
		const cpl = await createCpl(ctx.db, admin, { code: 'CPL-2', title: 'Tanpa atribut' });
		expect(cpl.graduateAttributes).toEqual([]);
		expect(cpl.knowledgeProfiles).toEqual([]);
	});

	test('kode tidak dikenal ditolak dengan pesan per bidang dan tidak ada CPL yang tersimpan', async () => {
		const admin = await actor();
		const failure = await createCpl(ctx.db, admin, { code: 'CPL-3', title: 'Kode salah', graduateAttributes: 'WA-1, WA-13', knowledgeProfiles: 'WK-9' }).catch((error) => error);
		expect(failure).toBeInstanceOf(ValidationError);
		expect(failure.fieldErrors.graduateAttributes[0]).toContain('WA-13');
		expect(failure.fieldErrors.knowledgeProfiles[0]).toContain('WK-9');
		expect((await listCpl(ctx.db)).some((row) => row.code === 'CPL-3')).toBe(false);
	});
});
