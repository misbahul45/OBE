<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Card, CardContent, CardHeader, CardTitle } from '#lib/components/ui/card/index.ts';
	import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#lib/components/ui/table/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { errorsOf, type FormState } from '#lib/shared/http/form-state.ts';
	import Field from '#lib/shared/ui/Field.svelte';
	import { focusableWhenScrollable } from '#lib/shared/ui/focusable-scroll.ts';
	import FormMessage from '#lib/shared/ui/FormMessage.svelte';
	import NativeSelect from '#lib/shared/ui/NativeSelect.svelte';
	import StatusBadge from '#lib/shared/ui/StatusBadge.svelte';
	import { mappingSourceLabel, severityLabel, severityTone } from '../imports.labels.ts';
	import type { OfferingOption, WizardSheet } from '../imports.view.ts';
	import MappingEditor from './MappingEditor.svelte';

	type SheetForm = (NonNullable<FormState> & { sheet?: string }) | null | undefined;

	let { sheet, offerings, form }: { sheet: WizardSheet; offerings: OfferingOption[]; form: SheetForm } = $props();

	const mine = $derived(form?.sheet === sheet.name ? form : null);
	const idOf = (name: string) => `${sheet.name.replace(/\W+/g, '-')}-${name}`;
	const offeringOptions = $derived(offerings.map((o) => ({ value: o.id, label: o.label })));
	const weightOk = $derived(sheet.weightsTotalPercent !== null && Math.abs(sheet.weightsTotalPercent - 100) <= 0.5);
	const mappingErrors = $derived(Object.fromEntries(Object.entries(mine?.fieldErrors ?? {}).filter(([key]) => key !== 'offeringId' && key !== 'headerRow')));
</script>

<Card data-sheet={sheet.name}>
	<CardHeader>
		<CardTitle class="flex flex-wrap items-center gap-2">
			<h3 class="text-base font-semibold">{sheet.name}</h3>
			<StatusBadge status={sheet.source === 'manual' ? 'info' : sheet.source === 'preset' ? 'success' : 'neutral'} label={mappingSourceLabel[sheet.source]} />
			{#if sheet.hasMapping}
				<StatusBadge status="neutral" label={`${sheet.studentRowCount} mahasiswa`} />
				{#if sheet.weightsTotalPercent !== null}
					<StatusBadge status={weightOk ? 'success' : 'warning'} label={`Total bobot ${sheet.weightsTotalPercent}%`} />
				{:else}
					<StatusBadge status="warning" label="Bobot belum terbaca" />
				{/if}
			{:else}
				<StatusBadge status="danger" label="Header belum ditemukan" />
			{/if}
		</CardTitle>
		{#if sheet.hint}<p class="text-sm text-muted-foreground">Petunjuk dari berkas: {sheet.hint}</p>{/if}
	</CardHeader>
	<CardContent class="space-y-5">
		<FormMessage message={mine?.message} success={mine?.success} />

		<form method="POST" action="?/saveSheet" use:enhance={() => async ({ update }) => update({ reset: false })} class="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
			<input type="hidden" name="sheetName" value={sheet.name} />
			<div class="space-y-4">
				<Field id={idOf('offeringId')} label="Kelas tujuan" errors={errorsOf(mine, 'offeringId')} hint="Pilih kelas semester aktif yang akan menerima nilai dari sheet ini.">
					{#snippet children({ describedBy, invalid })}
						<NativeSelect id={idOf('offeringId')} name="offeringId" options={offeringOptions} value={sheet.offeringId ?? ''} placeholder="Pilih kelas" {invalid} {describedBy} />
					{/snippet}
				</Field>
				<label class="flex items-center gap-2 text-sm">
					<input type="checkbox" name="include" checked={sheet.include} disabled={!sheet.hasMapping} class="size-4 accent-primary" />
					Sertakan sheet ini dalam impor
				</label>
				{#if sheet.numericNim}
					<label class="flex items-start gap-2 text-sm">
						<input type="checkbox" name="numericNim" checked={sheet.numericNimAcknowledged} class="mt-0.5 size-4 accent-primary" />
						<span>NIM pada sheet ini tersimpan sebagai angka. Saya memastikan tidak ada NIM yang diawali angka 0 yang hilang.</span>
					</label>
				{/if}
			</div>
			<Button type="submit" variant="secondary">Simpan pengaturan sheet</Button>
		</form>

		{#if sheet.notes.length}
			<ul class="space-y-1.5" aria-label="Catatan hasil deteksi">
				{#each sheet.notes as note, i (i)}
					<li class="flex items-start gap-2 text-sm"><StatusBadge status={severityTone[note.severity]} label={severityLabel[note.severity]} /><span>{note.message}</span></li>
				{/each}
			</ul>
		{/if}

		<details class="rounded-md border">
			<summary class="cursor-pointer px-3 py-2 text-sm font-medium">Pratinjau berkas (NIM disamarkan)</summary>
			<div class="max-h-96 overflow-auto border-t" use:focusableWhenScrollable>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead class="w-12">Baris</TableHead>
							{#each sheet.preview.headers as letter (letter + sheet.preview.headers.indexOf(letter))}<TableHead class="font-mono text-xs">{letter}</TableHead>{/each}
						</TableRow>
					</TableHeader>
					<TableBody>
						{#each sheet.preview.rows as row (row.row)}
							<TableRow>
								<TableCell class="text-xs text-muted-foreground">{row.row}</TableCell>
								{#each row.cells as cell, i (i)}<TableCell class="max-w-40 truncate text-xs" title={cell}>{cell}</TableCell>{/each}
							</TableRow>
						{/each}
					</TableBody>
				</Table>
			</div>
		</details>

		<details class="rounded-md border" open={!sheet.hasMapping || !!mine?.fieldErrors}>
			<summary class="cursor-pointer px-3 py-2 text-sm font-medium">Header dan pemetaan kolom</summary>
			<div class="space-y-4 border-t p-3">
				<form method="POST" action="?/reanalyze" use:enhance={() => async ({ update }) => update({ reset: false })} class="flex flex-wrap items-end gap-3">
					<input type="hidden" name="sheetName" value={sheet.name} />
					<div class="w-44">
						<Field id={idOf('reanalyze')} label="Tentukan ulang baris header" errors={errorsOf(mine, 'headerRow')}>
							{#snippet children({ describedBy, invalid })}
								<Input id={idOf('reanalyze')} name="headerRow" type="number" min="1" required aria-invalid={invalid} aria-describedby={describedBy} />
							{/snippet}
						</Field>
					</div>
					<Button type="submit" variant="outline">Deteksi ulang</Button>
				</form>
				{#if sheet.hasMapping}
					<MappingEditor {sheet} errors={mappingErrors} />
				{:else}
					<p class="text-sm text-muted-foreground">Tentukan baris header yang memuat kolom NIM agar kolom dapat dipetakan.</p>
				{/if}
			</div>
		</details>
	</CardContent>
</Card>
