import { resolve } from 'node:path';
import { test as base, expect, type Browser, type Page, type TestInfo } from '@playwright/test';
import { e2eOrigin, readState, storagePath, type E2eState } from './credentials.ts';

type Fixtures = { state: E2eState; asAdmin: Page; asLecturerA: Page; asLecturerB: Page; anonymous: Page };

export const workbook = (name: string) => resolve(process.cwd(), 'tests/fixtures/workbooks', name);

export const workbooks = {
	semester: workbook('semester-1-multi-sheet.synthetic.xlsx'),
	semesterChanged: workbook('semester-1-multi-sheet-changed.synthetic.xlsx'),
	automap: workbook('automap.synthetic.xlsx'),
	corrupt: workbook('invalid-corrupt.xlsx'),
	noStudentId: workbook('invalid-no-student-id.xlsx')
};

async function openPage(browser: Browser, testInfo: TestInfo, role?: 'admin' | 'lecturerA' | 'lecturerB') {
	const use = testInfo.project.use;
	const context = await browser.newContext({
		storageState: role ? storagePath(role) : undefined,
		baseURL: e2eOrigin,
		locale: 'id-ID',
		viewport: use.viewport ?? undefined,
		userAgent: use.userAgent,
		deviceScaleFactor: use.deviceScaleFactor,
		isMobile: use.isMobile,
		hasTouch: use.hasTouch
	});
	return { context, page: await context.newPage() };
}

export const test = base.extend<Fixtures>({
	state: async ({}, use) => {
		await use(readState());
	},
	asAdmin: async ({ browser }, use, testInfo) => {
		const { context, page } = await openPage(browser, testInfo, 'admin');
		await use(page);
		await context.close();
	},
	asLecturerA: async ({ browser }, use, testInfo) => {
		const { context, page } = await openPage(browser, testInfo, 'lecturerA');
		await use(page);
		await context.close();
	},
	asLecturerB: async ({ browser }, use, testInfo) => {
		const { context, page } = await openPage(browser, testInfo, 'lecturerB');
		await use(page);
		await context.close();
	},
	anonymous: async ({ browser }, use, testInfo) => {
		const { context, page } = await openPage(browser, testInfo);
		await use(page);
		await context.close();
	}
});

export { expect };
