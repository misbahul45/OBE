import { batchIdOf, sheetCard, uploadWorkbook } from '../../support/e2e/imports.ts';
import { expect, test, workbooks } from '../../support/e2e/test.ts';

test.describe.configure({ mode: 'serial' });

test('Super Admin memetakan sheet secara otomatis dan kelas yang belum ada dibuka', async ({ asAdmin: page }) => {
	await uploadWorkbook(page, workbooks.automap, '/app/admin/imports');
	await expect(page).toHaveURL(/\/app\/admin\/imports\/[0-9a-f-]{36}/);
	const batchId = batchIdOf(page.url());

	const card = sheetCard(page, 'Mata Kuliah Uji C T2');
	await expect(card.getByLabel('Kelas tujuan')).toHaveValue('');
	await expect(page.getByText('1 dari 1 sheet belum dipetakan ke kelas')).toBeVisible();
	await expect(page.getByText('Kelas yang belum dibuka akan dibuatkan.')).toBeVisible();

	await page.getByRole('button', { name: 'Petakan otomatis' }).click();
	await expect(page.getByText(/1 sheet dipetakan ke .*, 1 kelas baru dibuka/).first()).toBeVisible();
	await expect(card.getByLabel('Kelas tujuan')).not.toHaveValue('');
	await expect(card.getByLabel('Kelas tujuan').locator('option:checked')).toHaveText('E2EX · Mata Kuliah Uji C — Kelas T2');
	await expect(page.getByRole('button', { name: 'Petakan otomatis' })).toHaveCount(0);

	await page.goto('/app/admin/offerings');
	await expect(page.getByRole('row', { name: /E2EX.*T2/ })).toBeVisible();

	await page.goto(`/app/admin/imports/${batchId}`);
	await page.getByRole('button', { name: 'Batalkan impor ini' }).click();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Batalkan impor', exact: true }).click();
	await expect(page).toHaveURL(/dibatalkan=1/);
});

test('dosen tidak dapat membuka kelas dan sheet di luar penugasannya tidak dipetakan', async ({ asLecturerA: page }) => {
	await uploadWorkbook(page, workbooks.automap);
	await expect(page).toHaveURL(/\/app\/lecturer\/imports\/[0-9a-f-]{36}/);
	await expect(page.getByText('Hanya kelas yang ditugaskan kepada Anda yang dapat dipetakan.')).toBeVisible();
	await page.getByRole('button', { name: 'Petakan otomatis' }).click();
	await expect(page.getByText(/0 sheet dipetakan.*1 sheet perlu dipetakan manual/).first()).toBeVisible();
	await expect(page.getByText(/Anda tidak ditugaskan pada Mata Kuliah Uji C kelas T2/)).toBeVisible();
	await page.getByRole('button', { name: 'Batalkan impor ini' }).click();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Batalkan impor', exact: true }).click();
	await expect(page).toHaveURL(/dibatalkan=1/);
});
