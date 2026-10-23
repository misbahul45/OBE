import { describe, expect, test } from 'bun:test';
import { glossaryEntries, glossaryGroups } from '#lib/shared/help/glossary.ts';

describe('panduan istilah', () => {
	test('id entri unik dan berformat tautan jangkar yang aman', () => {
		const ids = glossaryEntries.map((entry) => entry.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
	});

	test('setiap entri dan kelompok memiliki teks lengkap', () => {
		for (const entry of glossaryEntries) {
			expect(entry.term.length, entry.id).toBeGreaterThan(1);
			expect(entry.expansion.length, entry.id).toBeGreaterThan(3);
			expect(entry.meaning.length, entry.id).toBeGreaterThan(30);
		}
		for (const group of glossaryGroups) expect(group.entries.length, group.id).toBeGreaterThan(0);
	});

	test('jangkar yang ditautkan dari aplikasi tersedia', () => {
		const ids = new Set(glossaryEntries.map((entry) => entry.id));
		for (const required of ['cpl', 'cpmk', 'wa', 'wk', 'kebijakan', 'status', 'validasi', 'cqi', 'bidang-kerja', 'profil-lulusan']) expect(ids.has(required), required).toBe(true);
	});

	test('istilah utama tercakup', () => {
		const terms = glossaryEntries.map((entry) => entry.term).join(' ');
		for (const word of ['CPL', 'CPMK', 'WA', 'WK', 'CQI', 'OBE']) expect(terms).toContain(word);
	});
});
