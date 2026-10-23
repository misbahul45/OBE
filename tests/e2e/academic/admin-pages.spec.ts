import { expect, test } from '../../support/e2e/test.ts';

test.describe.configure({ mode: 'serial' });

const cpl = { code: 'CPL-9', title: 'Capaian uji kurikulum', changed: 'Capaian uji kurikulum (revisi)' };

test('Super Admin menambah dan mengubah CPL', async ({ asAdmin: page }) => {
	await page.goto('/app/admin/curriculum');
	await page.getByLabel('Kode', { exact: true }).fill(cpl.code);
	await page.getByLabel('Judul', { exact: true }).fill(cpl.title);
	await page.getByRole('button', { name: 'Tambah CPL' }).click();
	await expect(page.getByText(`${cpl.code} dibuat.`)).toBeVisible();
	const row = page.getByRole('row', { name: new RegExp(cpl.code) });
	await expect(row).toContainText(cpl.title);

	await row.getByRole('link', { name: 'Ubah' }).click();
	await expect(page.getByRole('heading', { name: `Ubah ${cpl.code}` })).toBeVisible();
	await page.getByLabel('Judul', { exact: true }).fill(cpl.changed);
	await page.getByRole('button', { name: 'Simpan perubahan' }).click();
	await expect(page.getByText(`${cpl.code} diperbarui.`)).toBeVisible();
});

test('kode CPL ganda ditolak dengan pesan pada bidangnya', async ({ asAdmin: page }) => {
	await page.goto('/app/admin/curriculum');
	await page.getByLabel('Kode', { exact: true }).fill(cpl.code);
	await page.getByLabel('Judul', { exact: true }).fill('Duplikat');
	await page.getByRole('button', { name: 'Tambah CPL' }).click();
	await expect(page.getByRole('alert').first()).toBeVisible();
	await expect(page.getByText(`${cpl.code} dibuat.`)).toHaveCount(0);
});

test('CPMK ditambahkan lalu dipetakan ke CPL dan pemetaan dapat dihapus', async ({ asAdmin: page, state }) => {
	await page.goto(`/app/admin/curriculum/${state.ids.courseB}`);
	await page.getByLabel('Kode', { exact: true }).fill('CPMK-1');
	await page.getByRole('button', { name: 'Tambah', exact: true }).click();
	await expect(page.getByText('CPMK-1 dibuat.')).toBeVisible();

	const form = page.locator('form[action="?/setCpmkCpl"]');
	await form.locator('#cm-cpmk').selectOption({ label: 'CPMK-1' });
	await form.locator('#cm-cpl').selectOption({ label: `${cpl.code} · ${cpl.changed}` });
	await form.getByRole('button', { name: 'Simpan' }).click();
	await expect(page.getByText(/Pemetaan CPMK ke CPL disimpan/)).toBeVisible();
	const mapping = page.getByRole('row', { name: /CPMK-1.*CPL-9/ });
	await expect(mapping).toBeVisible();

	await mapping.getByRole('button', { name: 'Hapus' }).click();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Hapus', exact: true }).click();
	await expect(page.getByText(/Pemetaan dihapus/)).toBeVisible();
	await expect(page.getByRole('row', { name: /CPMK-1.*CPL-9/ })).toHaveCount(0);
});

test('kebijakan aktif tidak dapat diubah; draf salinan diatur targetnya lalu diaktifkan', async ({ asAdmin: page }) => {
	await page.goto('/app/admin/curriculum');
	await expect(page.getByText('Kebijakan aktif tidak dapat diubah.')).toBeVisible();
	await page.getByRole('button', { name: 'Salin menjadi draf baru' }).click();
	await expect(page.getByText(/Kebijakan aktif disalin menjadi draf versi/)).toBeVisible();
	await expect(page.getByText(/Draf versi \d+/)).toBeVisible();

	const targetForm = page.locator('form[action="?/setTarget"]').filter({ hasText: cpl.code });
	await targetForm.getByLabel(new RegExp(cpl.code)).fill('65');
	await targetForm.getByRole('button', { name: 'Simpan' }).click();
	await expect(page.getByText('Target CPL disimpan.')).toBeVisible();

	await page.getByRole('button', { name: 'Aktifkan draf ini' }).click();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Aktifkan', exact: true }).click();
	await expect(page.getByText(/Kebijakan versi \d+ kini aktif\./)).toBeVisible();
	await expect(page.getByText('Salin menjadi draf baru')).toBeVisible();
	await expect(page.getByRole('list', { name: 'Target CPL kebijakan aktif' }).getByRole('listitem').filter({ hasText: cpl.code })).toContainText('65');
});

test('halaman laporan menyediakan PDF kelas yang sah', async ({ asAdmin: page }) => {
	await page.goto('/app/admin/reports');
	const row = page.getByRole('row', { name: /Mata Kuliah Uji A/ });
	await expect(row).toBeVisible();
	const href = await row.getByRole('link', { name: 'PDF kelas' }).getAttribute('href');
	const response = await page.request.get(href as string);
	expect(response.status()).toBe(200);
	expect(response.headers()['content-type']).toBe('application/pdf');
	expect((await response.body()).subarray(0, 5).toString()).toBe('%PDF-');
});

test('jejak audit mencatat perubahan kurikulum dan dapat dicari', async ({ asAdmin: page }) => {
	await page.goto('/app/admin/audit?cari=CPL-9');
	await expect(page.getByRole('row', { name: /cpl\.create/ })).toBeVisible();
	await expect(page.getByRole('row', { name: /cpl\.update/ })).toBeVisible();
	await page.goto('/app/admin/audit?cari=tidak-ada-catatan-ini');
	await expect(page.getByText('Tidak ada catatan')).toBeVisible();
});

test('dosen tidak dapat membuka halaman kurikulum, laporan, maupun audit admin', async ({ asLecturerA: page }) => {
	for (const path of ['/app/admin/curriculum', '/app/admin/reports', '/app/admin/audit', '/app/admin/students', '/app/admin/imports']) {
		const response = await page.goto(path);
		expect(response!.status(), path).toBe(403);
	}
});
