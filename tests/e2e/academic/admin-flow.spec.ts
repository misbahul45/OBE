import { expect, test } from '../../support/e2e/test.ts';

test.describe.configure({ mode: 'serial' });

const lecturer = { name: 'Dosen Baru E2E', email: 'dosen.baru@e2e.invalid', code: 'E2E9' };
const course = { code: 'E2EC', name: 'Biologi Sel Uji', credits: '3' };
const newPassword = 'KataSandiBaru#2026';
let temporaryPassword = '';

test('Super Admin membuat akun dosen dan password sementara hanya tampil sekali', async ({ asAdmin: page }) => {
	await page.goto('/app/admin/lecturers');
	await page.getByLabel('Nama lengkap').fill(lecturer.name);
	await page.getByLabel('Email').fill(lecturer.email);
	await page.getByLabel('Kode dosen (opsional)').fill(lecturer.code);
	await page.getByRole('button', { name: 'Buat akun dosen' }).click();
	const shown = page.getByTestId('temporary-password');
	await expect(shown).toBeVisible();
	temporaryPassword = (await shown.innerText()).trim();
	expect(temporaryPassword.length).toBeGreaterThanOrEqual(12);
	await page.goto('/app/admin/lecturers');
	await expect(page.getByTestId('temporary-password')).toHaveCount(0);
	await expect(page.getByRole('row', { name: new RegExp(lecturer.email) })).toContainText('Wajib ganti password');
});

test('email dosen yang sama ditolak dengan pesan pada bidangnya', async ({ asAdmin: page }) => {
	await page.goto('/app/admin/lecturers');
	await page.getByLabel('Nama lengkap').fill('Duplikat');
	await page.getByLabel('Email').fill(lecturer.email);
	await page.getByRole('button', { name: 'Buat akun dosen' }).click();
	await expect(page.getByRole('alert').first()).toBeVisible();
	await expect(page.getByTestId('temporary-password')).toHaveCount(0);
});

test('dosen baru wajib mengganti password sementara pada login pertama', async ({ anonymous: page }) => {
	await page.goto('/login');
	await page.getByLabel('Email').fill(lecturer.email);
	await page.getByLabel('Password', { exact: true }).fill(temporaryPassword);
	await page.getByRole('button', { name: 'Masuk', exact: true }).click();
	await expect(page).toHaveURL(/\/app\/account\/password/);
	const blocked = await page.goto('/app/lecturer/courses');
	await expect(page).toHaveURL(/\/app\/account\/password/);
	expect(blocked).not.toBeNull();

	await page.getByLabel('Password saat ini').fill(temporaryPassword);
	await page.getByLabel('Password baru', { exact: true }).fill('lemah');
	await page.getByLabel('Ulangi password baru').fill('lemah');
	await page.getByRole('button', { name: 'Simpan password baru' }).click();
	await expect(page).toHaveURL(/\/app\/account\/password/);
	await expect(page.getByRole('alert').first()).toBeVisible();

	await page.getByLabel('Password saat ini').fill(temporaryPassword);
	await page.getByLabel('Password baru', { exact: true }).fill(newPassword);
	await page.getByLabel('Ulangi password baru').fill(newPassword);
	await page.getByRole('button', { name: 'Simpan password baru' }).click();
	await expect(page).toHaveURL(/\/app\/lecturer$/);
	await expect(page.getByRole('heading', { level: 1, name: 'Dashboard dosen' })).toBeVisible();
	await expect(page.getByText('Belum ada kelas')).toBeVisible();
});

test('Super Admin menambah mata kuliah, membuat penawaran kelas, dan menugaskan dosen baru', async ({ asAdmin: page }) => {
	await page.goto('/app/admin/courses');
	await page.getByLabel('Kode', { exact: true }).fill(course.code);
	await page.getByLabel('Nama mata kuliah').fill(course.name);
	await page.getByLabel('SKS').fill(course.credits);
	await page.getByRole('button', { name: 'Tambah mata kuliah' }).click();
	await expect(page.getByText(`Mata kuliah ${course.code} dibuat.`)).toBeVisible();
	await expect(page.getByRole('row', { name: new RegExp(course.name) })).toBeVisible();

	await page.goto('/app/admin/offerings');
	await page.getByLabel('Mata kuliah', { exact: true }).selectOption({ label: `${course.code} · ${course.name}` });
	await page.getByLabel('Semester', { exact: true }).selectOption({ index: 1 });
	await page.getByLabel('Kelas', { exact: true }).fill('B');
	await page.getByRole('button', { name: 'Tambah penawaran' }).click();
	await expect(page.getByText('Penawaran kelas B dibuat.')).toBeVisible();

	const row = page.getByRole('row', { name: new RegExp(course.name) });
	await row.getByRole('combobox').selectOption({ label: `${lecturer.name} (${lecturer.code})` });
	await row.getByRole('button', { name: 'Tugaskan' }).click();
	await expect(page.getByText('Dosen ditugaskan.')).toBeVisible();
	await expect(page.getByRole('row', { name: new RegExp(course.name) })).toContainText(lecturer.name);
});

test('kelas baru langsung tampil pada dasbor dosen yang ditugaskan', async ({ browser }) => {
	const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
	const page = await context.newPage();
	await page.goto('/login');
	await page.getByLabel('Email').fill(lecturer.email);
	await page.getByLabel('Password', { exact: true }).fill(newPassword);
	await page.getByRole('button', { name: 'Masuk', exact: true }).click();
	await expect(page).toHaveURL(/\/app\/lecturer$/);
	await expect(page.getByRole('heading', { level: 3, name: course.name })).toBeVisible();
	await context.close();
});

test('Super Admin membuat semester baru dan menolak tanggal yang tidak berurutan', async ({ asAdmin: page }) => {
	await page.goto('/app/admin/terms');
	await page.getByLabel('Tahun akademik', { exact: true }).selectOption({ index: 1 });
	await page.getByLabel('Jenis semester').selectOption('genap');
	await page.getByLabel('Tanggal mulai').fill('2027-03-01');
	await page.getByLabel('Tanggal akhir').fill('2027-02-01');
	await page.getByRole('button', { name: 'Tambah semester' }).click();
	await expect(page.getByRole('alert').first()).toBeVisible();
	await page.getByLabel('Tanggal akhir').fill('2027-07-31');
	await page.getByRole('button', { name: 'Tambah semester' }).click();
	await expect(page.getByText(/Semester .*Genap.* dibuat\./)).toBeVisible();
});

test('menonaktifkan dosen mencabut sesinya dan menolak login berikutnya', async ({ asAdmin: page, browser }) => {
	const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
	const lecturerPage = await context.newPage();
	await lecturerPage.goto('/login');
	await lecturerPage.getByLabel('Email').fill(lecturer.email);
	await lecturerPage.getByLabel('Password', { exact: true }).fill(newPassword);
	await lecturerPage.getByRole('button', { name: 'Masuk', exact: true }).click();
	await expect(lecturerPage).toHaveURL(/\/app\/lecturer$/);

	await page.goto('/app/admin/lecturers');
	const row = page.getByRole('row', { name: new RegExp(lecturer.email) });
	await row.getByRole('button', { name: 'Nonaktifkan' }).click();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Nonaktifkan' }).click();
	await expect(page.getByText('Akun dosen dinonaktifkan dan seluruh sesinya dicabut.')).toBeVisible();

	await lecturerPage.goto('/app/lecturer');
	await expect(lecturerPage).toHaveURL(/\/login/);
	await lecturerPage.getByLabel('Email').fill(lecturer.email);
	await lecturerPage.getByLabel('Password', { exact: true }).fill(newPassword);
	await lecturerPage.getByRole('button', { name: 'Masuk', exact: true }).click();
	await expect(lecturerPage).toHaveURL(/\/login/);
	await expect(lecturerPage.getByRole('alert')).toBeVisible();
	await context.close();
});
