import { expect, test } from '../../support/e2e/test.ts';

test.describe.configure({ mode: 'serial' });

let studentPath = '';

test('direktori mahasiswa dapat dicari dan membuka profil', async ({ asAdmin: page }) => {
	await page.goto('/app/admin/students');
	await page.getByLabel('Cari mahasiswa').fill('Mahasiswa Uji 001');
	await page.getByRole('button', { name: 'Terapkan filter' }).click();
	const link = page.getByRole('link', { name: 'Mahasiswa Uji 001', exact: true });
	await expect(link).toBeVisible();
	await link.click();
	await expect(page).toHaveURL(/\/app\/students\/[0-9a-f-]{36}$/);
	studentPath = new URL(page.url()).pathname;
	await expect(page.getByRole('heading', { level: 1, name: 'Mahasiswa Uji 001' })).toBeVisible();
	await expect(page.getByText(/NIM 99\d+/)).toBeVisible();
});

test('profil memuat daftar CPL tercapai tanpa pelacak per semester, riwayat per mata kuliah dengan sumber hasil, dan riwayat perubahan', async ({ asAdmin: page }) => {
	await page.goto(studentPath);
	await expect(page.getByRole('heading', { name: 'CPL yang telah dicapai' })).toBeVisible();
	await expect(page.getByRole('heading', { name: /per semester/i })).toHaveCount(0);

	await page.getByRole('tab', { name: /Mata kuliah \(1\)/ }).click();
	const enrollment = page.locator('[data-enrollment="E2EA"]');
	await enrollment.locator('summary').click();
	await expect(enrollment).toContainText('Mata Kuliah Uji A');
	await expect(enrollment).toContainText(/Dihitung sistem \(rumus v1\)/);
	await expect(enrollment.getByRole('columnheader', { name: 'Referensi Excel' }).first()).toBeVisible();

	await page.getByRole('tab', { name: /Riwayat perubahan/ }).click();
	await expect(page.getByRole('cell', { name: 'Impor awal' }).first()).toBeVisible();
});

test('transkrip PDF dapat diunduh dengan nama berkas tanpa data pribadi', async ({ asAdmin: page }) => {
	const response = await page.request.get(`${studentPath}/transcript.pdf`);
	expect(response.status()).toBe(200);
	expect(response.headers()['content-type']).toBe('application/pdf');
	const disposition = response.headers()['content-disposition'];
	expect(disposition).toMatch(/attachment; filename="transkrip-[0-9a-f]{8}\.pdf"/);
	expect(disposition).not.toMatch(/\d{9,}/);
	expect((await response.body()).subarray(0, 5).toString()).toBe('%PDF-');
});

test('angkatan dapat diisi manual lalu dipakai sebagai filter', async ({ asAdmin: page }) => {
	await page.goto('/app/admin/students?cari=Mahasiswa+Uji+001');
	const row = page.getByRole('row', { name: /Mahasiswa Uji 001/ });
	await row.getByLabel(/Angkatan Mahasiswa Uji 001/).fill('2024');
	await row.getByRole('button', { name: 'Simpan' }).click();
	await expect(page.getByText('Angkatan 2024 disimpan.')).toBeVisible();
	await page.goto('/app/admin/students?angkatan=2024');
	await expect(page.getByRole('link', { name: 'Mahasiswa Uji 001' })).toBeVisible();
	await page.goto('/app/admin/students?angkatan=1999');
	await expect(page.getByText('Tidak ada mahasiswa')).toBeVisible();
});

test('dosen melihat profil mahasiswa kelasnya dengan catatan cakupan, tetapi tidak mahasiswa kelas lain', async ({ asLecturerA: page, asLecturerB }) => {
	const own = await page.goto(studentPath);
	expect(own!.status()).toBe(200);
	await expect(page.getByText(/hasil dari kelas yang Anda ampu saja/)).toBeVisible();
	const transcript = await page.request.get(`${studentPath}/transcript.pdf`);
	expect(transcript.status()).toBe(200);

	const foreign = await asLecturerB.goto(studentPath);
	expect(foreign!.status()).toBe(404);
	const foreignPdf = await asLecturerB.request.get(`${studentPath}/transcript.pdf`);
	expect(foreignPdf.status()).toBe(404);
});

test('mahasiswa yang tidak ada mengembalikan 404 yang sama dengan di luar cakupan', async ({ asAdmin: page }) => {
	const response = await page.goto('/app/students/3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b');
	expect(response!.status()).toBe(404);
});
