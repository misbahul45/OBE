import { describe, expect, test } from 'bun:test';
import { isDateFormat, parseDecimalText, parseScoreCell } from '#lib/features/imports/numbers.ts';
import { date, err, formula, num, str } from '../../support/grid.ts';

describe('parseScoreCell', () => {
	test('nol adalah nilai nyata dan berbeda dari kosong', () => {
		expect(parseScoreCell(num(0))).toEqual({ kind: 'value', value: 0 });
		expect(parseScoreCell(undefined)).toEqual({ kind: 'blank' });
		expect(parseScoreCell(str(''))).toEqual({ kind: 'blank' });
		expect(parseScoreCell(str('   '))).toEqual({ kind: 'blank' });
		expect(parseScoreCell(str('0'))).toEqual({ kind: 'value', value: 0 });
	});

	test('desimal koma dan titik pada teks diterima', () => {
		expect(parseScoreCell(str('87,5'))).toEqual({ kind: 'value', value: 87.5 });
		expect(parseScoreCell(str('87.5'))).toEqual({ kind: 'value', value: 87.5 });
		expect(parseScoreCell(num(57.14))).toEqual({ kind: 'value', value: 57.14 });
	});

	test('teks ambigu atau bukan angka ditolak', () => {
		for (const text of ['abc', '1.234,5', '87%', '8 7', '-', 'T', '87,5,1'])
			expect(parseScoreCell(str(text))).toEqual({ kind: 'invalid', reason: 'SCORE_NOT_NUMERIC' });
	});

	test('sel tanggal dan galat rumus ditandai terpisah', () => {
		expect(parseScoreCell(date(45000))).toEqual({ kind: 'invalid', reason: 'SCORE_DATE_FORMAT' });
		expect(parseScoreCell(err())).toEqual({ kind: 'invalid', reason: 'SCORE_FORMULA_ERROR' });
	});

	test('rumus tanpa cache tidak dipercaya, rumus dengan cache memakai nilai tersimpan', () => {
		expect(parseScoreCell(formula('A1+B1', null))).toEqual({ kind: 'no_cache' });
		expect(parseScoreCell(formula('A1+B1', num(80)))).toEqual({ kind: 'value', value: 80 });
		expect(parseScoreCell(formula('IFERROR(1/0,"")', str('')))).toEqual({ kind: 'blank' });
	});
});

describe('parseDecimalText', () => {
	test('hanya menerima satu pemisah desimal', () => {
		expect(parseDecimalText('12,5')).toBe(12.5);
		expect(parseDecimalText('-3.25')).toBe(-3.25);
		expect(parseDecimalText('.5')).toBe(0.5);
		expect(parseDecimalText('1,2,3')).toBeNull();
		expect(parseDecimalText('')).toBeNull();
	});
});

describe('isDateFormat', () => {
	test('mengenali format tanggal/waktu dan bukan format angka', () => {
		for (const format of ['dd/mm/yyyy', 'd-mmm-yy', 'h:mm', '[$-409]d-mmm', 'yyyy-mm-dd hh:mm:ss']) expect(isDateFormat(format)).toBe(true);
		for (const format of ['General', '0.00', '0.0%', '#,##0', '0.00E+00', null, undefined]) expect(isDateFormat(format)).toBe(false);
	});
});
