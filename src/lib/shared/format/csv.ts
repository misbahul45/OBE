const dangerousStart = /^[=+\-@\t\r]/;

export function neutralizeFormula(value: string): string {
	return dangerousStart.test(value) ? `'${value}` : value;
}

export function csvCell(value: unknown): string {
	if (value === null || value === undefined) return '';
	const text = neutralizeFormula(value instanceof Date ? value.toISOString() : String(value));
	return /[",\r\n;]/.test(text) || text.startsWith("'") ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: unknown[][]): string {
	const lines = [header.map(csvCell).join(','), ...rows.map((row) => row.map(csvCell).join(','))];
	return `﻿${lines.join('\r\n')}\r\n`;
}
