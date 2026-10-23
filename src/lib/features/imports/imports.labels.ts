import type { ColumnRole, ComponentType } from './imports.types.ts';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export const batchStatusLabel: Record<string, string> = {
	uploaded: 'Diunggah',
	mapped: 'Dipetakan',
	validated: 'Tervalidasi',
	committed: 'Tersimpan',
	failed: 'Gagal',
	cancelled: 'Dibatalkan'
};

export const batchStatusTone: Record<string, Tone> = {
	uploaded: 'info',
	mapped: 'info',
	validated: 'warning',
	committed: 'success',
	failed: 'danger',
	cancelled: 'neutral'
};

export const sheetStatusLabel: Record<string, string> = {
	pending: 'Menunggu',
	ready: 'Siap',
	excluded: 'Dikecualikan',
	committed: 'Tersimpan',
	failed: 'Gagal'
};

export const sheetStatusTone: Record<string, Tone> = {
	pending: 'neutral',
	ready: 'info',
	excluded: 'neutral',
	committed: 'success',
	failed: 'danger'
};

export const severityLabel = { error: 'Galat', warning: 'Peringatan', info: 'Info' } as const;
export const severityTone: Record<'error' | 'warning' | 'info', Tone> = { error: 'danger', warning: 'warning', info: 'info' };

export const mappingSourceLabel = { auto: 'Deteksi otomatis', preset: 'Preset tersimpan', manual: 'Pemetaan manual' } as const;

export const columnRoleLabel: Record<ColumnRole, string> = {
	no: 'Nomor',
	nim: 'NIM',
	name: 'Nama',
	component: 'Komponen',
	cpmk: 'CPMK referensi',
	cpl: 'CPL referensi',
	ignored: 'Diabaikan',
	metadata: 'Metadata'
};

export const confidenceLabel = { high: 'tinggi', medium: 'sedang', low: 'rendah' } as const;

export const componentTypeLabel: Record<ComponentType, string> = {
	uts: 'UTS',
	uas: 'UAS',
	tugas: 'Tugas',
	kuis: 'Kuis',
	proyek: 'Proyek',
	praktikum: 'Praktikum',
	kehadiran: 'Kehadiran',
	softskill: 'Soft skill',
	lainnya: 'Lainnya'
};

export const actionLabel = { insert: 'Baru', update: 'Diubah', unchanged: 'Sama' } as const;

export const columnChoiceOptions = [
	{ value: 'ignore', label: 'Abaikan' },
	{ value: 'component', label: 'Komponen nilai' },
	{ value: 'cpmk', label: 'CPMK referensi' },
	{ value: 'cpl', label: 'CPL referensi' }
];
