import { expect, test } from '../../support/e2e/test.ts';

test.describe('toggle tema', () => {
	test('shell aplikasi: toggle di header mengganti tema dan bertahan antarhalaman', async ({ asAdmin: page }) => {
		await page.emulateMedia({ colorScheme: 'light' });
		await page.goto('/app/admin');
		const html = page.locator('html');
		await expect(html).not.toHaveClass(/dark/);
		await page.getByRole('button', { name: 'Ganti ke tema gelap' }).click();
		await expect(html).toHaveClass(/dark/);
		await expect(page.locator('[data-sidebar="sidebar"]').first()).toHaveCSS('background-color', 'rgb(15, 23, 42)');
		await page.goto('/app/admin/terms');
		await expect(html).toHaveClass(/dark/);
		await expect(page.getByRole('button', { name: 'Ganti ke tema terang' })).toBeVisible();
	});

	test('login: toggle tersedia dan tema gelap terpilih tidak berkedip kembali ke terang', async ({ anonymous: page }) => {
		await page.emulateMedia({ colorScheme: 'light' });
		await page.goto('/login');
		await page.getByRole('button', { name: 'Ganti ke tema gelap' }).click();
		await page.reload();
		await expect(page.locator('html')).toHaveClass(/dark/);
		await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(11, 18, 32)');
	});

	test('pilihan Ikuti sistem mengikuti preferensi perangkat dan menghapus pilihan tersimpan', async ({ asAdmin: page }) => {
		await page.emulateMedia({ colorScheme: 'dark' });
		await page.goto('/app/account/profile');
		const html = page.locator('html');
		await expect(html).toHaveClass(/dark/);
		await page.locator('label', { hasText: 'Terang' }).click();
		await expect(page.getByRole('radio', { name: 'Terang' })).toBeChecked();
		await expect(html).not.toHaveClass(/dark/);
		expect(await page.evaluate(() => localStorage.getItem('obe-theme'))).toBe('light');
		await page.locator('label', { hasText: 'Ikuti sistem' }).click();
		await expect(page.getByRole('radio', { name: 'Ikuti sistem' })).toBeChecked();
		await expect(html).toHaveClass(/dark/);
		expect(await page.evaluate(() => localStorage.getItem('obe-theme'))).toBeNull();
	});
});
