import { expect, test } from '../../support/e2e/test.ts';

test.describe('profil lulusan dan bidang kerja', () => {
	test('admin melihat empat profil, matriks CPL, dan peringatan CPL yang belum terpetakan', async ({ asAdmin: page }) => {
		await page.goto('/app/admin');
		await page.getByRole('link', { name: 'Profil lulusan' }).click();
		await expect(page).toHaveURL(/\/app\/admin\/profiles$/);
		await expect(page.getByRole('heading', { level: 1, name: 'Profil lulusan dan bidang kerja' })).toBeVisible();

		for (const name of ['Praktisi Profesional', 'Peneliti & Akademisi Awal', 'Wirausahawan & Inovator', 'Analis Kebijakan']) {
			await expect(page.getByRole('heading', { level: 3, name: new RegExp(name) })).toBeVisible();
		}
		await expect(page.getByText(/^CPL-1(, CPL-\d+)* belum terkait dengan profil lulusan$/)).toBeVisible();

		const matrix = page.getByRole('table').filter({ hasText: 'WA' }).first();
		const cpl6 = matrix.getByRole('row', { name: /CPL-6/ });
		await expect(cpl6.getByText('Terkait', { exact: true })).toHaveCount(2);
		const cpl2 = matrix.getByRole('row', { name: /CPL-2/ });
		await expect(cpl2.getByText('WA-1')).toBeVisible();
		await expect(cpl2.getByText('WK-4')).toBeVisible();
	});

	test('bidang kerja menampilkan profil utama dan pendukung', async ({ asAdmin: page }) => {
		await page.goto('/app/admin/profiles');
		const fields = page.getByRole('table').filter({ hasText: 'Profil utama' });
		const bk5 = fields.getByRole('row', { name: /BK5/ });
		await expect(bk5).toContainText('Manajer Teknologi Kesehatan');
		await expect(bk5).toContainText('PL3 Wirausahawan & Inovator');
		await expect(bk5).toContainText('PL1 Praktisi Profesional');
		await expect(fields.getByRole('row')).toHaveCount(8);
	});

	test('dosen tidak dapat membuka halaman profil lulusan admin', async ({ asLecturerA: page }) => {
		const response = await page.goto('/app/admin/profiles');
		expect(response?.status()).toBe(403);
	});

	test('atribut WA dan WK pada CPL dapat diubah dan kode yang salah ditolak dengan pesan jelas', async ({ asAdmin: page }) => {
		await page.goto('/app/admin/curriculum');
		const row = page.getByRole('row', { name: /CPL-4/ });
		await expect(row.getByText('WA-4')).toBeVisible();
		await row.getByRole('link', { name: 'Ubah' }).click();
		await expect(page.getByLabel('Atribut lulusan WA (opsional)')).toHaveValue('WA-4, WA-5');
		await page.getByLabel('Atribut lulusan WA (opsional)').fill('WA-4, WA-99');
		await page.getByRole('button', { name: 'Simpan perubahan' }).click();
		await expect(page.getByText(/Atribut lulusan tidak dikenal: WA-99/)).toBeVisible();
	});
});

test.describe('panduan istilah dan navigasi', () => {
	test('admin dan dosen dapat membuka panduan istilah dari bilah atas', async ({ asAdmin, asLecturerA }) => {
		for (const page of [asAdmin, asLecturerA]) {
			await page.goto(page === asAdmin ? '/app/admin' : '/app/lecturer');
			await page.getByRole('link', { name: 'Arti istilah' }).click();
			await expect(page).toHaveURL(/\/app\/help$/);
			await expect(page.getByRole('heading', { level: 1, name: 'Panduan istilah' })).toBeVisible();
			for (const term of ['CPL', 'CPMK', 'WA', 'WK', 'CQI']) await expect(page.locator('dt').filter({ hasText: new RegExp(`^${term}\\b`) }).first()).toBeVisible();
		}
	});

	test('tamu dialihkan ke halaman masuk', async ({ anonymous: page }) => {
		await page.goto('/app/help');
		await expect(page).toHaveURL(/\/login/);
	});

	test('menu admin tersusun menurut alur kerja dan setiap menu punya keterangan', async ({ asAdmin: page }) => {
		await page.goto('/app/admin');
		const labels = await page.locator('[data-sidebar="group-label"]').allInnerTexts();
		expect(labels).toEqual(['Ringkasan', 'Kurikulum', 'Akademik', 'Nilai dan mahasiswa', 'Mutu', 'Sistem']);
		const hint = await page.getByRole('link', { name: 'Penawaran kelas' }).getAttribute('title');
		expect(hint).toContain('tugaskan dosen');
	});

	test('daftar persiapan data tersembunyi bila seluruh langkah sudah terpenuhi', async ({ asAdmin: page }) => {
		await page.goto('/app/admin');
		await expect(page.getByRole('heading', { level: 1, name: 'Dashboard program studi' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Mulai dari sini' })).toHaveCount(0);
	});
});

test.describe('alur impor nilai', () => {
	test('halaman unggah menampilkan empat tahap dengan tahap pertama sebagai langkah saat ini', async ({ asLecturerA: page }) => {
		await page.goto('/app/lecturer/import');
		const steps = page.getByRole('list', { name: 'Tahapan impor nilai' }).getByRole('listitem');
		await expect(steps).toHaveCount(4);
		await expect(steps.first()).toHaveAttribute('aria-current', 'step');
		await expect(steps.nth(1)).toContainText('Atur sheet');
		await expect(steps.nth(3)).toContainText('Simpan');
	});
});
