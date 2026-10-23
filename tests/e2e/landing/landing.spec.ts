import { expect, test } from '../../support/e2e/test.ts';

test.describe('landing page', () => {
	test('memiliki tepat satu h1 dan satu h2 yang konsisten, tanpa label pengisi', async ({ anonymous: page }) => {
		await page.goto('/');
		await expect(page.locator('h1')).toHaveCount(1);
		await expect(page.locator('h2')).toHaveCount(1);
		await expect(page.locator('h1')).toHaveText('Capaian pembelajaran, terhubung dalam satu sistem');
		await expect(page.locator('h2')).toContainText('nilai asesmen ke CPMK dan CPL');
		await expect(page.locator('h3, h4, h5, h6')).toHaveCount(0);
		await expect(page.locator('[data-slot="badge"], [class*="badge"], [class*="eyebrow"], [class*="pill"]')).toHaveCount(0);
		await expect(page.locator('body')).not.toContainText(/daftar|sign.?up|register|gratis|baru!/i);
	});

	test('satu-satunya ajakan bertindak menuju halaman masuk', async ({ anonymous: page }) => {
		await page.goto('/');
		const links = page.getByRole('link');
		const hrefs = await links.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')));
		expect(hrefs.filter((href) => href !== '/login' && href !== '/')).toEqual([]);
		expect(hrefs.filter((href) => href === '/login').length).toBe(3);
		await page.getByRole('link', { name: 'Masuk ke sistem' }).click();
		await expect(page).toHaveURL(/\/login$/);
		await expect(page.getByRole('heading', { level: 1, name: 'Masuk' })).toBeVisible();
	});

	test('visual memiliki alternatif teks dan konten terlihat penuh saat gerakan dikurangi', async ({ browser }) => {
		const context = await browser.newContext({ reducedMotion: 'reduce', baseURL: 'http://127.0.0.1:4173' });
		const page = await context.newPage();
		await page.goto('/');
		await expect(page.getByRole('group', { name: /Alur Outcome-Based Education/ })).toBeVisible();
		for (const label of ['Mata Kuliah', 'CPMK', 'CPL', 'CQI']) await expect(page.getByRole('button', { name: new RegExp(`^${label}, tahap`) })).toBeVisible();
		await expect(page.locator('[data-orbit-paths] .tracer')).toBeHidden();
		await expect(page.locator('h1')).toHaveCSS('opacity', '1');
		await expect(page.locator('h2')).toHaveCSS('opacity', '1');
		await context.close();
	});

	test('header keamanan dan CSP berlaku pada landing', async ({ anonymous: page }) => {
		const response = await page.goto('/');
		const headers = response!.headers();
		expect(headers['content-security-policy']).toContain("default-src 'self'");
		expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
		expect(headers['x-content-type-options']).toBe('nosniff');
		expect(headers['referrer-policy']).toBeDefined();
	});

	test('logo resmi UNAIR tampil di kepala halaman dengan proporsi persegi', async ({ anonymous: page }) => {
		await page.goto('/');
		const logo = page.getByRole('banner').getByRole('img', { name: 'Logo Universitas Airlangga' });
		await expect(logo).toBeVisible();
		const size = await logo.evaluate((node) => ({ natural: (node as HTMLImageElement).naturalWidth, width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height }));
		expect(size.natural).toBeGreaterThan(0);
		expect(size.width).toBeCloseTo(size.height, 1);
		expect(size.width).toBeGreaterThanOrEqual(40);
	});

	test('menjelaskan alur, peran, modul, dan siklus PDCA tanpa menambah judul', async ({ anonymous: page }) => {
		await page.goto('/');
		for (const text of ['Satu rantai bukti, dari nilai sampai perbaikan', 'Nilai asesmen per mata kuliah', 'Dirancang untuk yang mengelola dan mengajar', 'Modul yang saling terhubung', 'Siklus PDCA yang berjalan di dalam sistem']) {
			await expect(page.getByText(text, { exact: true })).toBeAttached();
		}
		await expect(page.getByRole('region')).toHaveCount(5);
		await expect(page.locator('h1')).toHaveCount(1);
		await expect(page.locator('h2')).toHaveCount(1);
	});

	test('kanvas titik Three.js bersifat dekoratif dan tidak menangkap pointer', async ({ anonymous: page }) => {
		await page.goto('/');
		const canvas = page.locator('canvas[data-dot-field]');
		await expect(canvas).toHaveAttribute('aria-hidden', 'true');
		await expect(canvas).toHaveCSS('pointer-events', 'none');
		await expect(canvas).toHaveCSS('position', 'fixed');
		const box = await canvas.boundingBox();
		expect(box?.width).toBeGreaterThan(300);
	});

	test('toggle tema di kepala halaman mengganti terang dan gelap serta bertahan setelah muat ulang', async ({ anonymous: page }) => {
		await page.emulateMedia({ colorScheme: 'light' });
		await page.goto('/');
		const html = page.locator('html');
		await expect(html).not.toHaveClass(/dark/);
		await page.getByRole('button', { name: 'Ganti ke tema gelap' }).click();
		await expect(html).toHaveClass(/dark/);
		await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(11, 18, 32)');
		await page.reload();
		await expect(html).toHaveClass(/dark/);
		await page.getByRole('button', { name: 'Ganti ke tema terang' }).click();
		await expect(html).not.toHaveClass(/dark/);
		await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
	});
});
