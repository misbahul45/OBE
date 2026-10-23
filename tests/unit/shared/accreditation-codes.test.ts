import { describe, expect, test } from 'bun:test';
import { graduateAttributeNames, knowledgeProfileNames, parseCodeList } from '#lib/shared/help/accreditation-codes.ts';

describe('parseCodeList', () => {
	test('menerima pemisah koma, titik koma, dan spasi serta menormalkan bentuk kode', () => {
		expect(parseCodeList('WA-2, wa6; WA 8  WA-1', 'WA')).toEqual({ codes: ['WA-1', 'WA-2', 'WA-6', 'WA-8'], invalid: [] });
		expect(parseCodeList('wk-3,WK4', 'WK')).toEqual({ codes: ['WK-3', 'WK-4'], invalid: [] });
	});

	test('membuang duplikat, mengurutkan secara numerik, dan melaporkan kode tidak valid', () => {
		expect(parseCodeList('WA-10, WA-2, WA-2, WA-13, X', 'WA')).toEqual({ codes: ['WA-2', 'WA-10'], invalid: ['WA-13', 'X'] });
		expect(parseCodeList('WK-9, WK-1', 'WK')).toEqual({ codes: ['WK-1'], invalid: ['WK-9'] });
	});

	test('kode dari jenis lain dianggap tidak valid dan teks kosong menghasilkan daftar kosong', () => {
		expect(parseCodeList('WK-1', 'WA')).toEqual({ codes: [], invalid: ['WK-1'] });
		expect(parseCodeList('  ', 'WA')).toEqual({ codes: [], invalid: [] });
	});

	test('nama baku tersedia untuk seluruh kode', () => {
		expect(Object.keys(graduateAttributeNames)).toHaveLength(12);
		expect(Object.keys(knowledgeProfileNames)).toHaveLength(8);
	});
});
