import type { Page } from '@playwright/test';
import { expect, test } from '../../support/e2e/test.ts';

const rgb = (r: number, g: number, b: number) => `rgb(${r}, ${g}, ${b})`;
const palette = {
	white: rgb(255, 255, 255),
	foreground: rgb(15, 23, 42),
	primary: rgb(37, 99, 235),
	primaryHover: rgb(29, 78, 216),
	primarySoft: rgb(239, 246, 255),
	border: rgb(226, 232, 240),
	inputBorder: rgb(203, 213, 225),
	ring: rgb(59, 130, 246),
	destructiveText: rgb(185, 28, 28),
	successText: rgb(21, 128, 61),
	darkBackground: rgb(11, 18, 32),
	darkPrimary: rgb(59, 130, 246)
};

function watchProblems(page: Page) {
	const problems: string[] = [];
	page.on('console', (message) => {
		if (message.type() === 'error') problems.push(`console: ${message.text().slice(0, 140)}`);
	});
	page.on('requestfailed', (request) => {
		if (request.failure()?.errorText !== 'net::ERR_ABORTED') problems.push(`gagal: ${request.url().slice(0, 100)}`);
	});
	page.on('response', (response) => {
		if (response.status() >= 400 && !response.url().includes('/api/auth/')) problems.push(`${response.status()}: ${response.url().slice(0, 100)}`);
	});
	return problems;
}

test.describe('tema Blue-White', () => {
	test('landing: latar putih, teks utama gelap, tombol utama biru dengan hover lebih gelap', async ({ anonymous: page }) => {
		const problems = watchProblems(page);
		await page.goto('/');
		await expect(page.locator('body')).toHaveCSS('background-color', palette.white);
		await expect(page.locator('h1')).toHaveCSS('color', palette.foreground);
		const cta = page.getByRole('link', { name: 'Masuk ke sistem' });
		await expect(cta).toHaveCSS('background-color', palette.primary);
		await expect(cta).toHaveCSS('color', palette.white);
		await cta.hover();
		await expect(cta).toHaveCSS('background-color', palette.primaryHover);
		await page.waitForLoadState('networkidle');
		expect(problems).toEqual([]);
	});

	test('login: batas input, fokus biru terlihat, dan galat memakai warna semantik merah', async ({ anonymous: page }) => {
		const problems = watchProblems(page);
		await page.goto('/login');
		const email = page.getByLabel('Email');
		await expect(email).toHaveCSS('border-top-color', palette.inputBorder);
		await email.focus();
		await expect(email).toHaveCSS('border-top-color', palette.ring);
		await expect(email).toHaveCSS('box-shadow', /(rgba\(59, 130, 246, 0\.5\)|oklab\([^)]*\/ 0\.5\)) 0px 0px 0px 3px/);
		await expect(page.getByRole('button', { name: 'Masuk', exact: true })).toHaveCSS('background-color', palette.primary);
		await email.fill('tidak-valid');
		await page.getByLabel('Password', { exact: true }).fill('x');
		await page.getByRole('button', { name: 'Masuk', exact: true }).click();
		const error = page.getByRole('alert').first();
		await expect(error).toBeVisible();
		await expect(error).toHaveCSS('color', rgb(220, 38, 38));
		await expect(email).toHaveCSS('border-top-color', rgb(220, 38, 38));
		expect(problems.filter((p) => !p.startsWith('400') && !p.startsWith('401') && !p.startsWith('console: Failed to load resource'))).toEqual([]);
	});

	test('shell aplikasi: sidebar putih, navigasi aktif biru lembut, kartu putih berbatas halus', async ({ asAdmin: page }) => {
		const problems = watchProblems(page);
		await page.goto('/app/admin');
		await expect(page.locator('[data-sidebar="sidebar"]').first()).toHaveCSS('background-color', palette.white);
		const active = page.locator('[data-sidebar="menu-button"][data-active="true"]').first();
		await expect(active).toHaveCSS('background-color', palette.primarySoft);
		await expect(active).toHaveCSS('color', palette.primary);
		const card = page.locator('dl > div').first();
		await expect(card).toHaveCSS('background-color', palette.white);
		await expect(card).toHaveCSS('border-top-color', palette.border);
		await expect(page.locator('main, body').first()).toHaveCSS('background-color', palette.white);
		await page.waitForLoadState('networkidle');
		expect(problems).toEqual([]);
	});

	test('status: teks status memakai turunan gelap yang terbaca dan tidak bergantung warna saja', async ({ asAdmin: page }) => {
		await page.goto('/app/admin');
		const success = page.locator('[data-status="success"]').first();
		await expect(success).toBeVisible();
		await expect(success).toHaveCSS('color', palette.successText);
		await expect(success).toHaveCSS('background-color', rgb(240, 253, 244));
		expect((await success.innerText()).trim().length).toBeGreaterThan(0);
		await expect(success.locator('svg').first()).toHaveAttribute('aria-hidden', 'true');
	});

	test('tombol destruktif memakai merah tua beraksen tepi, bukan isian merah penuh', async ({ asAdmin: page }) => {
		await page.goto('/app/admin/lecturers');
		const button = page.getByRole('button', { name: 'Nonaktifkan' }).first();
		await expect(button).toBeVisible();
		await expect(button).toHaveCSS('color', palette.destructiveText);
		await expect(button).toHaveCSS('background-color', palette.white);
	});

	test('scrollbar memakai aturan ramping 12 px dengan warna dari token', async ({ anonymous: page }) => {
		await page.goto('/');
		const rules = await page.evaluate(() => {
			const found: Record<string, string> = {};
			const walk = (list: CSSRuleList) => {
				for (const rule of Array.from(list)) {
					const grouping = rule as CSSGroupingRule;
					if (grouping.cssRules) walk(grouping.cssRules);
					const style = rule as CSSStyleRule;
					if (style.selectorText === '::-webkit-scrollbar') found.width = style.style.width;
					if (style.selectorText === '::-webkit-scrollbar-thumb') found.thumb = style.style.backgroundColor;
				}
			};
			for (const sheet of Array.from(document.styleSheets)) {
				try {
					walk(sheet.cssRules);
				} catch {
					continue;
				}
			}
			return found;
		});
		expect(rules.width).toBe('12px');
		expect(rules.thumb).toContain('--scrollbar-thumb');
	});

	test('mode gelap mempertahankan token: latar slate-biru dan primer biru yang lebih terang', async ({ anonymous: page }) => {
		await page.emulateMedia({ colorScheme: 'dark' });
		await page.goto('/');
		await expect(page.locator('body')).toHaveCSS('background-color', palette.darkBackground);
		await expect(page.getByRole('link', { name: 'Masuk ke sistem' })).toHaveCSS('background-color', palette.darkPrimary);
	});

	test('tidak ada token warna lama pada gaya terhitung halaman publik', async ({ anonymous: page }) => {
		await page.goto('/');
		const legacy = await page.evaluate(() => {
			const names = ['--primary', '--background', '--foreground', '--chart-2', '--chart-3', '--border'];
			const style = getComputedStyle(document.documentElement);
			const expand = (value: string) => (/^#[0-9a-f]{3}$/.test(value) ? `#${[...value.slice(1)].map((c) => c + c).join('')}` : value);
			return Object.fromEntries(names.map((name) => [name, expand(style.getPropertyValue(name).trim().toLowerCase())]));
		});
		expect(legacy).toEqual({ '--primary': '#2563eb', '--background': '#ffffff', '--foreground': '#0f172a', '--chart-2': '#475569', '--chart-3': '#0f766e', '--border': '#e2e8f0' });
		const html = await page.content();
		expect(html).not.toMatch(/#26778f|#f2fafc|#082b3a|brand-(lavender|purple|pink)/i);
	});
});
