import { batchIdOf, commitAndWaitReport, saveSheet, sheetCard, stat, uploadWorkbook, validate } from '../../support/e2e/imports.ts';
import { expect, test, workbooks } from '../../support/e2e/test.ts';

test.describe.configure({ mode: 'serial' });

let batchOfB = '';
let batchOfA = '';

test('dosen hanya dapat memilih kelas yang ditugaskan dan sheet milik kelas lain tidak diimpor', async ({ asLecturerB: page }) => {
	await uploadWorkbook(page, workbooks.semester);
	await expect(page).toHaveURL(/\/app\/lecturer\/imports\/[0-9a-f-]{36}/);
	batchOfB = batchIdOf(page.url());

	const foreign = sheetCard(page, 'Mata Kuliah Uji A');
	const options = await foreign.getByLabel('Kelas tujuan').locator('option').allInnerTexts();
	expect(options).toEqual(['Pilih kelas', 'E2EB · Kelas Uji B — Kelas T1']);
	await expect(foreign.getByLabel('Kelas tujuan')).toHaveValue('');
	await saveSheet(page, 'Mata Kuliah Uji A', { include: false });

	const own = sheetCard(page, 'Kelas Uji B T1');
	await expect(own.getByLabel('Kelas tujuan')).not.toHaveValue('');
	await expect(own.getByText('Total bobot 100%')).toBeVisible();
	await saveSheet(page, 'Kelas Uji B T1', { acknowledgeNumeric: true });
});

test('validasi menampilkan ringkasan tanpa mengubah data, lalu penyimpanan memerlukan konfirmasi', async ({ asLecturerB: page }) => {
	await page.goto(`/app/lecturer/imports/${batchOfB}`);
	await expect(page.getByRole('button', { name: 'Simpan ke database' })).toBeDisabled();
	await validate(page);
	const result = page.getByTestId('dry-run-result');
	await expect(result).toContainText('Tidak ada penghalang');
	await expect(stat(result, 'Mahasiswa baru')).toHaveText('14');
	await expect(stat(result, 'Nilai baru')).toHaveText('98');
	await expect(stat(result, 'Baris ditolak')).toHaveText('0');

	await page.goto('/app/lecturer/courses');
	await expect(page.getByText('0 mahasiswa').first()).toBeVisible();

	await page.goto(`/app/lecturer/imports/${batchOfB}`);
	await validate(page);
	await commitAndWaitReport(page);
	await expect(stat(page, 'Mahasiswa baru')).toHaveText('14');
	await expect(stat(page, 'Nilai baru')).toHaveText('98');
	await expect(page.getByRole('row', { name: /Kelas Uji B T1/ })).toContainText('Tersimpan');
	await expect(page.getByRole('row', { name: /Mata Kuliah Uji A/ })).toContainText('Tidak disertakan');
});

test('laporan menyediakan CSV galat tanpa NIM dan hanya pengunggah yang dapat membukanya', async ({ asLecturerB: page, asLecturerA, state }) => {
	await page.goto(`/app/lecturer/imports/${batchOfB}`);
	await expect(page.getByRole('link', { name: 'Unduh CSV' })).toBeVisible();
	const csv = await page.request.get(`/app/lecturer/imports/${batchOfB}/issues.csv`);
	expect(csv.status()).toBe(200);
	expect(csv.headers()['content-type']).toContain('text/csv');
	expect(csv.headers()['content-disposition']).toContain('attachment');
	const body = await csv.text();
	expect(body.startsWith('﻿Sheet,Baris,Kolom,Bidang,Tingkat,Kode,Pesan')).toBe(true);
	expect(body).not.toMatch(/\b99\d{9,}\b/);

	const stranger = await asLecturerA.goto(`/app/lecturer/imports/${batchOfB}`);
	expect(stranger!.status()).toBe(404);
	const strangerCsv = await asLecturerA.request.get(`/app/lecturer/imports/${batchOfB}/issues.csv`);
	expect(strangerCsv.status()).toBe(404);
	expect(state.ids.offeringB).toBeTruthy();
});

test('kelas yang diimpor menampilkan mahasiswa dan hasil capaian', async ({ asLecturerB: page, state }) => {
	await page.goto(`/app/lecturer/courses/${state.ids.offeringB}`);
	await expect(page.getByRole('heading', { level: 2, name: /Mahasiswa \(14\)/ })).toBeVisible();
	await expect(page.getByText('Rata-rata nilai akhir')).toBeVisible();
});

test('nilai yang berubah ditahan sampai dosen mengonfirmasi, lalu tercatat sebagai pembaruan', async ({ asLecturerA: page }) => {
	await uploadWorkbook(page, workbooks.semesterChanged);
	await expect(page).toHaveURL(/\/app\/lecturer\/imports\/[0-9a-f-]{36}/);
	batchOfA = batchIdOf(page.url());
	await expect(sheetCard(page, 'Mata Kuliah Uji A').getByLabel('Kelas tujuan')).not.toHaveValue('');
	await saveSheet(page, 'Mata Kuliah Uji A', { acknowledgeNumeric: true });
	await saveSheet(page, 'Kelas Uji B T1', { include: false });

	await validate(page);
	const result = page.getByTestId('dry-run-result');
	await expect(result).toContainText('3 nilai lama akan diperbarui');
	await expect(stat(result, 'Nilai diubah')).toHaveText('3');
	await expect(stat(result, 'Nilai tidak berubah')).toHaveText('117');
	await expect(stat(result, 'Mahasiswa baru')).toHaveText('0');
	await expect(page.getByRole('button', { name: 'Simpan ke database' })).toBeDisabled();

	await page.getByLabel(/Saya memahami 3 nilai yang sudah ada akan diubah/).check();
	await commitAndWaitReport(page);
	await expect(stat(page, 'Nilai diubah')).toHaveText('3');
	await expect(stat(page, 'Nilai tidak berubah')).toHaveText('117');
});

test('mengunggah ulang berkas yang sama tidak mengubah data (idempoten) dan duplikat diberi tahu', async ({ asLecturerA: page }) => {
	await uploadWorkbook(page, workbooks.semesterChanged);
	await expect(page).toHaveURL(/duplikat=1/);
	await expect(page.getByText('Berkas identik pernah Anda impor')).toBeVisible();
	await saveSheet(page, 'Mata Kuliah Uji A', { acknowledgeNumeric: true });
	await saveSheet(page, 'Kelas Uji B T1', { include: false });
	await validate(page);
	const result = page.getByTestId('dry-run-result');
	await expect(stat(result, 'Nilai diubah')).toHaveText('0');
	await expect(stat(result, 'Nilai baru')).toHaveText('0');
	await expect(stat(result, 'Nilai tidak berubah')).toHaveText('120');
	await commitAndWaitReport(page);
	await expect(stat(page, 'Nilai tidak berubah')).toHaveText('120');
});

test('berkas rusak ditolak dengan pesan jelas dan tidak membuat batch', async ({ asLecturerA: page }) => {
	await uploadWorkbook(page, workbooks.corrupt);
	await expect(page).toHaveURL(/\/app\/lecturer\/import$/);
	await expect(page.getByRole('alert')).toContainText(/rusak|bukan workbook|tidak valid/i);
});

test('sheet tanpa kolom NIM tidak dapat disertakan dan menunjukkan petunjuk menentukan header', async ({ asLecturerA: page }) => {
	await uploadWorkbook(page, workbooks.noStudentId);
	const card = page.locator('[data-sheet]').first();
	await expect(card.getByText('Header belum ditemukan')).toBeVisible();
	await expect(card.getByLabel('Sertakan sheet ini dalam impor')).toBeDisabled();
	await expect(page.getByRole('button', { name: 'Jalankan validasi' })).toBeDisabled();
});

test('membatalkan impor menghapus berkas sementara dan tercatat pada riwayat', async ({ asLecturerA: page }) => {
	await uploadWorkbook(page, workbooks.semester);
	await expect(page).toHaveURL(/\/app\/lecturer\/imports\/[0-9a-f-]{36}/);
	const id = batchIdOf(page.url());
	await page.getByRole('button', { name: 'Batalkan impor ini' }).click();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Batalkan impor' }).click();
	await expect(page).toHaveURL(/\/app\/lecturer\/imports\?dibatalkan=1/);
	await expect(page.getByText('Impor dibatalkan dan berkas sementara dihapus.')).toBeVisible();
	await page.goto(`/app/lecturer/imports/${id}`);
	await expect(page.getByTestId('batch-report')).toContainText('Dibatalkan');
});

test('riwayat impor dapat disaring berdasarkan status', async ({ asLecturerA: page }) => {
	await page.goto('/app/lecturer/imports');
	await expect(page.getByRole('row', { name: /Tersimpan/ }).first()).toBeVisible();
	await page.getByLabel('Cari berkas impor').fill('tidak-ada-berkas-ini');
	await page.getByRole('button', { name: 'Terapkan' }).click();
	await expect(page.getByText('Tidak ada impor yang cocok')).toBeVisible();
	await page.goto('/app/lecturer/imports?status=cancelled');
	await expect(page.getByRole('row', { name: /Dibatalkan/ }).first()).toBeVisible();
	await expect(page.getByRole('row', { name: /Tersimpan/ })).toHaveCount(0);
	expect(batchOfA).not.toBe('');
});
