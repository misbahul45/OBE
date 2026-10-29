import { expect, test } from '../../support/e2e/test.ts';

test.describe.configure({ mode: 'serial' });

test('pencarian langsung menerima beberapa kata berurutan bebas dan menyorot kecocokan', async ({ asAdmin: page }) => {
	await page.goto('/app/admin/students');
	await page.getByLabel('Cari mahasiswa').fill('001 uji');
	await expect(page).toHaveURL(/cari=001\+uji|cari=001%20uji/);
	const link = page.getByRole('link', { name: 'Mahasiswa Uji 001' });
	await expect(link).toBeVisible();
	await expect(page.locator('tbody mark').first()).toBeVisible();
	await expect(page.getByText('memuat semua kata')).toBeVisible();
	await expect(page.getByRole('link', { name: /Hapus penyaring Kata kunci/ })).toBeVisible();
});

test('penyaring aktif dapat dihapus satu per satu dan pencarian tanpa hasil memberi jalan keluar', async ({ asAdmin: page }) => {
	await page.goto('/app/admin/students?cari=tidak-ada-mahasiswa-ini');
	await expect(page.getByText('Tidak ada mahasiswa')).toBeVisible();
	await page.getByRole('link', { name: 'Atur ulang pencarian' }).click();
	await expect(page).not.toHaveURL(/cari=/);
	await expect(page.locator('tbody tr').first()).toBeVisible();
});

test('urutan kolom berganti naik dan turun dan ditandai untuk teknologi bantu', async ({ asAdmin: page }) => {
	await page.goto('/app/admin/students?urut=nim&arah=naik');
	const nimHeader = page.getByRole('columnheader', { name: /NIM/ });
	await expect(nimHeader).toHaveAttribute('aria-sort', 'ascending');
	const first = await page.locator('tbody tr').first().locator('td').first().innerText();
	await page.getByRole('link', { name: 'Urutkan menurut NIM' }).click();
	await expect(nimHeader).toHaveAttribute('aria-sort', 'descending');
	const firstDesc = await page.locator('tbody tr').first().locator('td').first().innerText();
	expect(firstDesc.trim() >= first.trim()).toBe(true);
});

test('paginasi bernomor, ringkasan rentang, dan pilihan jumlah baris menjaga pencarian dan urutan', async ({ asAdmin: page }) => {
	await page.goto('/app/admin/students?urut=nim&arah=naik');
	await page.getByRole('link', { name: '10 baris per halaman' }).click();
	await expect(page).toHaveURL(/ukuran=10/);
	await expect(page.locator('tbody tr')).toHaveCount(10);
	const nav = page.getByRole('navigation', { name: 'Navigasi halaman' });
	await expect(nav).toContainText(/Menampilkan 1–10 dari \d+/);
	await expect(nav.getByRole('button', { name: 'Halaman 1' }).or(nav.getByLabel('Halaman 1'))).toHaveAttribute('aria-current', 'page');
	await nav.getByRole('link', { name: 'Halaman 2' }).click();
	await expect(page).toHaveURL(/halaman=2/);
	await expect(page).toHaveURL(/urut=nim/);
	await expect(page).toHaveURL(/ukuran=10/);
	await expect(nav).toContainText(/Menampilkan 11–/);
	await nav.getByRole('link', { name: 'Halaman pertama' }).click();
	await expect(page).not.toHaveURL(/halaman=/);
});

test('halaman di luar jangkauan dipangkas ke halaman terakhir tanpa daftar kosong', async ({ asAdmin: page }) => {
	await page.goto('/app/admin/students?halaman=9999&ukuran=10');
	await expect(page.locator('tbody tr').first()).toBeVisible();
	await expect(page.getByRole('navigation', { name: 'Navigasi halaman' })).toContainText(/Menampilkan \d+–\d+ dari \d+/);
});
