import type { Page } from '@playwright/test';
import { expect, test, workbooks } from '../../support/e2e/test.ts';
import { uploadWorkbook } from '../../support/e2e/imports.ts';

async function expectNoHorizontalOverflow(page: Page, label: string) {
	await page.waitForLoadState('networkidle');
	const widths = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
	expect(widths.document, `${label}: lebar dokumen ${widths.document} melebihi viewport ${widths.viewport}`).toBeLessThanOrEqual(widths.viewport);
}

test.describe('responsif ponsel @responsive', () => {
	test('halaman publik tidak meluap secara horizontal', async ({ anonymous: page }) => {
		for (const path of ['/', '/login']) {
			await page.goto(path);
			await expectNoHorizontalOverflow(page, path);
		}
		await page.goto('/');
		await expect(page.locator('h1')).toBeVisible();
		await expect(page.getByRole('link', { name: 'Masuk ke sistem' })).toBeVisible();
	});

	test('halaman Super Admin tidak meluap dan navigasi dapat dibuka', async ({ asAdmin: page, state }) => {
		const paths = ['/app/admin', '/app/admin/courses', '/app/admin/lecturers', '/app/admin/offerings', `/app/admin/offerings/${state.ids.offeringA}`, '/app/admin/curriculum', '/app/admin/students', '/app/admin/imports', '/app/admin/audit', '/app/admin/cqi', '/app/admin/reports'];
		for (const path of paths) {
			await page.goto(path);
			await expectNoHorizontalOverflow(page, path);
		}
		await page.goto('/app/admin');
		await page.getByRole('button', { name: 'Buka atau tutup navigasi' }).click();
		await expect(page.getByRole('link', { name: 'Mahasiswa' })).toBeVisible();
	});

	test('halaman dosen termasuk kelas dan wizard impor tidak meluap', async ({ asLecturerA: page, state }) => {
		const paths = ['/app/lecturer', '/app/lecturer/courses', `/app/lecturer/courses/${state.ids.offeringA}`, '/app/lecturer/import', '/app/lecturer/imports', '/app/lecturer/cqi'];
		for (const path of paths) {
			await page.goto(path);
			await expectNoHorizontalOverflow(page, path);
		}
		await uploadWorkbook(page, workbooks.semesterChanged);
		await expect(page).toHaveURL(/\/app\/lecturer\/imports\/[0-9a-f-]{36}/);
		await expectNoHorizontalOverflow(page, 'wizard impor');
	});

	test('profil mahasiswa tidak meluap di ponsel', async ({ asAdmin: page }) => {
		await page.goto('/app/admin/students');
		const href = await page.getByRole('link', { name: /Mahasiswa Uji/ }).first().getAttribute('href');
		await page.goto(href as string);
		await expectNoHorizontalOverflow(page, 'profil mahasiswa');
		await page.getByRole('tab', { name: /Mata kuliah/ }).click();
		await expectNoHorizontalOverflow(page, 'profil mahasiswa tab mata kuliah');
	});
});
