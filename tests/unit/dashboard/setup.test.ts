import { describe, expect, test } from 'bun:test';
import { buildSetupSteps, nextSetupStep, type SetupCounts } from '#lib/features/dashboard/dashboard.setup.ts';

const empty: SetupCounts = { cpl: 0, profiles: 0, semesterActive: false, courses: 0, offerings: 0, lecturers: 0, activePolicy: false, committedImports: 0 };
const complete: SetupCounts = { cpl: 8, profiles: 4, semesterActive: true, courses: 20, offerings: 5, lecturers: 3, activePolicy: true, committedImports: 2 };

describe('langkah persiapan data', () => {
	test('sistem kosong: tujuh langkah, semuanya belum selesai, langkah pertama berikutnya', () => {
		const steps = buildSetupSteps(empty);
		expect(steps).toHaveLength(7);
		expect(steps.every((step) => !step.done)).toBe(true);
		expect(nextSetupStep(steps)?.key).toBe('cpl');
	});

	test('semua terpenuhi: tidak ada langkah berikutnya', () => {
		const steps = buildSetupSteps(complete);
		expect(steps.every((step) => step.done)).toBe(true);
		expect(nextSetupStep(steps)).toBeNull();
	});

	test('langkah berikutnya mengikuti urutan alur kerja, bukan urutan data yang terisi', () => {
		expect(nextSetupStep(buildSetupSteps({ ...complete, semesterActive: false }))?.key).toBe('semester');
		expect(nextSetupStep(buildSetupSteps({ ...complete, committedImports: 0 }))?.key).toBe('imports');
		expect(nextSetupStep(buildSetupSteps({ ...empty, cpl: 8, profiles: 4 }))?.key).toBe('semester');
	});

	test('kelas tanpa dosen belum menyelesaikan langkah penawaran dan keterangannya menyebut sebabnya', () => {
		const step = buildSetupSteps({ ...complete, lecturers: 0 }).find((item) => item.key === 'offerings')!;
		expect(step.done).toBe(false);
		expect(step.detail).toContain('belum ada dosen');
	});

	test('setiap langkah punya tautan ke halaman admin dan keterangan tidak kosong', () => {
		for (const step of buildSetupSteps(empty)) {
			expect(step.href.startsWith('/app/admin/')).toBe(true);
			expect(step.detail.length).toBeGreaterThan(10);
			expect(step.actionLabel.length).toBeGreaterThan(3);
		}
	});
});
