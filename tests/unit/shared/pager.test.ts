import { describe, expect, test } from 'bun:test';
import { pageRange, pageWindow } from '#lib/shared/ui/pager.ts';
import { highlightParts, parseDirection, parsePageSize, parseSort, searchTokens } from '#lib/features/students/students.search.ts';

describe('pageWindow', () => {
	test('halaman pendek ditampilkan utuh tanpa titik-titik', () => {
		expect(pageWindow(1, 1)).toEqual([1]);
		expect(pageWindow(2, 5)).toEqual([1, 2, 3, 4, 5]);
		expect(pageWindow(1, 0)).toEqual([]);
	});

	test('halaman panjang menjaga halaman pertama, terakhir, dan tetangga halaman aktif', () => {
		expect(pageWindow(1, 20)).toEqual([1, 2, 'gap', 20]);
		expect(pageWindow(10, 20)).toEqual([1, 'gap', 9, 10, 11, 'gap', 20]);
		expect(pageWindow(20, 20)).toEqual([1, 'gap', 19, 20]);
		expect(pageWindow(4, 20)).toEqual([1, 2, 3, 4, 5, 'gap', 20]);
	});

	test('celah satu halaman diganti nomor halamannya, bukan titik-titik', () => {
		expect(pageWindow(5, 9)).toEqual([1, 'gap', 4, 5, 6, 'gap', 9]);
		expect(pageWindow(3, 9)).toEqual([1, 2, 3, 4, 'gap', 9]);
	});

	test('halaman di luar jangkauan dipangkas dan nomor tidak pernah berulang', () => {
		const slots = pageWindow(99, 10).filter((s): s is number => s !== 'gap');
		expect(new Set(slots).size).toBe(slots.length);
		expect(slots.at(-1)).toBe(10);
	});
});

describe('pageRange', () => {
	test('rentang tampil menghitung dari halaman dan jumlah baris yang tampil', () => {
		expect(pageRange(2, 20, 20, 471)).toEqual({ from: 21, to: 40 });
		expect(pageRange(24, 20, 11, 471)).toEqual({ from: 461, to: 471 });
		expect(pageRange(1, 20, 0, 0)).toEqual({ from: 0, to: 0 });
	});
});

describe('pencarian mahasiswa: token dan sorotan', () => {
	test('searchTokens memecah, merapikan huruf, membuang duplikat, dan membatasi jumlah', () => {
		expect(searchTokens('  Budi   SANTOSO budi ')).toEqual(['budi', 'santoso']);
		expect(searchTokens('')).toEqual([]);
		expect(searchTokens(undefined)).toEqual([]);
		expect(searchTokens('a b c d e f g h')).toHaveLength(6);
	});

	test('highlightParts menandai setiap kemunculan tanpa peka huruf dan tanpa kehilangan teks', () => {
		const parts = highlightParts('Budi Santoso', ['bud', 'oso']);
		expect(parts).toEqual([{ text: 'Bud', match: true }, { text: 'i Sant', match: false }, { text: 'oso', match: true }]);
		expect(parts.map((p) => p.text).join('')).toBe('Budi Santoso');
		expect(highlightParts('Budi', [])).toEqual([{ text: 'Budi', match: false }]);
		expect(highlightParts('', ['a'])).toEqual([{ text: '', match: false }]);
	});

	test('parameter urutan dan ukuran halaman hanya menerima nilai yang diizinkan', () => {
		expect(parseSort('nim')).toBe('nim');
		expect(parseSort('drop table')).toBeUndefined();
		expect(parseDirection('turun')).toBe('turun');
		expect(parseDirection('x')).toBeUndefined();
		expect(parsePageSize('50')).toBe(50);
		expect(parsePageSize('7')).toBe(20);
		expect(parsePageSize(null)).toBe(20);
	});
});
