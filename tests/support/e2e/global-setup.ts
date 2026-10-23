import { chromium } from '@playwright/test';
import { e2eOrigin, readState, storagePath } from './credentials.ts';

export default async function globalSetup() {
	const state = readState();
	const browser = await chromium.launch();
	const accounts = [
		['admin', state.admin, /\/app\/admin/],
		['lecturerA', state.lecturerA, /\/app\/lecturer/],
		['lecturerB', state.lecturerB, /\/app\/lecturer/]
	] as const;
	for (const [role, account, landing] of accounts) {
		const context = await browser.newContext({ baseURL: e2eOrigin, locale: 'id-ID' });
		const page = await context.newPage();
		await page.goto('/login');
		await page.getByLabel('Email').fill(account.email);
		await page.getByLabel('Password', { exact: true }).fill(account.password);
		await page.getByRole('button', { name: 'Masuk', exact: true }).click();
		await page.waitForURL(landing);
		await context.storageState({ path: storagePath(role) });
		await context.close();
	}
	await browser.close();
}
