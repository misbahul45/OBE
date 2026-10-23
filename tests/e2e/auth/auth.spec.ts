import { expect, test } from '../../support/e2e/test.ts';

test.describe('autentikasi dan otorisasi', () => {
	test('halaman aplikasi mengalihkan tamu ke halaman masuk', async ({ anonymous: page }) => {
		await page.goto('/app/admin');
		await expect(page).toHaveURL(/\/login/);
		await page.goto('/app/lecturer/imports');
		await expect(page).toHaveURL(/\/login/);
	});

	test('password salah menampilkan pesan tanpa membocorkan apakah email ada', async ({ anonymous: page, state }) => {
		await page.goto('/login');
		await page.getByLabel('Email').fill(state.admin.email);
		await page.getByLabel('Password', { exact: true }).fill('SalahTotal#123');
		await page.getByRole('button', { name: 'Masuk', exact: true }).click();
		const known = await page.getByRole('alert').innerText();
		await page.getByLabel('Email').fill('tidak.ada@e2e.invalid');
		await page.getByLabel('Password', { exact: true }).fill('SalahTotal#123');
		await page.getByRole('button', { name: 'Masuk', exact: true }).click();
		await expect(page.getByRole('alert')).toHaveText(known);
		await expect(page).toHaveURL(/\/login/);
	});

	test('pendaftaran mandiri tidak tersedia', async ({ anonymous: page }) => {
		const response = await page.request.post('/api/auth/sign-up/email', { data: { email: 'baru@e2e.invalid', password: 'Rahasia#12345', name: 'Baru' }, headers: { origin: 'http://127.0.0.1:4173' } });
		expect(response.status()).toBeGreaterThanOrEqual(400);
		await page.goto('/login');
		await expect(page.getByRole('link', { name: /daftar|buat akun/i })).toHaveCount(0);
	});

	test('dosen ditolak di area admin dan admin ditolak di area dosen', async ({ asLecturerA, asAdmin }) => {
		const lecturerOnAdmin = await asLecturerA.goto('/app/admin');
		expect(lecturerOnAdmin!.status()).toBe(403);
		const adminOnLecturer = await asAdmin.goto('/app/lecturer');
		expect(adminOnLecturer!.status()).toBe(403);
	});

	test('dosen tidak dapat membuka kelas milik dosen lain walau ID diganti', async ({ asLecturerB, state }) => {
		const own = await asLecturerB.goto(`/app/lecturer/courses/${state.ids.offeringB}`);
		expect(own!.status()).toBe(200);
		const foreign = await asLecturerB.goto(`/app/lecturer/courses/${state.ids.offeringA}`);
		expect(foreign!.status()).toBe(404);
		const pdf = await asLecturerB.request.get(`/app/lecturer/courses/${state.ids.offeringA}/report.pdf`);
		expect(pdf.status()).toBe(404);
	});

	test('keluar mengakhiri sesi tanpa memengaruhi sesi lain milik akun yang sama', async ({ anonymous: page, asLecturerA, state }) => {
	await page.goto('/login');
	await page.getByLabel('Email').fill(state.lecturerA.email);
	await page.getByLabel('Password', { exact: true }).fill(state.lecturerA.password);
	await page.getByRole('button', { name: 'Masuk', exact: true }).click();
	await expect(page).toHaveURL(/\/app\/lecturer$/);
	await page.getByRole('button', { name: 'Keluar' }).click();
	await expect(page).toHaveURL(/\/login/);
	await page.goto('/app/lecturer');
	await expect(page).toHaveURL(/\/login/);
	const other = await asLecturerA.goto('/app/lecturer');
	expect(other!.status()).toBe(200);
	await expect(asLecturerA).toHaveURL(/\/app\/lecturer$/);
});
});
