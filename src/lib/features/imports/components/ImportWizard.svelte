<script lang="ts">
	import { enhance } from '$app/forms';
	import { LoaderCircle } from '@lucide/svelte';
	import { Alert, AlertDescription, AlertTitle } from '#lib/components/ui/alert/index.ts';
	import {
		AlertDialog,
		AlertDialogAction,
		AlertDialogCancel,
		AlertDialogContent,
		AlertDialogDescription,
		AlertDialogFooter,
		AlertDialogHeader,
		AlertDialogTitle,
		AlertDialogTrigger
	} from '#lib/components/ui/alert-dialog/index.ts';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.ts';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#lib/components/ui/card/index.ts';
	import ConfirmForm from '#lib/shared/ui/ConfirmForm.svelte';
	import FormMessage from '#lib/shared/ui/FormMessage.svelte';
	import NativeSelect from '#lib/shared/ui/NativeSelect.svelte';
	import type { FormState } from '#lib/shared/http/form-state.ts';
	import type { DryRunView, OfferingOption, WizardBatch } from '../imports.view.ts';
	import DryRunPanel from './DryRunPanel.svelte';
	import ImportSteps from './ImportSteps.svelte';
	import SheetCard from './SheetCard.svelte';

	type AutoMapForm = { mapped: number; created: number; semesterName: string; skipped: { sheet: string; reason: string }[] };
	type WizardForm = (NonNullable<FormState> & { sheet?: string; dryRun?: DryRunView; autoMap?: AutoMapForm }) | null | undefined;

	let { wizard, offerings, form, duplicate = false, canOpenClasses = false }: { wizard: WizardBatch; offerings: OfferingOption[]; form: WizardForm; duplicate?: boolean; canOpenClasses?: boolean } = $props();

	let running = $state<'validate' | 'commit' | null>(null);
	let confirmScore = $state(false);
	let confirmWeight = $state(false);

	let mapping = $state(false);
	const dryRun = $derived(form?.dryRun ?? null);
	const importable = $derived(wizard.sheets.filter((sheet) => sheet.hasMapping));
	const unmapped = $derived(importable.filter((sheet) => sheet.offeringId === null));
	const autoMap = $derived(form?.autoMap ?? null);
	const includedCount = $derived(wizard.sheets.filter((s) => s.include).length);
	const needsScoreConfirm = $derived((dryRun?.summary.scoresUpdated ?? 0) > 0);
	const needsWeightConfirm = $derived((dryRun?.summary.weightChanges ?? 0) > 0);
	const unresolved = $derived(
		(dryRun?.blockers ?? []).filter((b) => !(b.code === 'SCORE_UPDATES_UNCONFIRMED' && confirmScore) && !(b.code === 'WEIGHT_CHANGES_UNCONFIRMED' && confirmWeight))
	);
	const canCommit = $derived(dryRun !== null && unresolved.length === 0 && includedCount > 0);
	const strategyOptions = [
		{ value: 'upsert', label: 'Tambah baru dan perbarui yang berubah' },
		{ value: 'insert_missing', label: 'Hanya tambah data baru' }
	];
	const policyOptions = [
		{ value: 'block_on_error', label: 'Tahan semua bila ada baris galat' },
		{ value: 'skip_invalid_rows', label: 'Lewati baris galat' }
	];
	const shownError = $derived(form && !form.sheet && !form.dryRun ? form.message : null);
	const shownBlockers = $derived(form?.fieldErrors?.form ?? []);
</script>

<div class="space-y-8">
	{#if duplicate}
		<Alert role="status">
			<AlertTitle>Berkas identik pernah Anda impor</AlertTitle>
			<AlertDescription>Mengimpor ulang aman: nilai yang sama tidak diubah dan tidak ada data ganda. Nilai yang berbeda akan ditandai sebagai perubahan dan perlu konfirmasi.</AlertDescription>
		</Alert>
	{/if}

	{#if wizard.skipped.length}
		<Alert role="status">
			<AlertTitle>{wizard.skipped.length} sheet dilewati</AlertTitle>
			<AlertDescription>
				<ul class="list-disc pl-5">{#each wizard.skipped as skipped (skipped.name)}<li>{skipped.name}: {skipped.reason}</li>{/each}</ul>
			</AlertDescription>
		</Alert>
	{/if}

	<ImportSteps current={dryRun ? (canCommit ? 'commit' : 'validate') : 'configure'} />

	<section aria-labelledby="sheets-heading" class="space-y-4">
		<h2 id="sheets-heading" class="text-lg font-semibold">2. Atur sheet ({wizard.sheets.length})</h2>
		{#if unmapped.length > 0}
			<form
				method="POST"
				action="?/autoMap"
				use:enhance={() => {
					mapping = true;
					return async ({ update }) => {
						await update({ reset: false });
						mapping = false;
					};
				}}
				class="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-primary-soft p-4"
			>
				<div class="min-w-0 flex-1 basis-72">
					<p class="text-sm font-medium">{unmapped.length} dari {importable.length} sheet belum dipetakan ke kelas</p>
					<p class="text-xs text-secondary-foreground">
						Petakan otomatis mencocokkan nama sheet dengan mata kuliah pada semester aktif.
						{canOpenClasses ? 'Kelas yang belum dibuka akan dibuatkan.' : 'Hanya kelas yang ditugaskan kepada Anda yang dapat dipetakan.'}
					</p>
				</div>
				<Button type="submit" disabled={mapping} class="gap-2">
					{#if mapping}<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />Memetakan…{:else}Petakan otomatis{/if}
				</Button>
			</form>
		{/if}
		{#if autoMap}
			<Alert role="status">
				<AlertTitle>{autoMap.mapped} sheet dipetakan ke {autoMap.semesterName}{autoMap.created ? `, ${autoMap.created} kelas baru dibuka` : ''}</AlertTitle>
				{#if autoMap.skipped.length}
					<AlertDescription>
						<p class="mb-1">{autoMap.skipped.length} sheet perlu dipetakan manual:</p>
						<ul class="list-disc pl-5">{#each autoMap.skipped as skip (skip.sheet)}<li>{skip.sheet}: {skip.reason}</li>{/each}</ul>
					</AlertDescription>
				{/if}
			</Alert>
		{/if}
		{#each wizard.sheets as sheet (sheet.name)}
			<SheetCard {sheet} {offerings} {form} />
		{/each}
	</section>

	<section aria-labelledby="run-heading">
		<Card>
			<CardHeader>
				<CardTitle><h2 id="run-heading" class="text-lg font-semibold">3. Validasi dan 4. Simpan</h2></CardTitle>
				<CardDescription>Validasi menjalankan simulasi lengkap dan hanya mencatat daftar masalah. Data akademik baru berubah setelah Anda menekan Simpan.</CardDescription>
			</CardHeader>
			<CardContent class="space-y-6">
				<FormMessage message={shownError} success={form?.dryRun ? form.success : null} />
				{#if shownBlockers.length}
					<ul class="list-disc space-y-1 rounded-md border border-destructive/40 bg-destructive/5 p-3 pl-8 text-sm text-destructive" role="alert">
						{#each shownBlockers as blocker, i (i)}<li>{blocker}</li>{/each}
					</ul>
				{/if}

				<form
					id="run-form"
					method="POST"
					use:enhance={({ action }) => {
						running = action.search.includes('commit') ? 'commit' : 'validate';
						return async ({ update }) => {
							await update({ reset: false });
							running = null;
						};
					}}
					class="space-y-5"
				>
					<div class="grid gap-4 md:grid-cols-2">
						<div class="space-y-1.5">
							<label for="strategy" class="text-sm font-medium">Strategi penyimpanan</label>
							<NativeSelect id="strategy" name="strategy" options={strategyOptions} value={dryRun?.strategy ?? 'upsert'} />
						</div>
						<div class="space-y-1.5">
							<label for="errorPolicy" class="text-sm font-medium">Penanganan baris galat</label>
							<NativeSelect id="errorPolicy" name="errorPolicy" options={policyOptions} value={dryRun?.errorPolicy ?? 'block_on_error'} />
						</div>
					</div>

					{#if dryRun && (needsScoreConfirm || needsWeightConfirm)}
						<fieldset class="space-y-2 rounded-md border p-3">
							<legend class="px-1 text-sm font-medium">Konfirmasi perubahan</legend>
							{#if needsScoreConfirm}
								<label class="flex items-start gap-2 text-sm">
									<input type="checkbox" name="confirmScoreUpdates" bind:checked={confirmScore} class="mt-0.5 size-4 accent-primary" />
									<span>Saya memahami {dryRun.summary.scoresUpdated} nilai yang sudah ada akan diubah. Nilai lama tersimpan di riwayat revisi.</span>
								</label>
							{/if}
							{#if needsWeightConfirm}
								<label class="flex items-start gap-2 text-sm">
									<input type="checkbox" name="confirmWeightChanges" bind:checked={confirmWeight} class="mt-0.5 size-4 accent-primary" />
									<span>Saya memahami bobot {dryRun.summary.weightChanges} komponen akan berubah dan hasil CPMK/CPL kelas dihitung ulang.</span>
								</label>
							{/if}
						</fieldset>
					{/if}

					<div class="flex flex-wrap items-center gap-3">
						<Button type="submit" formaction="?/dryRun" variant="secondary" disabled={running !== null || includedCount === 0} class="gap-2">
							{#if running === 'validate'}<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />Memvalidasi…{:else}Jalankan validasi{/if}
						</Button>

						<AlertDialog>
							<AlertDialogTrigger type="button" disabled={!canCommit || running !== null} class={buttonVariants({ variant: 'default' })}>
								{#if running === 'commit'}<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />Menyimpan…{:else}Simpan ke database{/if}
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>Simpan hasil impor?</AlertDialogTitle>
									<AlertDialogDescription>
										{#if dryRun}
											{dryRun.summary.studentsNew} mahasiswa baru, {dryRun.summary.scoresNew} nilai baru, dan {dryRun.summary.scoresUpdated} nilai diubah akan disimpan dalam satu transaksi. Bila terjadi galat, tidak ada yang tersimpan sebagian.
										{/if}
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>Periksa lagi</AlertDialogCancel>
									<AlertDialogAction type="submit" form="run-form" formaction="?/commit">Ya, simpan</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
						{#if dryRun === null}<span class="text-sm text-muted-foreground">Jalankan validasi terlebih dahulu untuk mengaktifkan tombol simpan.</span>{/if}
					</div>
				</form>

				{#if dryRun}<DryRunPanel result={dryRun} />{/if}
			</CardContent>
		</Card>
	</section>

	<div class="flex justify-end">
		<ConfirmForm action="?/cancel" triggerLabel="Batalkan impor ini" tone="destructive" title="Batalkan impor?" description="Berkas sementara dihapus dan batch ditandai dibatalkan. Tidak ada data nilai yang berubah." confirmLabel="Batalkan impor" />
	</div>
</div>
