<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { componentTypes } from '#lib/features/curriculum/index.ts';
	import { componentTypeLabel } from '#lib/features/imports/index.ts';
	import { errorsOf, type FormState } from '#lib/shared/http/form-state.ts';
	import ConfirmForm from '#lib/shared/ui/ConfirmForm.svelte';
	import Field from '#lib/shared/ui/Field.svelte';
	import FormMessage from '#lib/shared/ui/FormMessage.svelte';
	import NativeSelect from '#lib/shared/ui/NativeSelect.svelte';
	import StatusBadge from '#lib/shared/ui/StatusBadge.svelte';

	type Component = { id: string; code: string; name: string; type: string; weightPercent: number | null; maxScore: number; isRequired: boolean; cpmkMappings: { cpmkId: string; coefficient: number }[] };
	type ComponentForm = (NonNullable<FormState> & { component?: string }) | null | undefined;

	let { component, cpmkOptions, form }: { component: Component; cpmkOptions: { id: string; code: string }[]; form: ComponentForm } = $props();

	const mine = $derived(form?.component === component.code ? form : null);
	const idOf = (name: string) => `${component.code}-${name}`;
	const typeOptions = componentTypes.map((value) => ({ value, label: componentTypeLabel[value] }));
	const coefficientOf = (cpmkId: string) => component.cpmkMappings.find((m) => m.cpmkId === cpmkId)?.coefficient;
</script>

<details class="rounded-md border bg-card" data-component={component.code} open={!!mine}>
	<summary class="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-3">
		<h4 class="font-medium">{component.name}</h4>
		<span class="font-mono text-xs text-muted-foreground">{component.code}</span>
		<span class="text-xs text-muted-foreground">Bobot {component.weightPercent === null ? '—' : `${component.weightPercent}%`}</span>
		{#if component.weightPercent === null}<StatusBadge status="warning" label="Bobot belum diisi" />{/if}
		{#if component.cpmkMappings.length === 0}<StatusBadge status="warning" label="Belum dipetakan ke CPMK" />{:else}<StatusBadge status="success" label={`${component.cpmkMappings.length} CPMK`} />{/if}
	</summary>
	<div class="space-y-4 border-t p-4">
	<FormMessage message={mine?.message} success={mine?.success} />

	<form method="POST" action="?/saveComponent" use:enhance={() => async ({ update }) => update({ reset: false })} class="grid gap-3 md:grid-cols-6">
		<input type="hidden" name="code" value={component.code} />
		<div class="md:col-span-2">
			<Field id={idOf('name')} label="Nama" errors={errorsOf(mine, 'name')}>
				{#snippet children({ describedBy, invalid })}<Input id={idOf('name')} name="name" value={component.name} required aria-invalid={invalid} aria-describedby={describedBy} />{/snippet}
			</Field>
		</div>
		<Field id={idOf('type')} label="Jenis" errors={errorsOf(mine, 'type')}>
			{#snippet children({ describedBy, invalid })}<NativeSelect id={idOf('type')} name="type" options={typeOptions} value={component.type} {invalid} {describedBy} />{/snippet}
		</Field>
		<Field id={idOf('weight')} label="Bobot (%)" errors={errorsOf(mine, 'weightPercent')}>
			{#snippet children({ describedBy, invalid })}<Input id={idOf('weight')} name="weightPercent" inputmode="decimal" value={component.weightPercent ?? ''} aria-invalid={invalid} aria-describedby={describedBy} />{/snippet}
		</Field>
		<Field id={idOf('max')} label="Nilai maks" errors={errorsOf(mine, 'maxScore')}>
			{#snippet children({ describedBy, invalid })}<Input id={idOf('max')} name="maxScore" inputmode="decimal" value={component.maxScore} aria-invalid={invalid} aria-describedby={describedBy} />{/snippet}
		</Field>
		<div class="flex items-end gap-3">
			<label class="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="isRequired" checked={component.isRequired} class="size-4 accent-primary" />Wajib</label>
			<Button type="submit" size="sm">Simpan</Button>
		</div>
	</form>

	<form method="POST" action="?/saveMapping" use:enhance={() => async ({ update }) => update({ reset: false })} class="space-y-3 border-t pt-3">
		<input type="hidden" name="componentId" value={component.id} />
		<input type="hidden" name="code" value={component.code} />
		<fieldset>
			<legend class="mb-2 text-sm font-medium">Kontribusi ke CPMK</legend>
			{#if cpmkOptions.length === 0}
				<p class="text-sm text-muted-foreground">Mata kuliah ini belum memiliki CPMK. Tambahkan CPMK pada halaman Kurikulum.</p>
			{:else}
				<ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
					{#each cpmkOptions as cpmk (cpmk.id)}
						<li class="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm">
							<label class="flex flex-1 items-center gap-2"><input type="checkbox" name={`cpmk_${cpmk.id}`} checked={coefficientOf(cpmk.id) !== undefined} class="size-4 accent-primary" />{cpmk.code}</label>
							<label class="flex items-center gap-1 text-xs text-muted-foreground">Koef.<Input name={`coef_${cpmk.id}`} inputmode="decimal" value={coefficientOf(cpmk.id) ?? 1} class="h-7 w-16" aria-label={`Koefisien ${cpmk.code} untuk ${component.code}`} /></label>
						</li>
					{/each}
				</ul>
			{/if}
		</fieldset>
		<Button type="submit" size="sm" variant="secondary" disabled={cpmkOptions.length === 0}>Simpan pemetaan</Button>
	</form>

	<div class="flex justify-end border-t pt-3">
		<ConfirmForm action="?/deleteComponent" fields={{ componentId: component.id }} triggerLabel="Hapus komponen" tone="destructive" title={`Hapus komponen ${component.code}?`} description="Komponen yang sudah memiliki nilai hanya dinonaktifkan agar riwayat tetap utuh. Komponen tanpa nilai dihapus permanen." confirmLabel="Hapus komponen" />
	</div>
	</div>
</details>
