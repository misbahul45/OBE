import { describe, expect, test } from 'bun:test';
import { baseCodeFor, inferComponentType, isNameHeader, isNimHeader, isNumberHeader, matchKey, normalizeHeader, parseComponentHeader, parseOutcomeHeader } from '#lib/features/imports/header.ts';

describe('normalizeHeader', () => {
	test('menyambung kata yang terpotong baris baru dan merapikan spasi', () => {
		expect(normalizeHeader('UTS (Mi\n dterm) #\n  \n  \n  \n  \n (5 %)')).toBe('UTS (Midterm) # (5 %)');
		expect(normalizeHeader('UAS (Fi\n nalterm) #\n Project Based\n  \n (20 %)')).toBe('UAS (Finalterm) # Project Based (20 %)');
	});

	test('memperbaiki kata terpecah yang umum', () => {
		expect(normalizeHeader('UTS (Midter m) # Problem Based')).toBe('UTS (Midterm) # Problem Based');
		expect(normalizeHeader('UAS ( Finalter m) # Kom ponen Lain')).toBe('UAS ( Finalterm) # Komponen Lain');
		expect(normalizeHeader('# Komp onen Lain # Tugas (10%)')).toBe('# Komponen Lain # Tugas (10%)');
	});

	test('bobot persen tidak hilang', () => {
		expect(normalizeHeader('Kuis\n(20 %)')).toContain('(20 %)');
	});
});

describe('pengenalan kolom identitas', () => {
	test('NIM, nama, dan nomor dikenali dari berbagai tulisan', () => {
		for (const text of ['NIM', 'nim', 'N.I.M', 'NPM', 'Student ID', 'Nomor Induk Mahasiswa']) expect(isNimHeader(text)).toBe(true);
		for (const text of ['Nama', 'NAAMA', 'Nama Mahasiswa', 'Name']) expect(isNameHeader(text)).toBe(true);
		for (const text of ['NO', 'No.', 'Nomor']) expect(isNumberHeader(text)).toBe(true);
		expect(isNimHeader('Nilai')).toBe(false);
		expect(matchKey('  Nama\nLengkap ')).toBe('nama lengkap');
	});
});

describe('parseOutcomeHeader', () => {
	test('CPMK dan CPL dinormalisasi ke kode baku', () => {
		expect(parseOutcomeHeader('CPMK-1')).toEqual({ kind: 'cpmk', code: 'CPMK-1' });
		expect(parseOutcomeHeader('CPMK 2')).toEqual({ kind: 'cpmk', code: 'CPMK-2' });
		expect(parseOutcomeHeader('cpmk3')).toEqual({ kind: 'cpmk', code: 'CPMK-3' });
		expect(parseOutcomeHeader('CPMK_04')).toEqual({ kind: 'cpmk', code: 'CPMK-4' });
		expect(parseOutcomeHeader('CPL 1')).toEqual({ kind: 'cpl', code: 'CPL-1' });
		expect(parseOutcomeHeader('CPL3')).toEqual({ kind: 'cpl', code: 'CPL-3' });
	});

	test('label umum tanpa nomor atau matriks bukan kolom hasil', () => {
		for (const text of ['CPMK', 'CPL', 'CPL \\ CPMK', 'Capaian CPMK', 'CPMK-1 (bobot)']) expect(parseOutcomeHeader(text)).toBeNull();
	});
});

describe('parseComponentHeader', () => {
	test('fase UTS/UAS dengan bobot', () => {
		const header = parseComponentHeader('UTS (Mi\n dterm) #\n  \n  \n (5 %)');
		expect(header).toMatchObject({ phase: 'UTS', weightPercent: 5, type: 'uts', name: 'UTS (Midterm)' });
	});

	test('pemisah # membentuk fase, kategori, dan nama komponen', () => {
		const header = parseComponentHeader('UTS (Midterm) # Case Based # Studi Kasus (10%)');
		expect(header).toMatchObject({ phase: 'UTS', weightPercent: 10, type: 'proyek', name: 'UTS - Case Based - Studi Kasus' });
	});

	test('"Komponen Lain" hanya penanda kategori dan tidak masuk nama', () => {
		const header = parseComponentHeader('# Komponen Lain # Keaktifan (10%)');
		expect(header).toMatchObject({ phase: null, weightPercent: 10, name: 'Keaktifan' });
	});

	test('label sederhana tanpa fase', () => {
		expect(parseComponentHeader('Poster Diri (25 %)')).toMatchObject({ phase: null, type: 'proyek', weightPercent: 25, name: 'Poster Diri' });
		expect(parseComponentHeader('Kehadiran (5 %)')).toMatchObject({ type: 'kehadiran', weightPercent: 5 });
		expect(parseComponentHeader('Kuis')).toMatchObject({ type: 'kuis', weightPercent: null });
	});

	test('kode dasar dari fase atau tipe', () => {
		expect(baseCodeFor(parseComponentHeader('UAS (15 %)'))).toBe('UAS');
		expect(baseCodeFor(parseComponentHeader('Kuis (20%)'))).toBe('KUIS');
	});

	test('inferensi tipe memprioritaskan kata yang paling spesifik', () => {
		expect(inferComponentType('Laporan Praktikum')).toBe('praktikum');
		expect(inferComponentType('Quiz 1')).toBe('kuis');
		expect(inferComponentType('Entah apa')).toBe('lainnya');
	});
});
