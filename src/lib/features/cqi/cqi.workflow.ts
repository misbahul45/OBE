export const cqiStatuses = ['open', 'analysis', 'planned', 'in_progress', 'evaluating', 'closed', 'cancelled'] as const;
export type CqiStatus = (typeof cqiStatuses)[number];

export const cqiActionStatuses = ['planned', 'in_progress', 'done', 'cancelled'] as const;
export type CqiActionStatus = (typeof cqiActionStatuses)[number];

export const statusLabels: Record<CqiStatus, string> = {
	open: 'Temuan baru',
	analysis: 'Analisis akar masalah',
	planned: 'Rencana tindakan',
	in_progress: 'Tindakan berjalan',
	evaluating: 'Evaluasi',
	closed: 'Selesai',
	cancelled: 'Dibatalkan'
};

export const actionStatusLabels: Record<CqiActionStatus, string> = {
	planned: 'Direncanakan',
	in_progress: 'Berjalan',
	done: 'Selesai',
	cancelled: 'Dibatalkan'
};

const transitions: Record<CqiStatus, CqiStatus[]> = {
	open: ['analysis', 'cancelled'],
	analysis: ['planned', 'open', 'cancelled'],
	planned: ['in_progress', 'analysis', 'cancelled'],
	in_progress: ['evaluating', 'planned', 'cancelled'],
	evaluating: ['closed', 'in_progress', 'cancelled'],
	closed: [],
	cancelled: []
};

const actionTransitions: Record<CqiActionStatus, CqiActionStatus[]> = {
	planned: ['in_progress', 'done', 'cancelled'],
	in_progress: ['done', 'planned', 'cancelled'],
	done: [],
	cancelled: []
};

export const isFinal = (status: CqiStatus) => transitions[status].length === 0;

export const allowedTransitions = (from: CqiStatus): CqiStatus[] => transitions[from];

export const canTransition = (from: CqiStatus, to: CqiStatus) => transitions[from].includes(to);

export const canActionTransition = (from: CqiActionStatus, to: CqiActionStatus) => actionTransitions[from].includes(to);

export const allowedActionTransitions = (from: CqiActionStatus): CqiActionStatus[] => actionTransitions[from];

export type TransitionContext = {
	rootCause: string | null;
	actions: { status: CqiActionStatus }[];
	evidenceCount: number;
	evaluationCount: number;
};

export function transitionBlockers(from: CqiStatus, to: CqiStatus, context: TransitionContext): string[] {
	if (!canTransition(from, to)) return [`Status tidak dapat berpindah dari "${statusLabels[from]}" ke "${statusLabels[to]}".`];
	const blockers: string[] = [];
	const live = context.actions.filter((a) => a.status !== 'cancelled');
	if (to === 'planned' && from === 'analysis' && !context.rootCause?.trim()) blockers.push('Isi akar masalah sebelum menyusun rencana tindakan.');
	if (to === 'in_progress' && from === 'planned' && live.length === 0) blockers.push('Tambahkan minimal satu tindakan perbaikan sebelum memulai.');
	if (to === 'evaluating') {
		if (live.some((a) => a.status !== 'done')) blockers.push('Selesaikan atau batalkan seluruh tindakan sebelum evaluasi.');
		if (!live.some((a) => a.status === 'done')) blockers.push('Minimal satu tindakan harus berstatus selesai sebelum evaluasi.');
	}
	if (to === 'closed') {
		if (context.evaluationCount === 0) blockers.push('Catat minimal satu evaluasi dampak sebelum menutup temuan.');
		if (context.evidenceCount === 0) blockers.push('Lampirkan minimal satu bukti tindak lanjut sebelum menutup temuan.');
	}
	return blockers;
}
