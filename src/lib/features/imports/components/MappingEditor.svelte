<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#lib/components/ui/table/index.ts';
	import Field from '#lib/shared/ui/Field.svelte';
	import NativeSelect from '#lib/shared/ui/NativeSelect.svelte';
	import StatusBadge from '#lib/shared/ui/StatusBadge.svelte';
	import { columnChoiceOptions, columnRoleLabel, componentTypeLabel, confidenceLabel } from '../imports.labels.ts';
	import type { ColumnChoice, WizardSheet } from '../imports.view.ts';

	let { sheet, errors }: { sheet: WizardSheet; errors: Record<string, string[]> } = $props();

	let overrides = $state<Record<number, ColumnChoice>>({});
	$effect(() => {
		void sheet.columns;
		overrides = {};
	});
	const choiceOf = (column: WizardSheet['columns'][number]): ColumnChoice => overrides[column.index] ?? column.choice;
	const columnOptions = $derived(sheet.preview.headers.map((letter, index) => ({ value: String(index), label: `Kolom ${letter}` })));
	const typeOptions = Object.entries(componentTypeLabel).map(([value, label]) => ({ value, label }));
	const idOf = (name: string) => `${sheet.name.replace(/\W+/g, '-')}-${name}`;
	const allMessages = $derived(Object.values(errors).flat());
</script>

<form method="POST" action="?/saveMapping" use:enhance={() => async ({ update }) => update({ reset: false })} class="space-y-4">
	<input type="hidden" name="sheetName" value={sheet.name} />

	{#if allMessages.length}
		<ul class="space-y-0.5 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
			{#each allMessages as message, i (i)}<li>{message}</li>{/each}
		</ul>
	{/if}

	<div class="grid gap-3 md:grid-cols-5">
		<Field id={idOf('headerRow')} label="Baris header">
			{#snippet children()}<Input id={idOf('headerRow')} name="headerRow" type="number" min="1" value={sheet.headerRow ?? ''} required />{/snippet}
		</Field>
		<Field id={idOf('nimColumn')} label="Kolom NIM">
			{#snippet children()}<NativeSelect id={idOf('nimColumn')} name="nimColumn" options={columnOptions} value={String(sheet.nimColumn ?? '')} required />{/snippet}
		</Field>
		<Field id={idOf('nameColumn')} label="Kolom nama">
			{#snippet children()}<NativeSelect id={idOf('nameColumn')} name="nameColumn" options={columnOptions} value={sheet.nameColumn === null ? '' : String(sheet.nameColumn)} placeholder="Tidak ada" />{/snippet}
		</Field>
		<Field id={idOf('firstDataRow')} label="Baris data pertama">
			{#snippet children()}<Input id={idOf('firstDataRow')} name="firstDataRow" type="number" min="1" value={sheet.firstDataRow ?? ''} required />{/snippet}
		</Field>
		<Field id={idOf('excludedRows')} label="Baris dikecualikan" hint="Pisahkan dengan koma">
			{#snippet children()}<Input id={idOf('excludedRows')} name="excludedRows" value={sheet.excludedRows} />{/snippet}
		</Field>
	</div>

	<div class="overflow-x-auto rounded-md border">
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Kolom</TableHead>
					<TableHead>Header di berkas</TableHead>
					<TableHead>Terdeteksi</TableHead>
					<TableHead>Peran</TableHead>
					<TableHead>Kode</TableHead>
					<TableHead>Nama komponen</TableHead>
					<TableHead>Jenis</TableHead>
					<TableHead class="w-24">Bobot %</TableHead>
					<TableHead class="w-24">Nilai maks</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{#each sheet.columns as column (column.index)}
					{@const choice = choiceOf(column)}
					<TableRow>
						<TableCell class="font-mono text-xs">{column.letter}</TableCell>
						<TableCell class="max-w-48 truncate" title={column.header}>{column.header || '—'}</TableCell>
						<TableCell>
							<StatusBadge status={column.confidence === 'high' ? 'success' : column.confidence === 'medium' ? 'info' : 'warning'} label={`${columnRoleLabel[column.detectedRole]} (${confidenceLabel[column.confidence]})`} />
							{#if column.ghost}<span class="mt-1 block text-xs text-muted-foreground">Kolom kosong berbobot</span>{/if}
						</TableCell>
						<TableCell class="min-w-40">
							<NativeSelect id={idOf(`role-${column.index}`)} name={`col_${column.index}_role`} label={`Peran kolom ${column.letter}`} options={columnChoiceOptions} value={choice} onchange={(event) => (overrides[column.index] = (event.currentTarget as HTMLSelectElement).value as ColumnChoice)} class="h-8" />
						</TableCell>
						<TableCell class="min-w-28"><Input name={`col_${column.index}_code`} value={column.code} disabled={choice === 'ignore'} aria-label={`Kode kolom ${column.letter}`} class="h-8" /></TableCell>
						<TableCell class="min-w-44"><Input name={`col_${column.index}_name`} value={column.name} disabled={choice !== 'component'} aria-label={`Nama komponen kolom ${column.letter}`} class="h-8" /></TableCell>
						<TableCell class="min-w-32"><NativeSelect id={idOf(`type-${column.index}`)} name={`col_${column.index}_type`} label={`Jenis komponen kolom ${column.letter}`} options={typeOptions} value={column.type} disabled={choice !== 'component'} class="h-8" /></TableCell>
						<TableCell><Input name={`col_${column.index}_weight`} inputmode="decimal" value={column.weight} disabled={choice !== 'component'} aria-label={`Bobot kolom ${column.letter}`} class="h-8" /></TableCell>
						<TableCell><Input name={`col_${column.index}_max`} inputmode="decimal" value={column.max} disabled={choice !== 'component'} aria-label={`Nilai maksimum kolom ${column.letter}`} class="h-8" /></TableCell>
					</TableRow>
				{/each}
			</TableBody>
		</Table>
	</div>

	<div class="flex flex-wrap items-end gap-3">
		<div class="min-w-56">
			<Field id={idOf('presetName')} label="Simpan sebagai preset (opsional)" hint="Dipakai otomatis untuk berkas berstruktur sama.">
				{#snippet children()}<Input id={idOf('presetName')} name="presetName" maxlength={80} placeholder="Mis. Template nilai semester" />{/snippet}
			</Field>
		</div>
		<Button type="submit">Simpan pemetaan</Button>
	</div>
</form>
