import { expect, test } from '../../support/e2e/test.ts';

test.describe.configure({ mode: 'serial' });

const finding = { title: 'CPMK-2 kelas A di bawah ambang', description: 'Rasio ketercapaian kelas rendah pada dua semester berturut-turut.' };
let detailPath = '';

test('Super Admin mencatat temuan baru terkait kelas', async ({ asAdmin: page }) => {
	await page.goto('/app/admin/cqi');
	await page.getByLabel('Judul temuan').fill(finding.title);
	await page.getByLabel('Deskripsi', { exact: true }).fill(finding.description);
	await page.getByLabel('Prioritas', { exact: true }).selectOption('high');
	await page.getByLabel('Kelas terkait (opsional)').selectOption({ index: 1 });
	await page.getByRole('button', { name: 'Catat temuan' }).click();
	await expect(page).toHaveURL(/\/app\/admin\/cqi\/[0-9a-f-]{36}$/);
	detailPath = new URL(page.url()).pathname;
	await expect(page.getByRole('heading', { level: 1, name: finding.title })).toBeVisible();
	await expect(page.getByRole('listitem').filter({ hasText: '1. Temuan baru' })).toHaveAttribute('aria-current', 'step');
});

test('gerbang alur menahan transisi sampai akar masalah dan tindakan tersedia', async ({ asAdmin: page }) => {
	await page.goto(detailPath);
	await page.getByRole('button', { name: 'Pindah ke Analisis akar masalah' }).click();
	await expect(page.getByRole('listitem').filter({ hasText: '2. Analisis akar masalah' })).toHaveAttribute('aria-current', 'step');

	await expect(page.getByText('Isi akar masalah sebelum menyusun rencana tindakan.').first()).toBeVisible();
	await page.getByRole('button', { name: 'Pindah ke Rencana tindakan' }).click();
	await expect(page.getByRole('alert').filter({ hasText: 'Isi akar masalah sebelum menyusun rencana tindakan.' })).toBeVisible();

	await page.getByLabel('Akar masalah').fill('Materi prasyarat belum dikuasai sebagian besar mahasiswa.');
	await page.getByRole('button', { name: 'Simpan temuan' }).click();
	await expect(page.getByText('Temuan disimpan.')).toBeVisible();
	await page.getByRole('button', { name: 'Pindah ke Rencana tindakan' }).click();
	await expect(page.getByRole('listitem').filter({ hasText: '3. Rencana tindakan' })).toHaveAttribute('aria-current', 'step');

	await page.getByRole('button', { name: 'Pindah ke Tindakan berjalan' }).click();
	await expect(page.getByRole('alert').filter({ hasText: 'minimal satu tindakan' })).toBeVisible();
});

test('tindakan ditambahkan dengan penanggung jawab dosen dan tenggat valid', async ({ asAdmin: page, state }) => {
	await page.goto(detailPath);
	await page.getByLabel('Tindakan baru').fill('Tambah kuis prasyarat mingguan');
	await page.getByLabel('Penanggung jawab').selectOption({ label: 'Dosen Uji Satu' });
	await page.getByLabel('Tenggat').fill('2026-12-31');
	await page.getByRole('button', { name: 'Tambah tindakan' }).click();
	await expect(page.getByText('Tindakan ditambahkan.')).toBeVisible();
	await expect(page.locator('[data-action]').first()).toContainText('PJ Dosen Uji Satu');
	expect(state.lecturerA.name).toBe('Dosen Uji Satu');
	await page.getByRole('button', { name: 'Pindah ke Tindakan berjalan' }).click();
	await expect(page.getByRole('listitem').filter({ hasText: '4. Tindakan berjalan' })).toHaveAttribute('aria-current', 'step');
	await page.getByRole('button', { name: 'Pindah ke Evaluasi' }).click();
	await expect(page.getByRole('alert').filter({ hasText: /Selesaikan atau batalkan seluruh tindakan/ })).toBeVisible();
});

test('dosen penanggung jawab menyelesaikan tindakannya dan menambah bukti, tanpa kendali alur', async ({ asLecturerA: page }) => {
	await page.goto('/app/lecturer/cqi');
	await page.getByRole('link', { name: finding.title }).or(page.getByRole('row', { name: new RegExp(finding.title) }).getByRole('link', { name: 'Buka' })).first().click();
	await expect(page).toHaveURL(/\/app\/lecturer\/cqi\/[0-9a-f-]{36}$/);
	await expect(page.getByRole('heading', { name: 'Ubah status' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Simpan temuan' })).toHaveCount(0);

	const action = page.locator('[data-action]').first();
	await action.getByRole('button', { name: 'Selesai' }).click();
	await expect(page.getByText('Status tindakan diperbarui.')).toBeVisible();
	await expect(page.locator('[data-action]').first()).toContainText('Selesai');
	await expect(page.locator('[data-action]').first().getByRole('button')).toHaveCount(0);

	await page.getByLabel('Judul bukti').fill('Soal kuis minggu 1-4');
	await page.getByLabel('Tautan (http/https)').fill('javascript:alert(1)');
	await page.getByRole('button', { name: 'Tambah bukti' }).click();
	await expect(page.getByRole('alert').first()).toBeVisible();
	await page.getByLabel('Tautan (http/https)').fill('https://contoh.id/arsip/kuis');
	await page.getByRole('button', { name: 'Tambah bukti' }).click();
	await expect(page.getByText('Bukti ditambahkan.')).toBeVisible();
	await expect(page.getByRole('link', { name: 'https://contoh.id/arsip/kuis' })).toHaveAttribute('rel', /noopener/);
});

test('dosen lain tidak melihat temuan yang bukan miliknya', async ({ asLecturerB: page }) => {
	await page.goto('/app/lecturer/cqi');
	await expect(page.getByText(finding.title)).toHaveCount(0);
	const response = await page.goto(detailPath.replace('/admin/', '/lecturer/'));
	expect(response!.status()).toBe(404);
});

test('evaluasi dan penutupan memerlukan evaluasi serta bukti, lalu temuan menjadi final', async ({ asAdmin: page }) => {
	await page.goto(detailPath);
	await page.getByRole('button', { name: 'Pindah ke Evaluasi' }).click();
	await expect(page.getByRole('listitem').filter({ hasText: '5. Evaluasi' })).toHaveAttribute('aria-current', 'step');
	await expect(page.getByText('Catat minimal satu evaluasi dampak sebelum menutup temuan.').first()).toBeVisible();

	await page.getByLabel('Indikator').fill('Rasio ketercapaian CPMK-2');
	await page.getByLabel('Nilai sebelum').fill('55,5');
	await page.getByLabel('Nilai sesudah').fill('72');
	await page.getByLabel('Kesimpulan').fill('Rasio membaik setelah kuis prasyarat diterapkan.');
	await page.getByRole('button', { name: 'Tambah evaluasi' }).click();
	await expect(page.getByText('Evaluasi ditambahkan.')).toBeVisible();
	await expect(page.getByText('Sebelum 55,5 → sesudah 72')).toBeVisible();

	await page.getByRole('button', { name: 'Pindah ke Selesai' }).click();
	await expect(page.getByRole('listitem').filter({ hasText: '6. Selesai' })).toHaveAttribute('aria-current', 'step');
	await expect(page.getByText('Status akhir; tidak dapat diubah lagi.')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Simpan temuan' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Tambah tindakan' })).toHaveCount(0);
});

test('daftar temuan menampilkan status akhir dan filter bekerja', async ({ asAdmin: page }) => {
	await page.goto('/app/admin/cqi?status=closed');
	await expect(page.getByRole('row', { name: new RegExp(finding.title) })).toContainText('Selesai');
	await page.goto('/app/admin/cqi?status=open');
	await expect(page.getByText(finding.title)).toHaveCount(0);
});
