export const tracerDefaults = { alpha: 0.7, veryFit: 85, fit: 70, enough: 55, linearThreshold: 70 } as const;

export type FitCategory = 'Sangat Sesuai' | 'Sesuai' | 'Cukup Sesuai' | 'Kurang Sesuai';

export type CplInput = { code: string; value: number | null; target: number | null };
export type CplAchievement = { code: string; value: number | null; target: number | null; capaian: number | null; achieved: boolean | null; gap: number | null };
export type ProfileDef = { code: string; name: string; weights: Record<string, number> };
export type FieldDef = { code: string; name: string; profiles: Record<string, number> };
export type ProfileFit = { code: string; name: string; score: number | null; coverage: number | null; index: number | null; category: FitCategory | null; dataShare: number };
export type FieldFit = { code: string; name: string; weighted: number | null; gapBased: number | null; viaProfile: number | null };

const round = (value: number, digits = 4) => Math.round(value * 10 ** digits) / 10 ** digits;

export function cplAchievements(inputs: CplInput[]): CplAchievement[] {
	return inputs.map(({ code, value, target }) => {
		if (value === null || target === null || target <= 0) return { code, value, target, capaian: null, achieved: null, gap: null };
		return { code, value, target, capaian: round(Math.min(value / target, 1)), achieved: value >= target, gap: round(Math.max(0, target - value)) };
	});
}

export function fitCategory(index: number, options: Partial<Pick<typeof tracerDefaults, 'veryFit' | 'fit' | 'enough'>> = {}): FitCategory {
	const limits = { ...tracerDefaults, ...options };
	if (index >= limits.veryFit) return 'Sangat Sesuai';
	if (index >= limits.fit) return 'Sesuai';
	if (index >= limits.enough) return 'Cukup Sesuai';
	return 'Kurang Sesuai';
}

export function profileFits(profiles: ProfileDef[], achievements: CplAchievement[], options: { alpha?: number } = {}): ProfileFit[] {
	const alpha = options.alpha ?? tracerDefaults.alpha;
	const byCode = new Map(achievements.map((a) => [a.code, a]));
	return profiles.map((profile) => {
		const entries = Object.entries(profile.weights).filter(([, weight]) => weight > 0);
		const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
		const usable = entries.filter(([code]) => byCode.get(code)?.capaian != null);
		const usableTotal = usable.reduce((sum, [, weight]) => sum + weight, 0);
		const dataShare = total > 0 ? round(usableTotal / total) : 0;
		if (usableTotal === 0) return { code: profile.code, name: profile.name, score: null, coverage: null, index: null, category: null, dataShare };
		const score = (usable.reduce((sum, [code, weight]) => sum + weight * (byCode.get(code)!.capaian as number), 0) / usableTotal) * 100;
		const coverage = (usable.reduce((sum, [code, weight]) => sum + weight * (byCode.get(code)!.achieved ? 1 : 0), 0) / usableTotal) * 100;
		const index = alpha * score + (1 - alpha) * coverage;
		return { code: profile.code, name: profile.name, score: round(score, 2), coverage: round(coverage, 2), index: round(index, 2), category: fitCategory(index), dataShare };
	});
}

export function fieldFits(fields: FieldDef[], profiles: ProfileDef[], achievements: CplAchievement[], fits: ProfileFit[]): FieldFit[] {
	const fitByProfile = new Map(fits.map((f) => [f.code, f]));
	return fields.map((field) => {
		const importance = new Map<string, number>();
		for (const [profileCode, relevance] of Object.entries(field.profiles))
			for (const profile of profiles.filter((p) => p.code === profileCode))
				for (const [cplCode, weight] of Object.entries(profile.weights)) importance.set(cplCode, (importance.get(cplCode) ?? 0) + relevance * weight);

		let weightedNumerator = 0;
		let weightedDenominator = 0;
		let gapNumerator = 0;
		let gapDenominator = 0;
		for (const a of achievements) {
			const r = importance.get(a.code) ?? 0;
			if (r <= 0 || a.value === null || a.target === null || a.target <= 0) continue;
			weightedNumerator += r * Math.min(a.value / a.target, 1);
			weightedDenominator += r;
			gapNumerator += r * Math.max(0, a.target - a.value);
			gapDenominator += r * a.target;
		}

		let viaNumerator = 0;
		let viaDenominator = 0;
		for (const [profileCode, relevance] of Object.entries(field.profiles)) {
			const index = fitByProfile.get(profileCode)?.index;
			if (index == null || relevance <= 0) continue;
			viaNumerator += relevance * index;
			viaDenominator += relevance;
		}

		return {
			code: field.code,
			name: field.name,
			weighted: weightedDenominator > 0 ? round((weightedNumerator / weightedDenominator) * 100, 2) : null,
			gapBased: gapDenominator > 0 ? round((1 - gapNumerator / gapDenominator) * 100, 2) : null,
			viaProfile: viaDenominator > 0 ? round(viaNumerator / viaDenominator, 2) : null
		};
	});
}

export const isPredictedLinear = (fit: FieldFit | undefined, threshold: number = tracerDefaults.linearThreshold): boolean | null => (fit?.weighted == null ? null : fit.weighted >= threshold);

export function bestFields(fits: FieldFit[], limit = 3): FieldFit[] {
	return fits
		.filter((f) => f.weighted !== null)
		.sort((a, b) => (b.weighted as number) - (a.weighted as number) || a.code.localeCompare(b.code, 'en', { numeric: true }))
		.slice(0, limit);
}

export type LinearityRow = { predicted: boolean | null; actual: boolean | null };
export type LinearitySummary = {
	students: number;
	recorded: number;
	actualLinear: number;
	actualPercent: number | null;
	comparable: number;
	matrix: { predictedLinear: { actualLinear: number; actualNotLinear: number }; predictedNotLinear: { actualLinear: number; actualNotLinear: number } };
	agreementPercent: number | null;
};

export function linearitySummary(rows: LinearityRow[]): LinearitySummary {
	const recorded = rows.filter((r) => r.actual !== null);
	const comparable = recorded.filter((r) => r.predicted !== null);
	const count = (predicted: boolean, actual: boolean) => comparable.filter((r) => r.predicted === predicted && r.actual === actual).length;
	const matrix = {
		predictedLinear: { actualLinear: count(true, true), actualNotLinear: count(true, false) },
		predictedNotLinear: { actualLinear: count(false, true), actualNotLinear: count(false, false) }
	};
	const agreed = matrix.predictedLinear.actualLinear + matrix.predictedNotLinear.actualNotLinear;
	const actualLinear = recorded.filter((r) => r.actual === true).length;
	return {
		students: rows.length,
		recorded: recorded.length,
		actualLinear,
		actualPercent: recorded.length ? round((actualLinear / recorded.length) * 100, 1) : null,
		comparable: comparable.length,
		matrix,
		agreementPercent: comparable.length ? round((agreed / comparable.length) * 100, 1) : null
	};
}
