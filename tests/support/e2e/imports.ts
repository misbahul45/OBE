import { expect, type Locator, type Page } from '@playwright/test';

export async function uploadWorkbook(page: Page, path: string, entry = '/app/lecturer/import') {
	await page.goto(entry);
	await page.getByLabel('Berkas Excel atau CSV').setInputFiles(path);
	await page.getByRole('button', { name: 'Unggah dan periksa' }).click();
}

export const sheetCard = (page: Page, name: string): Locator => page.locator(`[data-sheet="${name}"]`);

export function stat(scope: Locator | Page, label: string): Locator {
	return scope.locator('dl > div').filter({ hasText: new RegExp(`^${label}\\s*\\d`) }).locator('dd');
}

export async function saveSheet(page: Page, name: string, options: { include?: boolean; acknowledgeNumeric?: boolean; offeringLabel?: string }) {
	const card = sheetCard(page, name);
	if (options.offeringLabel) await card.getByLabel('Kelas tujuan').selectOption({ label: options.offeringLabel });
	if (options.include !== undefined) await card.getByLabel('Sertakan sheet ini dalam impor').setChecked(options.include);
	if (options.acknowledgeNumeric !== undefined) await card.getByLabel(/NIM pada sheet ini tersimpan sebagai angka/).setChecked(options.acknowledgeNumeric);
	await card.getByRole('button', { name: 'Simpan pengaturan sheet' }).click();
	await expect(card.getByText(`Pengaturan sheet "${name}" disimpan.`)).toBeVisible();
}

export async function validate(page: Page) {
	await page.getByRole('button', { name: 'Jalankan validasi' }).click();
	await expect(page.getByTestId('dry-run-result')).toBeVisible();
}

export async function commitAndWaitReport(page: Page) {
	await page.getByRole('button', { name: 'Simpan ke database' }).click();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Ya, simpan' }).click();
	await expect(page.getByTestId('batch-report')).toBeVisible();
	await expect(page.getByText('Impor tersimpan')).toBeVisible();
}

export const batchIdOf = (url: string) => /\/imports\/([0-9a-f-]{36})/.exec(url)?.[1] ?? '';
