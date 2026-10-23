import { expect, test } from '../../support/e2e/test.ts';

test.describe('profil akun', () => {
	test('Super Admin melihat identitas, peran, dan tautan keamanan', async ({ asAdmin: page, state }) => {
		await page.goto('/app/account/profile');
		await expect(page.getByRole('heading', { level: 1, name: 'Profil akun' })).toBeVisible();
		await expect(page.locator('[data-profile="email"]')).toHaveText(state.admin.email);
		await expect(page.locator('[data-profile="role"]')).toHaveText('Super Admin / Kaprodi');
		await expect(page.getByRole('link', { name: 'Ganti password' })).toHaveAttribute('href', '/app/account/password');
		await expect(page.getByText('Kelas aktif semester ini')).toHaveCount(0);
	});

	test('dosen melihat kode dosen dan jumlah kelas aktif', async ({ asLecturerA: page, state }) => {
		await page.goto('/app/account/profile');
		await expect(page.locator('[data-profile="email"]')).toHaveText(state.lecturerA.email);
		await expect(page.locator('[data-profile="role"]')).toHaveText('Dosen');
		await expect(page.getByText('Kelas aktif semester ini')).toBeVisible();
		await expect(page.getByRole('link', { name: /\d+ kelas/ })).toHaveAttribute('href', '/app/lecturer/courses');
	});

	test('mengubah nama tampilan menyimpan, menampilkan pesan, lalu dikembalikan', async ({ asAdmin: page }) => {
		await page.goto('/app/account/profile');
		const field = page.getByLabel('Nama tampilan');
		await expect(field).not.toHaveValue('');
		const original = await field.inputValue();
		await field.fill('Admin   Uji   Profil');
		await page.getByRole('button', { name: 'Simpan nama' }).click();
		await expect(page.getByText('Nama tampilan disimpan.')).toBeVisible();
		await expect(field).toHaveValue('Admin Uji Profil');
		await expect(page.getByRole('link', { name: /Profil akun Admin Uji Profil/ })).toBeVisible();
		await field.fill(original);
		await page.getByRole('button', { name: 'Simpan nama' }).click();
		await expect(page.getByText('Nama tampilan disimpan.')).toBeVisible();
	});

	test('nama kosong ditolak dengan pesan per bidang', async ({ asAdmin: page }) => {
		await page.goto('/app/account/profile');
		const field = page.getByLabel('Nama tampilan');
		await field.fill(' ');
		await page.getByRole('button', { name: 'Simpan nama' }).click();
		await expect(page.getByRole('alert').filter({ hasText: 'Nama minimal 2 karakter' })).toBeVisible();
	});

	test('tautan profil di sidebar membuka halaman profil dan tamu dialihkan ke login', async ({ asLecturerA: page, anonymous }) => {
		await page.goto('/app/lecturer');
		await page.getByRole('link', { name: /^Profil akun/ }).click();
		await expect(page).toHaveURL(/\/app\/account\/profile$/);
		await anonymous.goto('/app/account/profile');
		await expect(anonymous).toHaveURL(/\/login\?next=%2Fapp%2Faccount%2Fprofile$/);
	});

	test('kolom nama sudah terisi pada HTML pertama tanpa menunggu JavaScript', async ({ asAdmin: page }) => {
		const response = await page.request.get('/app/account/profile');
		const html = await response.text();
		expect(html).toMatch(/id="profile-name"[^>]*value="[^"]+"|value="[^"]+"[^>]*id="profile-name"/);
	});
});
