import { describe, expect, test } from 'bun:test';
import { programBlueprint } from '#lib/features/profiles/index.ts';
import { attributeCodePattern, knowledgeCodePattern } from '#lib/shared/help/accreditation-codes.ts';

const { cpl, profiles, fields, cplProfileLinks, profileFieldLinks } = programBlueprint;

describe('blueprint program studi', () => {
	test('memuat 8 CPL, 4 profil lulusan, dan 7 bidang kerja dengan kode unik', () => {
		expect(cpl).toHaveLength(8);
		expect(profiles).toHaveLength(4);
		expect(fields).toHaveLength(7);
		for (const list of [cpl, profiles, fields]) expect(new Set(list.map((item) => item.code)).size).toBe(list.length);
	});

	test('format kode sesuai batasan database', () => {
		for (const item of cpl) expect(item.code).toMatch(/^CPL-[0-9]+$/);
		for (const item of profiles) expect(item.code).toMatch(/^PL[0-9]+$/);
		for (const item of fields) expect(item.code).toMatch(/^BK[0-9]+$/);
	});

	test('atribut WA dan profil pengetahuan WK valid, terurut, dan tidak kosong', () => {
		for (const item of cpl) {
			expect(item.graduateAttributes.length, item.code).toBeGreaterThan(0);
			expect(item.knowledgeProfiles.length, item.code).toBeGreaterThan(0);
			for (const code of item.graduateAttributes) expect(code).toMatch(attributeCodePattern);
			for (const code of item.knowledgeProfiles) expect(code).toMatch(knowledgeCodePattern);
			const numbers = item.graduateAttributes.map((code) => Number(code.slice(3)));
			expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
		}
	});

	test('setiap tautan merujuk kode yang ada dan tidak ada pasangan ganda', () => {
		const cplCodes = new Set(cpl.map((item) => item.code));
		const profileCodes = new Set(profiles.map((item) => item.code));
		const fieldCodes = new Set(fields.map((item) => item.code));
		for (const link of cplProfileLinks) {
			expect(cplCodes.has(link.cpl), link.cpl).toBe(true);
			expect(profileCodes.has(link.profile), link.profile).toBe(true);
		}
		for (const link of profileFieldLinks) {
			expect(profileCodes.has(link.profile), link.profile).toBe(true);
			expect(fieldCodes.has(link.field), link.field).toBe(true);
			expect([1, 2, 3]).toContain(link.relevance);
		}
		expect(new Set(cplProfileLinks.map((l) => `${l.cpl}:${l.profile}`)).size).toBe(cplProfileLinks.length);
		expect(new Set(profileFieldLinks.map((l) => `${l.profile}:${l.field}`)).size).toBe(profileFieldLinks.length);
	});

	test('matriks CPL-profil sesuai dokumen: 8 tautan, CPL-1 belum terpetakan, CPL-6 melayani dua profil', () => {
		expect(cplProfileLinks).toHaveLength(8);
		const mapped = new Set(cplProfileLinks.map((link) => link.cpl));
		expect(cpl.filter((item) => !mapped.has(item.code)).map((item) => item.code)).toEqual(['CPL-1']);
		expect(cplProfileLinks.filter((link) => link.cpl === 'CPL-6').map((link) => link.profile).sort()).toEqual(['PL3', 'PL4']);
		for (const profile of profiles) expect(cplProfileLinks.some((link) => link.profile === profile.code), profile.code).toBe(true);
	});

	test('setiap bidang kerja punya tepat satu profil utama dan setiap profil punya bidang kerja', () => {
		for (const field of fields) {
			const primary = profileFieldLinks.filter((link) => link.field === field.code && link.relevance === 3);
			expect(primary, field.code).toHaveLength(1);
		}
		for (const profile of profiles) expect(profileFieldLinks.some((link) => link.profile === profile.code), profile.code).toBe(true);
	});

	test('teks CPL memakai kalimat penuh tanpa sisa penanda atau spasi ganda', () => {
		for (const item of cpl) {
			expect(item.title.length).toBeGreaterThan(20);
			expect(item.title).toBe(item.title.trim());
			expect(item.title).not.toMatch(/\s{2,}/);
			expect(item.title.length).toBeLessThanOrEqual(200);
		}
	});
});
