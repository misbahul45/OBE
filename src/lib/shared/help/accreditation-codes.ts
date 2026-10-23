export const graduateAttributeNames: Record<string, string> = {
	'WA-1': 'Engineering Knowledge',
	'WA-2': 'Problem Analysis',
	'WA-3': 'Design/Development of Solutions',
	'WA-4': 'Investigation',
	'WA-5': 'Modern Tool Usage',
	'WA-6': 'The Engineer and Society',
	'WA-7': 'Environment and Sustainability',
	'WA-8': 'Ethics',
	'WA-9': 'Individual and Team Work',
	'WA-10': 'Communication',
	'WA-11': 'Project Management and Finance',
	'WA-12': 'Lifelong Learning'
};

export const knowledgeProfileNames: Record<string, string> = {
	'WK-1': 'Natural Sciences',
	'WK-2': 'Mathematics',
	'WK-3': 'Engineering Fundamentals',
	'WK-4': 'Engineering Specialist Knowledge',
	'WK-5': 'Engineering Design',
	'WK-6': 'Engineering Practice',
	'WK-7': 'Comprehension',
	'WK-8': 'Research Literature'
};

export const attributeCodePattern = /^WA-(?:[1-9]|1[0-2])$/;
export const knowledgeCodePattern = /^WK-[1-8]$/;

export function parseCodeList(raw: string, kind: 'WA' | 'WK'): { codes: string[]; invalid: string[] } {
	const pattern = kind === 'WA' ? attributeCodePattern : knowledgeCodePattern;
	const tokens = raw
		.replace(/\b(wa|wk)\s*-?\s*(\d+)/gi, '$1-$2')
		.split(/[,;\s]+/)
		.map((token) => token.trim().toUpperCase())
		.filter(Boolean);
	const unique = [...new Set(tokens)];
	const invalid = unique.filter((token) => !pattern.test(token));
	const codes = unique.filter((token) => pattern.test(token)).sort((a, b) => Number(a.slice(3)) - Number(b.slice(3)));
	return { codes, invalid };
}
