import { eq, sql } from 'drizzle-orm';
import type { DbExecutor } from '#lib/shared/db/client.server.ts';
import { cplDefinitions } from '#lib/features/curriculum/curriculum.schema.ts';
import { loadActivePolicy } from '#lib/features/outcomes/index.server.ts';
import { getProgramBlueprint } from '#lib/features/profiles/index.server.ts';
import { careerFields } from '#lib/features/profiles/profiles.schema.ts';
import { students } from '#lib/features/students/students.schema.ts';
import {
	bestFields,
	cplAchievements,
	fieldFits,
	isPredictedLinear,
	linearitySummary,
	profileFits,
	tracerDefaults,
	type FieldDef,
	type FieldFit,
	type ProfileDef
} from './tracer.calc.ts';
import { tracerRecords } from './tracer.schema.ts';
import { keeratanValues, type FieldStat, type Keeratan, type TracerOverview, type TracerRow, type TracerStatusFilter } from './tracer.types.ts';

export const tracerPageSizes = [10, 20, 50, 100] as const;

export type TracerFilters = { search?: string; status?: TracerStatusFilter; page?: number; pageSize?: number };

const round1 = (value: number) => Math.round(value * 10) / 10;

async function loadTargets(db: DbExecutor): Promise<{ byCode: Map<string, number>; source: 'policy' | 'excel' | null }> {
	const policy = await loadActivePolicy(db);
	const cpl = await db.select({ id: cplDefinitions.id, code: cplDefinitions.code }).from(cplDefinitions);
	const excel = (await db.execute(sql`
		select (mapping->'blueprint'->'thresholds'->>'studentScore')::float8 as score, count(*)::int as n
		from import_sheet_mappings
		where status = 'committed' and jsonb_exists(mapping, 'blueprint') and mapping->'blueprint'->'thresholds'->>'studentScore' is not null
		group by 1 order by n desc, score desc limit 1`)) as unknown as { score: number }[];
	const excelScore = excel[0]?.score ?? null;
	const byCode = new Map<string, number>();
	let source: 'policy' | 'excel' | null = null;
	for (const row of cpl) {
		const fromPolicy = policy?.targets[row.id];
		if (fromPolicy !== undefined) {
			byCode.set(row.code, fromPolicy);
			source = 'policy';
		} else if (excelScore !== null) {
			byCode.set(row.code, excelScore);
			source ??= 'excel';
		}
	}
	return { byCode, source };
}

export async function getTracerOverview(db: DbExecutor, filters: TracerFilters = {}): Promise<TracerOverview> {
	const pageSize = tracerPageSizes.find((size) => size === filters.pageSize) ?? 20;
	const blueprint = await getProgramBlueprint(db);
	const profiles: ProfileDef[] = blueprint.profiles.map((p) => ({ code: p.code, name: p.name, weights: Object.fromEntries(p.cpl.map((c) => [c.code, 1])) }));
	const fieldDefs: FieldDef[] = blueprint.fields.map((f) => ({ code: f.code, name: f.name, profiles: Object.fromEntries(f.profiles.map((p) => [p.code, p.relevance])) }));
	const { byCode: targets, source } = await loadTargets(db);

	const [people, valueRows, recordRows] = await Promise.all([
		db.select({ id: students.id, nim: students.nim, name: students.name, cohortYear: students.cohortYear }).from(students),
		db.execute(sql`
			select e.student_id as "studentId", d.code as "cplCode",
				coalesce(avg(r.value) filter (where r.source = 'calculated' and r.completeness = 'complete'), avg(r.value) filter (where r.source = 'imported_reference'))::float8 as value
			from cpl_results r
			join enrollments e on e.id = r.enrollment_id
			join cpl_definitions d on d.id = r.cpl_id
			where r.value is not null
			group by e.student_id, d.code`) as unknown as Promise<{ studentId: string; cplCode: string; value: number | null }[]>,
		db
			.select({ studentId: tracerRecords.studentId, isLinear: tracerRecords.isLinear, keeratan: tracerRecords.keeratan, note: tracerRecords.note, careerFieldCode: careerFields.code })
			.from(tracerRecords)
			.leftJoin(careerFields, eq(careerFields.id, tracerRecords.careerFieldId))
	]);

	const valuesByStudent = new Map<string, Map<string, number>>();
	for (const row of valueRows) {
		if (row.value === null) continue;
		const bucket = valuesByStudent.get(row.studentId) ?? new Map<string, number>();
		bucket.set(row.cplCode, row.value);
		valuesByStudent.set(row.studentId, bucket);
	}
	const recordByStudent = new Map(recordRows.map((r) => [r.studentId, r]));
	const cplCodes = [...new Set([...targets.keys(), ...valueRows.map((r) => r.cplCode)])];
	const fieldCodeName = new Map(fieldDefs.map((f) => [f.code, f.name]));

	type Computed = TracerRow & { fits: FieldFit[] };
	const computed: Computed[] = people.map((person) => {
		const values = valuesByStudent.get(person.id) ?? new Map<string, number>();
		const achievements = cplAchievements(cplCodes.map((code) => ({ code, value: values.get(code) ?? null, target: targets.get(code) ?? null })));
		const fits = profileFits(profiles, achievements);
		const fieldResults = fieldFits(fieldDefs, profiles, achievements, fits);
		const best = bestFields(fieldResults, 3);
		const topProfile = fits.filter((f) => f.index !== null).sort((a, b) => (b.index as number) - (a.index as number))[0] ?? null;
		const stored = recordByStudent.get(person.id);
		const fieldFit = stored?.careerFieldCode ? fieldResults.find((f) => f.code === stored.careerFieldCode) : undefined;
		return {
			studentId: person.id,
			nim: person.nim,
			name: person.name,
			cohortYear: person.cohortYear,
			cplWithData: achievements.filter((a) => a.capaian !== null).length,
			bestFields: best.map((f) => ({ code: f.code, name: f.name, fit: f.weighted as number })),
			bestProfile: topProfile && topProfile.category ? { code: topProfile.code, name: topProfile.name, index: topProfile.index as number, category: topProfile.category } : null,
			predictedLinear: best[0] ? (best[0].weighted as number) >= tracerDefaults.linearThreshold : null,
			record: stored
				? { isLinear: stored.isLinear, careerFieldCode: stored.careerFieldCode, keeratan: stored.keeratan, note: stored.note, predictedForField: isPredictedLinear(fieldFit), fieldFit: fieldFit?.weighted ?? null }
				: null,
			fits: fieldResults
		};
	});

	const summary = linearitySummary(computed.map((row) => ({ predicted: row.record?.predictedForField ?? null, actual: row.record?.isLinear ?? null })));
	const assessed = computed.filter((row) => row.predictedLinear !== null);
	const predictedLinear = assessed.filter((row) => row.predictedLinear === true).length;

	const fieldStats: FieldStat[] = fieldDefs.map((field) => {
		const fitsOfField = computed.map((row) => row.fits.find((f) => f.code === field.code)?.weighted ?? null).filter((v): v is number => v !== null);
		const recordedHere = computed.filter((row) => row.record?.careerFieldCode === field.code);
		return {
			code: field.code,
			name: field.name,
			students: fitsOfField.length,
			predictedLinear: fitsOfField.filter((v) => v >= tracerDefaults.linearThreshold).length,
			predictedNotLinear: fitsOfField.filter((v) => v < tracerDefaults.linearThreshold).length,
			meanFit: fitsOfField.length ? round1(fitsOfField.reduce((s, v) => s + v, 0) / fitsOfField.length) : null,
			recordedLinear: recordedHere.filter((row) => row.record?.isLinear === true).length,
			recordedNotLinear: recordedHere.filter((row) => row.record?.isLinear === false).length
		};
	});

	const tokens = (filters.search ?? '').toLowerCase().split(/\s+/).filter(Boolean);
	const filtered = computed
		.filter((row) => tokens.every((token) => row.name.toLowerCase().includes(token) || row.nim.toLowerCase().includes(token)))
		.filter((row) => (filters.status === 'belum' ? row.record === null : filters.status === 'linear' ? row.record?.isLinear === true : filters.status === 'tidak' ? row.record?.isLinear === false : true))
		.sort((a, b) => a.name.localeCompare(b.name, 'id') || a.nim.localeCompare(b.nim));
	const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
	const page = Math.min(Math.max(1, Math.trunc(filters.page ?? 1)), pageCount);
	const rows: TracerRow[] = filtered.slice((page - 1) * pageSize, page * pageSize).map(({ fits: _fits, ...row }) => {
		void _fits;
		return row;
	});

	const keeratanCounts = keeratanValues.map((value: Keeratan) => ({ value, count: recordRows.filter((r) => r.keeratan === value).length }));

	return {
		predicted: { assessed: assessed.length, linear: predictedLinear, notLinear: assessed.length - predictedLinear, notAssessable: computed.length - assessed.length, linearPercent: assessed.length ? round1((predictedLinear / assessed.length) * 100) : null },
		fieldStats,
		parameters: { alpha: tracerDefaults.alpha, linearThreshold: tracerDefaults.linearThreshold, veryFit: tracerDefaults.veryFit, fit: tracerDefaults.fit, enough: tracerDefaults.enough },
		rows,
		total: filtered.length,
		page,
		pageSize,
		pageCount,
		summary,
		keeratanCounts,
		fields: [...fieldCodeName.entries()].map(([code, name]) => ({ code, name })),
		threshold: tracerDefaults.linearThreshold,
		targetSource: source,
		ready: source !== null
	};
}
