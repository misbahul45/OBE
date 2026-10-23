import type { CqiActionStatus, CqiStatus } from './cqi.workflow.ts';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export const statusTone: Record<CqiStatus, Tone> = {
	open: 'info',
	analysis: 'info',
	planned: 'warning',
	in_progress: 'warning',
	evaluating: 'warning',
	closed: 'success',
	cancelled: 'neutral'
};

export const actionStatusTone: Record<CqiActionStatus, Tone> = {
	planned: 'neutral',
	in_progress: 'info',
	done: 'success',
	cancelled: 'neutral'
};

export const priorityTone: Record<string, Tone> = { low: 'neutral', medium: 'info', high: 'warning', critical: 'danger' };
