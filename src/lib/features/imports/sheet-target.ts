export type SheetTarget = { nameKey: string; practical: boolean; section: string; cohortPrefix: string; bareTail: boolean; explicitSection: boolean };
export type ResolvedSheet = { course: CourseRef; section: string; explicitSection: boolean };
export type CourseRef = { code: string; name: string };

const nameAliases: Record<string, string> = {
	'pengantar teknik biomedis': 'TMA101',
	'metode penelitian': 'PNT497',
	'embeded sistem': 'FIA303'
};

const practicalPrefix = 'praktikum ';
const minimumPrefixLength = 14;

export const normalizeCourseName = (value: string) =>
	value
		.toLowerCase()
		.replace(/&/g, ' dan ')
		.replace(/\btek\./g, 'teknik')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();

export function parseSheetTarget(sheetName: string): SheetTarget {
	let text = sheetName.replace(/\s+/g, ' ').trim();
	let cohort: string | null = null;
	const leadingYear = /^(20\d{2})\s+/.exec(text);
	if (leadingYear) {
		cohort = leadingYear[1];
		text = text.slice(leadingYear[0].length);
	}
	const trailingYear = /\s+(20\d{2})$/.exec(text);
	if (trailingYear) {
		cohort = trailingYear[1];
		text = text.slice(0, trailingYear.index);
	}

	let practical = false;
	const prefix = /^prak(?:\.|tikum)?\s+/i.exec(text);
	if (prefix) {
		practical = true;
		text = text.slice(prefix[0].length);
	}
	const parenthetical = /\s*\(\s*(prakti\w*)?\)?$/i.exec(text);
	if (parenthetical) {
		practical = practical || Boolean(parenthetical[1]);
		text = text.slice(0, parenthetical.index);
	}

	const sectionMatch = /\s+T\s?(\d+)?$/i.exec(text);
	if (sectionMatch) text = text.slice(0, sectionMatch.index);
	const token = sectionMatch ? `T${sectionMatch[1] ?? ''}` : 'A';
	const cohortPrefix = cohort ? cohort.slice(2) : '';

	return { nameKey: normalizeCourseName(text), practical, section: `${cohortPrefix}${token}`, cohortPrefix, bareTail: Boolean(sectionMatch) && !sectionMatch?.[1], explicitSection: Boolean(sectionMatch) || cohort !== null };
}

export function matchSheetCourse(target: SheetTarget, courses: CourseRef[]): CourseRef | null {
	const distinct = [...new Map(courses.map((course) => [course.code, course])).values()];
	const pool = distinct
		.map((course) => ({ course, key: normalizeCourseName(course.name) }))
		.filter(({ key }) => key.startsWith(practicalPrefix) === target.practical)
		.map(({ course, key }) => ({ course, key: target.practical ? key.slice(practicalPrefix.length) : key }));

	const exact = pool.filter((entry) => entry.key === target.nameKey);
	if (exact.length === 1) return exact[0].course;

	const alias = nameAliases[target.nameKey];
	if (alias) return pool.find((entry) => entry.course.code === alias)?.course ?? null;

	if (target.nameKey.length >= minimumPrefixLength) {
		const truncated = pool.filter((entry) => entry.key.startsWith(target.nameKey));
		if (truncated.length === 1) return truncated[0].course;
	}
	return null;
}

const courseKey = (course: CourseRef, practical: boolean) => {
	const key = normalizeCourseName(course.name);
	return practical ? key.slice(practicalPrefix.length) : key;
};

export function resolveSheet(sheetName: string, courses: CourseRef[]): ResolvedSheet | null {
	const target = parseSheetTarget(sheetName);
	const course = matchSheetCourse(target, courses);
	if (!course) return null;
	const truncatedWord = target.bareTail && courseKey(course, target.practical).startsWith(`${target.nameKey} t`);
	return { course, section: truncatedWord ? `${target.cohortPrefix}A` : target.section, explicitSection: truncatedWord ? target.cohortPrefix !== '' : target.explicitSection };
}

export function pickOffering<T extends { courseCode: string; section: string }>(offerings: T[], resolved: ResolvedSheet): T | null {
	const sameCourse = offerings.filter((offering) => offering.courseCode === resolved.course.code);
	const exact = sameCourse.find((offering) => offering.section === resolved.section);
	if (exact) return exact;
	return !resolved.explicitSection && sameCourse.length === 1 ? sameCourse[0] : null;
}
