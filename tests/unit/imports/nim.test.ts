import { describe, expect, test } from 'bun:test';
import { normalizeNim, normalizeNimNumber, normalizeNimText } from '#lib/features/imports/nim.ts';
import { bool, num, str } from '../../support/grid.ts';

describe('NIM bertipe angka', () => {
	test('angka bulat diformat sebagai digit utuh tanpa notasi ilmiah atau desimal', () => {
		expect(normalizeNimNumber(99012345678)).toEqual({ ok: true, nim: '99012345678', source: 'number' });
		expect(normalizeNim(num(99012345678.0))).toEqual({ ok: true, nim: '99012345678', source: 'number' });
		expect(normalizeNim(num(24012345))).toEqual({ ok: true, nim: '24012345', source: 'number' });
	});

	test('angka pecahan, negatif, terlalu pendek, atau terlalu panjang ditolak', () => {
		for (const value of [123456.5, -99012345678, 12345, 1234567890123456, Number.NaN, Infinity])
			expect(normalizeNimNumber(value)).toEqual({ ok: false, reason: 'NIM_INVALID_FORMAT' });
	});
});

describe('NIM bertipe teks', () => {
	test('nol di depan dipertahankan', () => {
		expect(normalizeNim(str('0012345678'))).toEqual({ ok: true, nim: '0012345678', source: 'string' });
	});

	test('spasi, spasi tak terlihat, apostrof awal, dan akhiran .0 dibersihkan', () => {
		expect(normalizeNimText('  99012345678 ')).toMatchObject({ ok: true, nim: '99012345678' });
		expect(normalizeNimText(' 99012345678​')).toMatchObject({ ok: true, nim: '99012345678' });
		expect(normalizeNimText("'0012345678")).toMatchObject({ ok: true, nim: '0012345678' });
		expect(normalizeNimText('99012345678.0')).toMatchObject({ ok: true, nim: '99012345678' });
		expect(normalizeNimText('99012345678.000')).toMatchObject({ ok: true, nim: '99012345678' });
	});

	test('notasi ilmiah hanya diterima bila seluruh digit dapat direkonstruksi', () => {
		expect(normalizeNimText('9.9012345678E+10')).toMatchObject({ ok: true, nim: '99012345678' });
		expect(normalizeNimText('9.9012345678e10')).toMatchObject({ ok: true, nim: '99012345678' });
		expect(normalizeNimText('9.90E+10')).toEqual({ ok: false, reason: 'NIM_SCIENTIFIC_AMBIGUOUS' });
		expect(normalizeNimText('1.5E-3')).toEqual({ ok: false, reason: 'NIM_INVALID_FORMAT' });
	});

	test('pemisah, huruf, dan panjang tidak valid ditolak tanpa menebak', () => {
		for (const text of ['99.012.345', '99-012-345', 'ABC12345', '12345', '1234567890123456', '9901 2345', '99012345x'])
			expect(normalizeNimText(text)).toEqual({ ok: false, reason: 'NIM_INVALID_FORMAT' });
	});
});

describe('NIM kosong atau bertipe lain', () => {
	test('kosong dikenali terpisah dari tidak valid', () => {
		for (const input of [undefined, null, str(''), str('   '), str("'")])
			expect(normalizeNim(input)).toEqual({ ok: false, reason: 'NIM_EMPTY' });
	});

	test('sel boolean tidak dianggap NIM', () => {
		expect(normalizeNim(bool(true))).toEqual({ ok: false, reason: 'NIM_INVALID_FORMAT' });
	});
});
