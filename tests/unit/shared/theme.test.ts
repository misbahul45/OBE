import { describe, expect, test } from 'bun:test';
import { nextToggleTarget, parseThemePreference, resolveTheme, themeLabels, themePreferences, themeStorageKey } from '#lib/shared/theme/theme.ts';
import { readFileSync } from 'node:fs';

describe('parseThemePreference', () => {
	test('hanya menerima terang, gelap, dan sistem; selain itu kembali ke sistem', () => {
		expect(parseThemePreference('light')).toBe('light');
		expect(parseThemePreference('dark')).toBe('dark');
		expect(parseThemePreference('system')).toBe('system');
		for (const value of [null, undefined, '', 'DARK', 'auto', 1, {}]) expect(parseThemePreference(value)).toBe('system');
	});
});

describe('resolveTheme', () => {
	test('sistem mengikuti preferensi perangkat, pilihan eksplisit mengabaikannya', () => {
		expect(resolveTheme('system', true)).toBe('dark');
		expect(resolveTheme('system', false)).toBe('light');
		expect(resolveTheme('light', true)).toBe('light');
		expect(resolveTheme('dark', false)).toBe('dark');
	});
});

describe('nextToggleTarget', () => {
	test('toggle selalu menuju lawan dari tema yang sedang tampil', () => {
		expect(nextToggleTarget('dark')).toBe('light');
		expect(nextToggleTarget('light')).toBe('dark');
	});
});

describe('label dan skrip awal', () => {
	test('setiap pilihan punya label berbahasa Indonesia', () => {
		expect(themePreferences.map((p) => themeLabels[p])).toEqual(['Terang', 'Gelap', 'Ikuti sistem']);
	});

	test('skrip awal membaca kunci penyimpanan yang sama dengan modul tema', () => {
		const script = readFileSync('static/theme-init.js', 'utf8');
		expect(script).toContain(`'${themeStorageKey}'`);
		expect(script).toContain('prefers-color-scheme: dark');
	});

	test('skrip awal dimuat dari aset sendiri agar lolos CSP script-src self', () => {
		const html = readFileSync('src/app.html', 'utf8');
		expect(html).toContain('%sveltekit.assets%/theme-init.js');
		expect(html.match(/<script(?![^>]*\bsrc=)[^>]*>/g) ?? []).toEqual([]);
	});
});
