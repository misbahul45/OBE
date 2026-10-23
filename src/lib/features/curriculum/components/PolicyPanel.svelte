<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#lib/components/ui/card/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Textarea } from '#lib/components/ui/textarea/index.ts';
	import { errorsOf, type FormState } from '#lib/shared/http/form-state.ts';
	import ConfirmForm from '#lib/shared/ui/ConfirmForm.svelte';
	import Field from '#lib/shared/ui/Field.svelte';
	import NativeSelect from '#lib/shared/ui/NativeSelect.svelte';
	import StatusBadge from '#lib/shared/ui/StatusBadge.svelte';

	type Policy = {
		id: string;
		version: number;
		name: string;
		status: 'draft' | 'active' | 'retired';
		scaleMax: number;
		achievementThreshold: number | null;
		classAchievementRatio: number | null;
		weightTolerance: number;
		aggregationMethod: 'not_configured' | 'simple_mean' | 'credit_weighted_mean';
		notes: string | null;
		targets: { cplId: string; target: number }[];
	};
	type Cpl = { id: string; code: string; title: string };

	let { policies, cpl, form }: { policies: Policy[]; cpl: Cpl[]; form: FormState } = $props();

	const active = $derived(policies.find((p) => p.status === 'active') ?? null);
	const draft = $derived(policies.find((p) => p.status === 'draft') ?? null);
	const aggregationOptions = [
		{ value: 'not_configured', label: 'Belum diatur (tidak ada angka gabungan)' },
		{ value: 'simple_mean', label: 'Rata-rata sederhana antar kelas' },
		{ value: 'credit_weighted_mean', label: 'Rata-rata tertimbang SKS' }
	];
	const aggregationLabel = Object.fromEntries(aggregationOptions.map((o) => [o.value, o.label]));
	const val = (name: string, fallback: string | number | null | undefined) => form?.values?.[name] ?? (fallback === null || fallback === undefined ? '' : String(fallback));
	const targetOf = (policy: Policy, cplId: string) => policy.targets.find((t) => t.cplId === cplId)?.target;
</script>

<div class="grid gap-4 xl:grid-cols-2">
	<Card>
		<CardHeader>
			<CardTitle class="flex items-center gap-2"><h3 class="text-base font-semibold">Kebijakan aktif</h3>{#if active}<StatusBadge status="success" label={`Versi ${active.version}`} />{/if}</CardTitle>
			<CardDescription>Kebijakan aktif tidak dapat diubah. Salin menjadi draf untuk memperbaruinya.</CardDescription>
		</CardHeader>
		<CardContent class="space-y-3">
			{#if active}
				<dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
					<dt class="text-muted-foreground">Nama</dt><dd>{active.name}</dd>
					<dt class="text-muted-foreground">Skala maksimum</dt><dd>{active.scaleMax}</dd>
					<dt class="text-muted-foreground">Ambang ketercapaian CPMK</dt><dd>{active.achievementThreshold ?? 'belum diatur'}</dd>
					<dt class="text-muted-foreground">Rasio ketercapaian kelas</dt><dd>{active.classAchievementRatio === null ? 'belum diatur' : `${active.classAchievementRatio}%`}</dd>
					<dt class="text-muted-foreground">Agregasi CPL antar kelas</dt><dd>{aggregationLabel[active.aggregationMethod]}</dd>
				</dl>
				{#if cpl.length}
					<ul class="text-sm" aria-label="Target CPL kebijakan aktif">
						{#each cpl as item (item.id)}<li class="flex justify-between border-b py-1 last:border-0"><span>{item.code}</span><span class="tabular-nums">{targetOf(active, item.id) ?? 'target belum diatur'}</span></li>{/each}
					</ul>
				{/if}
				{#if !draft}
					<form method="POST" action="?/cloneActive" use:enhance><Button type="submit" variant="outline">Salin menjadi draf baru</Button></form>
				{/if}
			{:else}
				<p class="text-sm text-muted-foreground">Belum ada kebijakan aktif. Buat draf, atur target, lalu aktifkan agar ketercapaian dapat dinilai.</p>
			{/if}
		</CardContent>
	</Card>

	<Card>
		<CardHeader>
			<CardTitle class="flex items-center gap-2"><h3 class="text-base font-semibold">{draft ? 'Draf kebijakan' : 'Buat draf kebijakan'}</h3>{#if draft}<StatusBadge status="warning" label={`Draf versi ${draft.version}`} />{/if}</CardTitle>
			<CardDescription>Draf boleh diubah. Aktivasi menghentikan kebijakan aktif sebelumnya.</CardDescription>
		</CardHeader>
		<CardContent class="space-y-4">
			{#key draft?.id ?? 'baru'}
				<form method="POST" action={draft ? '?/updateDraft' : '?/createDraft'} use:enhance={() => async ({ update }) => update({ reset: false })} class="grid gap-3 sm:grid-cols-2">
					{#if draft}<input type="hidden" name="policyId" value={draft.id} />{/if}
					<div class="sm:col-span-2">
						<Field id="p-name" label="Nama kebijakan" errors={errorsOf(form, 'name')}>
							{#snippet children({ describedBy, invalid })}<Input id="p-name" name="name" required value={val('name', draft?.name ?? '')} aria-invalid={invalid} aria-describedby={describedBy} />{/snippet}
						</Field>
					</div>
					<Field id="p-scale" label="Skala maksimum" errors={errorsOf(form, 'scaleMax')}>
						{#snippet children({ describedBy, invalid })}<Input id="p-scale" name="scaleMax" inputmode="decimal" value={val('scaleMax', draft?.scaleMax ?? 100)} aria-invalid={invalid} aria-describedby={describedBy} />{/snippet}
					</Field>
					<Field id="p-threshold" label="Ambang ketercapaian CPMK" errors={errorsOf(form, 'achievementThreshold')} hint="Kosongkan bila belum ditetapkan.">
						{#snippet children({ describedBy, invalid })}<Input id="p-threshold" name="achievementThreshold" inputmode="decimal" value={val('achievementThreshold', draft?.achievementThreshold)} aria-invalid={invalid} aria-describedby={describedBy} />{/snippet}
					</Field>
					<Field id="p-ratio" label="Rasio ketercapaian kelas (%)" errors={errorsOf(form, 'classAchievementRatio')}>
						{#snippet children({ describedBy, invalid })}<Input id="p-ratio" name="classAchievementRatio" inputmode="decimal" value={val('classAchievementRatio', draft?.classAchievementRatio)} aria-invalid={invalid} aria-describedby={describedBy} />{/snippet}
					</Field>
					<Field id="p-tolerance" label="Toleransi bobot" errors={errorsOf(form, 'weightTolerance')}>
						{#snippet children({ describedBy, invalid })}<Input id="p-tolerance" name="weightTolerance" inputmode="decimal" value={val('weightTolerance', draft?.weightTolerance ?? 0.01)} aria-invalid={invalid} aria-describedby={describedBy} />{/snippet}
					</Field>
					<div class="sm:col-span-2">
						<Field id="p-agg" label="Agregasi CPL antar kelas" errors={errorsOf(form, 'aggregationMethod')}>
							{#snippet children({ describedBy, invalid })}<NativeSelect id="p-agg" name="aggregationMethod" options={aggregationOptions} value={val('aggregationMethod', draft?.aggregationMethod ?? 'not_configured')} {invalid} {describedBy} />{/snippet}
						</Field>
					</div>
					<div class="sm:col-span-2">
						<Field id="p-notes" label="Catatan (opsional)" errors={errorsOf(form, 'notes')}>
							{#snippet children({ describedBy, invalid })}<Textarea id="p-notes" name="notes" rows={2} value={val('notes', draft?.notes)} aria-invalid={invalid} aria-describedby={describedBy} />{/snippet}
						</Field>
					</div>
					<div class="sm:col-span-2"><Button type="submit">{draft ? 'Simpan draf' : 'Buat draf'}</Button></div>
				</form>
			{/key}

			{#if draft}
				<div class="space-y-2 border-t pt-4">
					<h4 class="text-sm font-medium">Target CPL pada draf</h4>
					{#if cpl.length === 0}<p class="text-sm text-muted-foreground">Tambahkan CPL terlebih dahulu.</p>{/if}
					{#each cpl as item (item.id)}
						<form method="POST" action="?/setTarget" use:enhance={() => async ({ update }) => update({ reset: false })} class="flex items-end gap-2">
							<input type="hidden" name="policyId" value={draft.id} />
							<input type="hidden" name="cplId" value={item.id} />
							<div class="flex-1"><Field id={`t-${item.id}`} label={`${item.code} · ${item.title}`}>{#snippet children()}<Input id={`t-${item.id}`} name="target" inputmode="decimal" value={targetOf(draft, item.id) ?? ''} required />{/snippet}</Field></div>
							<Button type="submit" size="sm" variant="secondary">Simpan</Button>
						</form>
					{/each}
				</div>
				<div class="border-t pt-4">
					<ConfirmForm action="?/activate" fields={{ policyId: draft.id }} triggerLabel="Aktifkan draf ini" title={`Aktifkan kebijakan versi ${draft.version}?`} description="Kebijakan aktif saat ini dipensiunkan dan tidak dapat diubah lagi. Penilaian ketercapaian memakai kebijakan baru." confirmLabel="Aktifkan" />
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
