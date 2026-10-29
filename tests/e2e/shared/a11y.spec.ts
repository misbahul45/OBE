import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { batchIdOf, saveSheet, uploadWorkbook, validate } from '../../support/e2e/imports.ts';
import { expect, test, workbooks } from '../../support/e2e/test.ts';

const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function audit(page: Page) {
	await page.waitForLoadState('networkidle');
	const results = await new AxeBuilder({ page }).withTags(tags).analyze();
	const summary = results.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 3).map((n) => `${n.target.join(' ')} :: ${n.any[0]?.message ?? n.failureSummary ?? ''}`.slice(0, 220)) }));
	expect(summary).toEqual([]);
}

async function firstHref(page: Page, listPath: string, linkName: string | RegExp) {
	await page.goto(listPath);
	const href = await page.getByRole('link', { name: linkName }).first().getAttribute('href');
	expect(href).toBeTruthy();
	return href as string;
}

const schemes = ['light', 'dark'] as const;

for (const scheme of schemes) {
	test.describe(`aksesibilitas ${scheme} @a11y`, () => {
		test.use({ colorScheme: scheme });

		test('halaman publik', async ({ anonymous: page }) => {
			await page.emulateMedia({ colorScheme: scheme });
			for (const path of ['/', '/login']) {
				await page.goto(path);
				await audit(page);
			}
		});

		test('halaman Super Admin', async ({ asAdmin: page, state }) => {
			test.setTimeout(150_000);
			await page.emulateMedia({ colorScheme: scheme });
			const paths = ['/app/admin', '/app/admin/terms', '/app/admin/courses', '/app/admin/lecturers', '/app/admin/offerings', `/app/admin/offerings/${state.ids.offeringA}`, '/app/admin/curriculum', `/app/admin/curriculum/${state.ids.courseA}`, '/app/admin/students', '/app/admin/tracer', '/app/admin/imports', '/app/admin/audit', '/app/admin/cqi', '/app/admin/reports', '/app/account/password', '/app/account/profile'];
			for (const path of paths) {
				await page.goto(path);
				await audit(page);
			}
		});

		test('halaman dosen', async ({ asLecturerA: page, state }) => {
			await page.emulateMedia({ colorScheme: scheme });
			const paths = ['/app/lecturer', '/app/lecturer/courses', `/app/lecturer/courses/${state.ids.offeringA}`, '/app/lecturer/import', '/app/lecturer/imports', '/app/lecturer/cqi', '/app/account/profile'];
			for (const path of paths) {
				await page.goto(path);
				await audit(page);
			}
		});

		test('profil mahasiswa, detail CQI, dan laporan impor', async ({ asAdmin: page }) => {
			await page.emulateMedia({ colorScheme: scheme });
			const student = await firstHref(page, '/app/admin/students', /Mahasiswa Uji/);
			await page.goto(student);
			await audit(page);
			await page.getByRole('tab', { name: /Mata kuliah/ }).click();
			await page.locator('[data-enrollment] summary').first().click();
			await audit(page);
			await page.getByRole('tab', { name: /Riwayat perubahan/ }).click();
			await audit(page);

			const cqi = await firstHref(page, '/app/admin/cqi', 'Buka');
			await page.goto(cqi);
			await audit(page);

			const report = await firstHref(page, '/app/admin/imports', 'Lihat laporan');
			await page.goto(report);
			await audit(page);
		});

		test('wizard impor pada tiap tahap', async ({ asLecturerA: page }) => {
			await page.emulateMedia({ colorScheme: scheme });
			await uploadWorkbook(page, workbooks.semesterChanged);
			await expect(page).toHaveURL(/\/app\/lecturer\/imports\/[0-9a-f-]{36}/);
			expect(batchIdOf(page.url())).not.toBe('');
			await audit(page);
			await page.locator('[data-sheet="Mata Kuliah Uji A"] summary', { hasText: 'Header dan pemetaan kolom' }).click();
			await page.locator('[data-sheet="Mata Kuliah Uji A"] summary', { hasText: 'Pratinjau berkas' }).click();
			await audit(page);
			await saveSheet(page, 'Mata Kuliah Uji A', { acknowledgeNumeric: true });
			await saveSheet(page, 'Kelas Uji B T1', { include: false });
			await validate(page);
			await page.locator('[data-testid="dry-run-result"] summary').first().click();
			await audit(page);
		});
	});
}
