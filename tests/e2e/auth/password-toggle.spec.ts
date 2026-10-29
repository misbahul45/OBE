import { expect, test } from '../../support/e2e/test.ts';

test.describe('tombol tampilkan password pada formulir masuk', () => {
	test('menampilkan dan menyembunyikan tanpa kehilangan nilai, fokus, atau posisi kursor', async ({ anonymous: page }) => {
		await page.goto('/login');
		await page.waitForLoadState('networkidle');
		const input = page.locator('#password');
		const toggle = page.getByRole('button', { name: 'Tampilkan password' });
		await input.fill('Rahasia123!');
		await input.evaluate((el: HTMLInputElement) => el.setSelectionRange(3, 3));
		await expect(input).toHaveAttribute('type', 'password');
		await expect(toggle).toHaveAttribute('aria-pressed', 'false');

		await toggle.click();
		await expect(input).toHaveAttribute('type', 'text');
		await expect(input).toHaveValue('Rahasia123!');
		await expect(input).toBeFocused();
		expect(await input.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd])).toEqual([3, 3]);
		await expect(toggle).toHaveAttribute('aria-pressed', 'true');

		await toggle.click();
		await expect(input).toHaveAttribute('type', 'password');
		await expect(input).toHaveValue('Rahasia123!');
		await expect(input).toBeFocused();
		await expect(toggle).toHaveAttribute('aria-pressed', 'false');
	});

	test('nama aksesibel tombol tetap sama sehingga pembaca layar tidak membaca status ganda', async ({ anonymous: page }) => {
		await page.goto('/login');
		await page.waitForLoadState('networkidle');
		const toggle = page.getByRole('button', { name: 'Tampilkan password' });
		await toggle.click();
		await expect(page.getByRole('button', { name: 'Tampilkan password' })).toHaveAttribute('aria-pressed', 'true');
		await expect(page.getByRole('button', { name: 'Sembunyikan password' })).toHaveCount(0);
	});

	test('setelah masuk gagal kata sandi kembali tersembunyi dan isiannya tetap ada', async ({ anonymous: page }) => {
		await page.goto('/login');
		await page.waitForLoadState('networkidle');
		await page.locator('#email').fill('salah@contoh.invalid');
		await page.locator('#password').fill('KataSandiSalah1!');
		await page.getByRole('button', { name: 'Tampilkan password' }).click();
		await expect(page.locator('#password')).toHaveAttribute('type', 'text');
		await page.getByRole('button', { name: 'Masuk' }).click();
		await expect(page.getByRole('alert').first()).toBeVisible();
		await expect(page.locator('#password')).toHaveAttribute('type', 'password');
		await expect(page.getByRole('button', { name: 'Tampilkan password' })).toHaveAttribute('aria-pressed', 'false');
		await expect(page.locator('#password')).toHaveValue('KataSandiSalah1!');
	});
});
