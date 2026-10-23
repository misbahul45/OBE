import { describe, expect, test } from 'bun:test';
import { csvCell, neutralizeFormula, toCsv } from '#lib/shared/format/csv.ts';

describe('neutralizeFormula', () => {
	test('awalan pemicu rumus Excel dinetralkan dengan apostrof', () => {
		for (const payload of ['=1+1', '+SUM(A1)', '-2+3', '@HYPERLINK("http://x")', '\t=cmd', '\r=cmd', '=cmd|" /C calc"!A0'])
			expect(neutralizeFormula(payload).startsWith("'")).toBe(true);
	});

	test('teks biasa dan angka negatif sebagai nilai bertipe angka tidak diubah', () => {
		expect(neutralizeFormula('Mahasiswa Uji 001')).toBe('Mahasiswa Uji 001');
		expect(neutralizeFormula('85,5')).toBe('85,5');
		expect(neutralizeFormula('')).toBe('');
	});
});

describe('csvCell', () => {
	test('kutip, koma, titik koma, dan baris baru dibungkus dan diloloskan', () => {
		expect(csvCell('a,b')).toBe('"a,b"');
		expect(csvCell('katanya "ok"')).toBe('"katanya ""ok"""');
		expect(csvCell('baris1\nbaris2')).toBe('"baris1\nbaris2"');
		expect(csvCell('a;b')).toBe('"a;b"');
	});

	test('payload rumus ditetralkan lalu dikutip agar apostrof terbaca sebagai teks', () => {
		expect(csvCell('=1+1')).toBe('"\'=1+1"');
		expect(csvCell('@SUM(1)')).toBe('"\'@SUM(1)"');
	});

	test('null, undefined, angka, boolean, dan tanggal', () => {
		expect(csvCell(null)).toBe('');
		expect(csvCell(undefined)).toBe('');
		expect(csvCell(0)).toBe('0');
		expect(csvCell(true)).toBe('true');
		expect(csvCell(new Date('2026-01-02T03:04:05Z'))).toBe('2026-01-02T03:04:05.000Z');
	});
});

describe('toCsv', () => {
	test('menyertakan BOM UTF-8, header, dan akhir baris CRLF', () => {
		const csv = toCsv(['Sheet', 'Pesan'], [['Pancasila', 'NIM kosong'], ['A', '=BAHAYA()']]);
		expect(csv.startsWith('﻿Sheet,Pesan\r\n')).toBe(true);
		expect(csv).toContain('Pancasila,NIM kosong\r\n');
		expect(csv).toContain("A,\"'=BAHAYA()\"\r\n");
		expect(csv.endsWith('\r\n')).toBe(true);
	});

	test('header ikut dinetralkan', () => {
		expect(toCsv(['=x'], [])).toContain("\"'=x\"");
	});
});
