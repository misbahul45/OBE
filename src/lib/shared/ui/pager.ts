export type PageSlot = number | 'gap';

export function pageWindow(page: number, pageCount: number, siblings = 1): PageSlot[] {
	if (pageCount <= 1) return pageCount === 1 ? [1] : [];
	const current = Math.min(Math.max(1, page), pageCount);
	const wanted = new Set<number>([1, pageCount]);
	for (let p = current - siblings; p <= current + siblings; p++) if (p >= 1 && p <= pageCount) wanted.add(p);
	const sorted = [...wanted].sort((a, b) => a - b);
	const slots: PageSlot[] = [];
	sorted.forEach((p, i) => {
		const previous = sorted[i - 1];
		if (previous !== undefined && p - previous === 2) slots.push(previous + 1);
		else if (previous !== undefined && p - previous > 2) slots.push('gap');
		slots.push(p);
	});
	return slots;
}

export function pageRange(page: number, pageSize: number, shown: number, total: number): { from: number; to: number } {
	if (total === 0 || shown === 0) return { from: 0, to: 0 };
	const from = (page - 1) * pageSize + 1;
	return { from, to: from + shown - 1 };
}
