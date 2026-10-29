import { expect, test } from '../../support/e2e/test.ts';

test.describe.configure({ mode: 'serial' });

test('admin melihat statistik linear dan tidak linear beserta cara menghitungnya', async ({ asAdmin: page }) => {
	await page.goto('/app/admin/tracer');
	await expect(page.getByRole('heading', { level: 1, name: /Tracer alumni dan linearitas/ })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Statistik linearitas' })).toBeVisible();
	const stats = page.locator('dl').first();
	for (const label of ['Prediksi linear', 'Prediksi tidak linear', 'Belum dapat dinilai', 'Nyata linear', 'Nyata tidak linear', 'Prediksi sesuai nyata']) await expect(stats).toContainText(label);
	await expect(page.getByRole('figure').filter({ has: page.getByRole('heading', { name: 'Linear dan tidak linear' }) })).toBeVisible();
	await page.getByText('Cara menghitung').click();
	await expect(page.getByText(/Kecocokan bidang kerja F/)).toBeVisible();
});

test('data nyata diisi manual, statistik berubah, lalu dapat dihapus kembali', async ({ asAdmin: page }) => {
	await page.goto('/app/admin/tracer');
	await page.getByLabel('Cari mahasiswa').fill('Mahasiswa Uji 001');
	await page.getByRole('button', { name: 'Terapkan filter' }).click();
	const row = page.locator('section[aria-labelledby="list-heading"] tbody tr').first();
	await expect(row).toContainText('Mahasiswa Uji 001');
	await row.getByLabel(/Linear atau tidak untuk/).selectOption('ya');
	await row.getByLabel(/Bidang kerja/).selectOption({ index: 1 });
	await row.getByRole('button', { name: 'Simpan' }).click();
	await expect(page.getByText('Data tracer disimpan.')).toBeVisible();
	await expect(page.locator('dl').first()).toContainText('dari 1 yang diisi');
	await row.getByRole('button', { name: 'Hapus' }).click();
	await expect(page.getByText('Data tracer dihapus.')).toBeVisible();
	await expect(page.locator('dl').first()).toContainText('dari 0 yang diisi');
});

test('dosen tidak dapat membuka halaman tracer alumni', async ({ asLecturerA: page }) => {
	const response = await page.goto('/app/admin/tracer');
	expect([401, 403, 404]).toContain(response!.status());
});
