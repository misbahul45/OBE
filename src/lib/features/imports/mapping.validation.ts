import { z } from 'zod';
import { componentTypes } from '#lib/features/curriculum/index.ts';
import type { SheetMapping } from './imports.types.ts';

const column = z.number().int().min(0).max(199);

export const sheetMappingSchema = z
	.object({
		headerRow: z.number().int().min(1).max(5000),
		nimColumn: column,
		nameColumn: column.nullable(),
		firstDataRow: z.number().int().min(1).max(5001),
		components: z
			.array(
				z.object({
					column,
					code: z.string().trim().transform((v) => v.toUpperCase()).pipe(z.string().regex(/^[A-Z0-9-]{1,20}$/, 'Kode komponen 1-20 karakter huruf besar, angka, tanda hubung')),
					name: z.string().trim().min(1, 'Nama komponen wajib diisi').max(150),
					type: z.enum(componentTypes),
					weightPercent: z.number().min(0).max(100).nullable(),
					maxScore: z.number().gt(0).max(1000)
				})
			)
			.max(40),
		cpmkColumns: z.array(z.object({ column, code: z.string().regex(/^CPMK-\d{1,2}$/) })).max(20),
		cplColumns: z.array(z.object({ column, code: z.string().regex(/^CPL-\d{1,2}$/) })).max(20),
		excludedRows: z.array(z.number().int().min(1)).max(5000)
	})
	.superRefine((value, ctx) => {
		const seen = new Map<number, string>();
		const claim = (index: number, role: string, path: (string | number)[]) => {
			const previous = seen.get(index);
			if (previous) ctx.addIssue({ code: 'custom', path, message: `Kolom yang sama dipakai sebagai ${previous} dan ${role}` });
			seen.set(index, role);
		};
		claim(value.nimColumn, 'NIM', ['nimColumn']);
		if (value.nameColumn !== null) claim(value.nameColumn, 'nama', ['nameColumn']);
		value.components.forEach((c, i) => claim(c.column, `komponen ${c.code}`, ['components', i, 'column']));
		value.cpmkColumns.forEach((c, i) => claim(c.column, c.code, ['cpmkColumns', i, 'column']));
		value.cplColumns.forEach((c, i) => claim(c.column, c.code, ['cplColumns', i, 'column']));
		const codes = new Set<string>();
		value.components.forEach((c, i) => {
			if (codes.has(c.code)) ctx.addIssue({ code: 'custom', path: ['components', i, 'code'], message: `Kode komponen ${c.code} dipakai lebih dari sekali` });
			codes.add(c.code);
		});
		if (value.firstDataRow <= value.headerRow) ctx.addIssue({ code: 'custom', path: ['firstDataRow'], message: 'Baris data pertama harus setelah baris header' });
	});

export type ParsedSheetMapping = z.output<typeof sheetMappingSchema>;

export type MappingFormEntries = Record<string, string | undefined>;

export const columnRoleOptions = ['ignore', 'component', 'cpmk', 'cpl'] as const;
export type ColumnRoleChoice = (typeof columnRoleOptions)[number];

function numberOrNull(raw: string | undefined): number | null {
	if (raw === undefined || raw.trim() === '') return null;
	const value = Number(raw.trim().replace(',', '.'));
	return Number.isFinite(value) ? value : Number.NaN;
}

export function mappingFromForm(entries: MappingFormEntries, base: SheetMapping): SheetMapping {
	const components: SheetMapping['components'] = [];
	const cpmkColumns: SheetMapping['cpmkColumns'] = [];
	const cplColumns: SheetMapping['cplColumns'] = [];
	const indexes = Object.keys(entries)
		.map((key) => /^col_(\d+)_role$/.exec(key)?.[1])
		.filter((value): value is string => value !== undefined)
		.map(Number)
		.sort((a, b) => a - b);
	for (const index of indexes) {
		const role = entries[`col_${index}_role`] as ColumnRoleChoice | undefined;
		if (role === 'component') {
			components.push({
				column: index,
				code: (entries[`col_${index}_code`] ?? '').trim(),
				name: (entries[`col_${index}_name`] ?? '').trim(),
				type: (entries[`col_${index}_type`] ?? 'lainnya') as SheetMapping['components'][number]['type'],
				weightPercent: numberOrNull(entries[`col_${index}_weight`]),
				maxScore: numberOrNull(entries[`col_${index}_max`]) ?? 100
			});
		} else if (role === 'cpmk' || role === 'cpl') {
			const code = (entries[`col_${index}_code`] ?? '').trim().toUpperCase();
			(role === 'cpmk' ? cpmkColumns : cplColumns).push({ column: index, code });
		}
	}
	const headerRow = numberOrNull(entries.headerRow) ?? base.headerRow;
	return {
		headerRow,
		nimColumn: numberOrNull(entries.nimColumn) ?? base.nimColumn,
		nameColumn: entries.nameColumn === '' ? null : (numberOrNull(entries.nameColumn) ?? base.nameColumn),
		firstDataRow: numberOrNull(entries.firstDataRow) ?? headerRow + 1,
		components,
		cpmkColumns,
		cplColumns,
		excludedRows: (entries.excludedRows ?? '')
			.split(/[\s,;]+/)
			.filter(Boolean)
			.map(Number)
			.filter((n) => Number.isInteger(n) && n > 0)
	};
}
