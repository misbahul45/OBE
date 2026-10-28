import { expect, test } from '../../support/e2e/test.ts';

test.describe.configure({ mode: 'serial' });

test('dasbor dosen menampilkan kelasnya dengan status bobot dan jumlah mahasiswa', async ({ asLecturerA: page }) => {
	await page.goto('/app/lecturer');
	const card = page.locator('[data-offering]').filter({ hasText: 'Mata Kuliah Uji A' });
	await expect(card).toBeVisible();
	await expect(card).toContainText('15 mahasiswa');
	await expect(card).toContainText('Bobot 100%');
	await expect(page.locator('[data-offering]').filter({ hasText: 'Kelas Uji B' })).toHaveCount(0);
});

test('halaman kelas menampilkan KPI, grafik beralt teks dengan tabel pengganti, dan hasil CPMK', async ({ asLecturerA: page, state }) => {
	await page.goto(`/app/lecturer/courses/${state.ids.offeringA}`);
	await expect(page.getByRole('heading', { level: 1, name: 'Mata Kuliah Uji A' })).toBeVisible();
	await expect(page.locator('dl').first()).toContainText('15');

	const figure = page.getByRole('figure').filter({ has: page.getByRole('heading', { name: 'Rata-rata CPMK kelas' }) });
	await expect(figure.getByRole('img')).toBeVisible();
	await expect(figure.getByRole('img')).toHaveAccessibleName(/Rata-rata CPMK kelas/);
	await figure.getByText('Lihat data sebagai tabel').click();
	await expect(figure.getByRole('table')).toContainText('CPMK-1');
	await expect(figure.getByRole('table')).toContainText(/Tercapai|Belum tercapai/);

	await expect(page.getByRole('heading', { name: 'Sebaran nilai akhir' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Sebaran capaian CPMK' })).toBeVisible();
	await expect(page.getByRole('heading', { name: /Jejak capaian/ })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Ketercapaian CPMK', exact: true })).toBeVisible();
	await expect(page.getByRole('heading', { level: 2, name: /Mahasiswa \(15\)/ })).toBeVisible();
});

test('mengubah bobot komponen memunculkan peringatan total bobot lalu hilang saat dikembalikan', async ({ asLecturerA: page, state }) => {
	await page.goto(`/app/lecturer/courses/${state.ids.offeringA}`);
	const editor = page.locator('[data-component="UTS-1"]');
	await editor.locator('summary').click();
	await editor.getByLabel('Bobot (%)').fill('6');
	await editor.getByRole('button', { name: 'Simpan', exact: true }).click();
	await expect(editor.getByText(/Komponen UTS-1 disimpan dan hasil dihitung ulang/)).toBeVisible();
	await expect(page.getByText(/Total bobot komponen 101%/)).toBeVisible();

	await editor.getByLabel('Bobot (%)').fill('5');
	await editor.getByRole('button', { name: 'Simpan', exact: true }).click();
	await expect(editor.getByText(/Komponen UTS-1 disimpan dan hasil dihitung ulang/)).toBeVisible();
	await page.reload();
	await expect(page.getByText(/Total bobot komponen/)).toHaveCount(0);
});

test('pemetaan komponen ke CPMK dapat diubah dan dipulihkan', async ({ asLecturerA: page, state }) => {
	await page.goto(`/app/lecturer/courses/${state.ids.offeringA}`);
	const editor = page.locator('[data-component="UTS-1"]');
	await editor.locator('summary').click();
	const before = await editor.locator('summary').innerText();
	await editor.getByRole('checkbox', { name: 'CPMK-3', exact: true }).check();
	await editor.getByRole('button', { name: 'Simpan pemetaan' }).click();
	await expect(editor.getByText(/Pemetaan CPMK komponen UTS-1 disimpan/)).toBeVisible();
	await expect(editor.locator('summary')).toContainText('2 CPMK');
	await editor.getByRole('checkbox', { name: 'CPMK-3', exact: true }).uncheck();
	await editor.getByRole('button', { name: 'Simpan pemetaan' }).click();
	await expect(editor.getByText(/Pemetaan CPMK komponen UTS-1 disimpan/)).toBeVisible();
	await expect(editor.locator('summary')).toContainText('1 CPMK');
	expect(before).toContain('1 CPMK');
});

test('laporan PDF kelas dapat diunduh dan memuat identitas kelas', async ({ asLecturerA: page, state }) => {
	const response = await page.request.get(`/app/lecturer/courses/${state.ids.offeringA}/report.pdf`);
	expect(response.status()).toBe(200);
	expect(response.headers()['content-type']).toBe('application/pdf');
	expect(response.headers()['content-disposition']).toMatch(/attachment; filename="laporan-kelas-E2EA-A\.pdf"/);
	expect(response.headers()['cache-control']).toBe('no-store');
	const bytes = await response.body();
	expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
	expect(bytes.length).toBeGreaterThan(1500);
});

test('Super Admin membuka kelas yang sama dengan hak penuh dan dosen lain tetap ditolak', async ({ asAdmin: page, asLecturerB, state }) => {
	await page.goto(`/app/admin/offerings/${state.ids.offeringA}`);
	await expect(page.getByRole('heading', { level: 1, name: 'Mata Kuliah Uji A' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Hitung ulang hasil' })).toBeVisible();
	const denied = await asLecturerB.goto(`/app/lecturer/courses/${state.ids.offeringA}`);
	expect(denied!.status()).toBe(404);
});

test('hitung ulang manual aman diulang dan melaporkan hasil sudah mutakhir', async ({ asLecturerA: page, state }) => {
	await page.goto(`/app/lecturer/courses/${state.ids.offeringA}`);
	await page.getByRole('button', { name: 'Hitung ulang hasil' }).click();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Hitung ulang' }).click();
	await expect(page.getByText('Hasil sudah mutakhir; tidak ada perubahan.')).toBeVisible();
});
