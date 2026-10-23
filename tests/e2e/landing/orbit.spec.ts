import type { Page } from '@playwright/test';
import { expect, test } from '../../support/e2e/test.ts';

const nodeButton = (page: Page, label: string) => page.getByRole('button', { name: new RegExp(`^${label}, tahap`) });
const arcState = (page: Page, from: string) => page.locator(`[data-orbit-paths] .orbit-arc[data-from="${from}"]`);

async function gotoLoop(page: Page) {
	await page.goto('/');
	const stage = page.locator('[data-orbit-stage]');
	await stage.scrollIntoViewIfNeeded();
	await expect(stage).toBeVisible();
	await expect(stage.locator('xpath=ancestor::*[@data-reveal][1]')).toHaveCSS('opacity', '1');
}

test.describe('diagram siklus OBE', () => {
	test('keadaan awal seimbang: hub OBE terlihat, tidak ada simpul terpilih, panel menampilkan ikhtisar', async ({ anonymous: page }) => {
		await gotoLoop(page);
		await expect(page.locator('[data-orbit-hub]')).toContainText('OBE');
		await expect(page.locator('[data-orbit-hub]')).toContainText('Outcome-Based Education');
		for (const label of ['Mata Kuliah', 'CPMK', 'CPL', 'CQI']) await expect(nodeButton(page, label)).toHaveAttribute('aria-pressed', 'false');
		await expect(page.locator('[data-orbit-panel-title]')).toHaveText('Satu siklus, empat tahap');
		await expect(page.locator('[data-orbit-feedback]')).toHaveText('Umpan balik perbaikan');
		await expect(page.locator('[data-orbit-paths] .arc-arrow')).toHaveCount(4);
	});

	test('klik memilih simpul, memperbarui panel, dan pilihan bertahan setelah penunjuk pergi', async ({ anonymous: page }) => {
		await gotoLoop(page);
		const cpl = nodeButton(page, 'CPL');
		await cpl.click();
		await expect(cpl).toHaveAttribute('aria-pressed', 'true');
		await expect(page.locator('[data-orbit-panel-title]')).toHaveText('CPL');
		await expect(page.locator('[data-orbit-panel]')).toContainText('Capaian Pembelajaran Lulusan');
		await expect(page.locator('[data-orbit-panel]')).toContainText('Tahap 3 dari 4');
		await page.mouse.move(5, 5);
		await expect(cpl).toHaveAttribute('aria-pressed', 'true');
		await expect(arcState(page, 'cpl')).toHaveAttribute('data-state', 'outgoing');

		await nodeButton(page, 'CPMK').click();
		await expect(nodeButton(page, 'CPMK')).toHaveAttribute('aria-pressed', 'true');
		await expect(cpl).toHaveAttribute('aria-pressed', 'false');
		await expect(page.locator('[data-orbit-panel-title]')).toHaveText('CPMK');
		await expect(page.locator('[data-orbit-panel]')).toContainText('Capaian Pembelajaran Mata Kuliah');

		await nodeButton(page, 'CQI').click();
		await expect(page.locator('[data-orbit-panel]')).toContainText('Continuous Quality Improvement');
		await nodeButton(page, 'Mata Kuliah').click();
		await expect(page.locator('[data-orbit-panel-title]')).toHaveText('Mata Kuliah');
	});

	test('klik berulang pada simpul yang sama kembali ke ikhtisar tanpa merusak komponen', async ({ anonymous: page }) => {
		await gotoLoop(page);
		const cqi = nodeButton(page, 'CQI');
		for (let i = 0; i < 4; i++) {
			await cqi.click();
			await expect(cqi).toHaveAttribute('aria-pressed', i % 2 === 0 ? 'true' : 'false');
		}
		await expect(page.locator('[data-orbit-panel-title]')).toHaveText('Satu siklus, empat tahap');
	});

	test('hover menyorot busur keluar dan masuk, lalu kembali netral', async ({ anonymous: page }) => {
		await gotoLoop(page);
		await nodeButton(page, 'CPMK').hover();
		await expect(arcState(page, 'cpmk')).toHaveAttribute('data-state', 'outgoing');
		await expect(arcState(page, 'mk')).toHaveAttribute('data-state', 'incoming');
		await expect(arcState(page, 'cpl')).toHaveAttribute('data-state', 'idle');
		await page.mouse.move(5, 5);
		await expect(arcState(page, 'cpmk')).toHaveAttribute('data-state', 'idle');
	});

	test('papan ketik: fokus terlihat, panah memindahkan fokus, Enter memilih, Esc membatalkan', async ({ anonymous: page }) => {
		await gotoLoop(page);
		const first = nodeButton(page, 'Mata Kuliah');
		await first.focus();
		await expect(first).toBeFocused();
		await expect(arcState(page, 'mk')).toHaveAttribute('data-state', 'outgoing');
		await page.keyboard.press('ArrowRight');
		await expect(nodeButton(page, 'CPMK')).toBeFocused();
		await page.keyboard.press('ArrowDown');
		await expect(nodeButton(page, 'CPL')).toBeFocused();
		await page.keyboard.press('ArrowLeft');
		await expect(nodeButton(page, 'CPMK')).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(nodeButton(page, 'CPMK')).toHaveAttribute('aria-pressed', 'true');
		await page.keyboard.press('Space');
		await expect(nodeButton(page, 'CPMK')).toHaveAttribute('aria-pressed', 'false');
		await page.keyboard.press('Enter');
		await page.keyboard.press('Escape');
		await expect(nodeButton(page, 'CPMK')).toHaveAttribute('aria-pressed', 'false');
		await expect(page.locator('[data-orbit-panel-title]')).toHaveText('Satu siklus, empat tahap');
		await page.keyboard.press('ArrowLeft');
		await expect(first).toBeFocused();
		await page.keyboard.press('ArrowLeft');
		await expect(nodeButton(page, 'CQI')).toBeFocused();
	});

	test('fokus papan ketik memiliki indikator ring yang terlihat', async ({ anonymous: page }) => {
		await gotoLoop(page);
		const button = nodeButton(page, 'CPL');
		const before = await button.evaluate((node) => getComputedStyle(node).boxShadow);
		await page.keyboard.press('Tab');
		await button.focus();
		await expect(button).toBeFocused();
		const after = await button.evaluate((node) => getComputedStyle(node).boxShadow);
		expect(after).not.toBe('none');
		expect(after).not.toBe(before);
	});

	test('nama aksesibel tiap simpul memuat urutan dan arah, dan panel diumumkan secara sopan', async ({ anonymous: page }) => {
		await gotoLoop(page);
		await expect(nodeButton(page, 'Mata Kuliah')).toHaveAccessibleName('Mata Kuliah, tahap 1 dari 4, mengalir ke CPMK');
		await expect(nodeButton(page, 'CPMK')).toHaveAccessibleName('CPMK, tahap 2 dari 4, mengalir ke CPL');
		await expect(nodeButton(page, 'CPL')).toHaveAccessibleName('CPL, tahap 3 dari 4, mengalir ke CQI');
		await expect(nodeButton(page, 'CQI')).toHaveAccessibleName('CQI, tahap 4 dari 4, mengalir ke Mata Kuliah');
		await expect(page.locator('[data-orbit-panel]')).toHaveAttribute('aria-live', 'polite');
		await expect(page.getByRole('group', { name: 'Alur Outcome-Based Education' })).toHaveAccessibleDescription(/Siklus empat tahap yang berulang/);
	});

	test('gerakan dikurangi: tanpa tracer dan animasi, arah tetap terlihat lewat panah, interaksi tetap berfungsi', async ({ browser }) => {
		const context = await browser.newContext({ reducedMotion: 'reduce', baseURL: 'http://127.0.0.1:4173' });
		const page = await context.newPage();
		await gotoLoop(page);
		await expect(page.locator('[data-orbit-paths] .tracer')).toBeHidden();
		await expect(page.locator('[data-orbit-paths] .arc-arrow').first()).toBeVisible();
		await expect(arcState(page, 'mk')).toHaveCSS('animation-name', 'none');
		await nodeButton(page, 'CPL').click();
		await expect(page.locator('[data-orbit-panel-title]')).toHaveText('CPL');
		await expect(arcState(page, 'cpl')).toHaveAttribute('data-state', 'outgoing');
		await context.close();
	});

	test('gerakan normal: tracer berjalan dan simpul tidak bergerak', async ({ anonymous: page }) => {
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await gotoLoop(page);
		const before = await nodeButton(page, 'CPL').boundingBox();
		const tracer = page.locator('[data-orbit-paths] .tracer');
		await expect(tracer).toBeVisible();
		const first = await tracer.evaluate((node) => (node as SVGGElement).getBoundingClientRect().x);
		await page.waitForTimeout(1500);
		const second = await tracer.evaluate((node) => (node as SVGGElement).getBoundingClientRect().x);
		expect(Math.abs(second - first)).toBeGreaterThan(1);
		const after = (await nodeButton(page, 'CPL').boundingBox())!;
		for (const key of ['x', 'y', 'width', 'height'] as const) expect(after[key]).toBeCloseTo(before![key], 1);
	});
});

const viewports = [
	{ name: 'desktop besar', width: 1920, height: 1080 },
	{ name: 'desktop', width: 1366, height: 768 },
	{ name: 'tablet', width: 820, height: 1180 },
	{ name: 'ponsel', width: 390, height: 844 },
	{ name: 'ponsel sangat sempit', width: 320, height: 640 }
];

for (const viewport of viewports) {
	test(`tata letak diagram pada ${viewport.name} (${viewport.width}px)`, async ({ anonymous: page }) => {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		await gotoLoop(page);
		const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
		expect(overflow).toBeLessThanOrEqual(0);

		const stage = (await page.locator('[data-orbit-stage]').boundingBox())!;
		expect(Math.abs(stage.width - stage.height)).toBeLessThan(1.5);
		const centers: { x: number; y: number; size: number }[] = [];
		for (const label of ['Mata Kuliah', 'CPMK', 'CPL', 'CQI']) {
			const button = nodeButton(page, label);
			const box = (await button.boundingBox())!;
			expect(box.width, label).toBeGreaterThanOrEqual(viewport.width <= 320 ? 48 : 52);
			expect(Math.abs(box.width - box.height)).toBeLessThan(1.5);
			centers.push({ x: box.x + box.width / 2, y: box.y + box.height / 2, size: box.width });
			const clipped = await button.evaluate((node) => {
				const text = node.querySelector('span:not(.sr-only):not([aria-hidden])') as HTMLElement;
				const inner = node.getBoundingClientRect();
				const rect = text.getBoundingClientRect();
				return rect.left < inner.left || rect.right > inner.right || rect.top < inner.top || rect.bottom > inner.bottom;
			});
			expect(clipped, `${label} terpotong`).toBe(false);
		}
		const cx = stage.x + stage.width / 2;
		const cy = stage.y + stage.height / 2;
		const radii = centers.map((c) => Math.hypot(c.x - cx, c.y - cy));
		for (const r of radii) expect(Math.abs(r - radii[0])).toBeLessThan(1.5);
		for (let i = 0; i < centers.length; i++)
			for (let j = i + 1; j < centers.length; j++) expect(Math.hypot(centers[i].x - centers[j].x, centers[i].y - centers[j].y)).toBeGreaterThan((centers[i].size + centers[j].size) / 2 + 4);

		const hub = (await page.locator('[data-orbit-hub]').boundingBox())!;
		expect(Math.abs(hub.x + hub.width / 2 - cx)).toBeLessThan(1.5);
		await expect(page.locator('[data-orbit-hub]')).toContainText('OBE');
		const hubOverflow = await page.locator('[data-orbit-hub]').evaluate((node) => {
			const inner = node.firstElementChild as HTMLElement;
			return inner.getBoundingClientRect().width > node.getBoundingClientRect().width || inner.getBoundingClientRect().height > node.getBoundingClientRect().height;
		});
		expect(hubOverflow).toBe(false);

		const panel = (await page.locator('[data-orbit-panel]').boundingBox())!;
		const separated = panel.y >= stage.y + stage.height - 1 || panel.x >= stage.x + stage.width - 1;
		expect(separated).toBe(true);
		await nodeButton(page, 'CQI').click();
		const stageAfter = (await page.locator('[data-orbit-stage]').boundingBox())!;
		for (const key of ['x', 'y', 'width', 'height'] as const) expect(stageAfter[key]).toBeCloseTo(stage[key], 1);
	});
}

test('tidak ada galat konsol saat berinteraksi dengan diagram', async ({ anonymous: page }) => {
	const errors: string[] = [];
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(message.text());
	});
	page.on('pageerror', (error) => errors.push(error.message));
	await gotoLoop(page);
	for (const label of ['Mata Kuliah', 'CPMK', 'CPL', 'CQI']) await nodeButton(page, label).click();
	await page.keyboard.press('Escape');
	expect(errors).toEqual([]);
});
