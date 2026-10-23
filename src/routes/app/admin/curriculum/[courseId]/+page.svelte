<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Card, CardContent, CardHeader, CardTitle } from '#lib/components/ui/card/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#lib/components/ui/table/index.ts';
	import { errorsOf, type FormState } from '#lib/shared/http/form-state.ts';
	import ConfirmForm from '#lib/shared/ui/ConfirmForm.svelte';
	import EmptyState from '#lib/shared/ui/EmptyState.svelte';
	import Field from '#lib/shared/ui/Field.svelte';
	import FormMessage from '#lib/shared/ui/FormMessage.svelte';
	import NativeSelect from '#lib/shared/ui/NativeSelect.svelte';
	import PageHeader from '#lib/shared/ui/PageHeader.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form: rawForm }: { data: PageData; form: ActionData } = $props();
	const form = $derived(rawForm as FormState);
	const cplOptions = $derived(data.cpl.map((c) => ({ value: c.id, label: `${c.code} · ${c.title}` })));
	const cpmkOptions = $derived(data.cpmk.map((c) => ({ value: c.id, label: c.code })));
</script>

<svelte:head><title>{data.course.name} · Kurikulum</title></svelte:head>

<PageHeader title={data.course.name} description={`${data.course.code} · ${data.course.credits} SKS · CPMK dan pemetaan ke CPL`}>
	{#snippet actions()}<Button variant="outline" href="/app/admin/curriculum">Kembali ke kurikulum</Button>{/snippet}
</PageHeader>

<div class="mb-4"><FormMessage message={form?.message} success={form?.success} /></div>

<div class="space-y-10">
	<section aria-labelledby="cpmk-heading" class="space-y-3">
		<h2 id="cpmk-heading" class="text-lg font-semibold">CPMK</h2>
		<Card>
			<CardHeader><CardTitle><h3 class="text-base font-semibold">Tambah CPMK</h3></CardTitle></CardHeader>
			<CardContent>
				<form method="POST" action="?/createCpmk" use:enhance class="grid gap-3 md:grid-cols-6">
					<Field id="cpmk-code" label="Kode" errors={errorsOf(form, 'code')} hint="Contoh: CPMK-1">{#snippet children({ describedBy, invalid })}<Input id="cpmk-code" name="code" required value={form?.values?.code ?? ''} aria-invalid={invalid} aria-describedby={describedBy} />{/snippet}</Field>
					<div class="md:col-span-3"><Field id="cpmk-desc" label="Deskripsi (opsional)" errors={errorsOf(form, 'description')}>{#snippet children({ describedBy, invalid })}<Input id="cpmk-desc" name="description" value={form?.values?.description ?? ''} aria-invalid={invalid} aria-describedby={describedBy} />{/snippet}</Field></div>
					<Field id="cpmk-tax" label="Level taksonomi" errors={errorsOf(form, 'taxonomyLevel')}>{#snippet children({ describedBy, invalid })}<Input id="cpmk-tax" name="taxonomyLevel" placeholder="C3" value={form?.values?.taxonomyLevel ?? ''} aria-invalid={invalid} aria-describedby={describedBy} />{/snippet}</Field>
					<div class="flex items-end"><Button type="submit">Tambah</Button></div>
				</form>
			</CardContent>
		</Card>
		{#if data.cpmk.length === 0}
			<EmptyState title="Belum ada CPMK" description="Tambahkan CPMK agar komponen penilaian dapat dipetakan." />
		{:else}
			<div class="overflow-x-auto rounded-lg border bg-card">
				<Table>
					<TableHeader><TableRow><TableHead>Kode</TableHead><TableHead>Deskripsi</TableHead><TableHead>Taksonomi</TableHead></TableRow></TableHeader>
					<TableBody>{#each data.cpmk as item (item.id)}<TableRow><TableCell class="font-mono text-sm">{item.code}</TableCell><TableCell>{item.description ?? '—'}</TableCell><TableCell>{item.taxonomyLevel ?? '—'}</TableCell></TableRow>{/each}</TableBody>
				</Table>
			</div>
		{/if}
	</section>

	<section aria-labelledby="course-cpl-heading" class="space-y-3">
		<h2 id="course-cpl-heading" class="text-lg font-semibold">Mata kuliah ke CPL</h2>
		<form method="POST" action="?/setCourseCpl" use:enhance class="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4">
			<Field id="cc-cpl" label="CPL" errors={errorsOf(form, 'cplId')}>{#snippet children({ describedBy, invalid })}<NativeSelect id="cc-cpl" name="cplId" options={cplOptions} placeholder="Pilih CPL" required {invalid} {describedBy} />{/snippet}</Field>
			<Field id="cc-contribution" label="Kontribusi (%)" errors={errorsOf(form, 'contribution')} hint="Kosongkan bila belum disepakati.">{#snippet children({ describedBy, invalid })}<Input id="cc-contribution" name="contribution" inputmode="decimal" aria-invalid={invalid} aria-describedby={describedBy} />{/snippet}</Field>
			<Field id="cc-source" label="Sumber pengesahan" errors={errorsOf(form, 'approvalSource')}>{#snippet children({ describedBy, invalid })}<Input id="cc-source" name="approvalSource" placeholder="Mis. Rapat kurikulum" aria-invalid={invalid} aria-describedby={describedBy} />{/snippet}</Field>
			<div class="flex items-end"><Button type="submit">Simpan</Button></div>
		</form>
		{#if data.courseMappings.length}
			<div class="overflow-x-auto rounded-lg border bg-card">
				<Table>
					<TableHeader><TableRow><TableHead>CPL</TableHead><TableHead class="text-right">Kontribusi</TableHead><TableHead>Pengesahan</TableHead><TableHead class="text-right">Aksi</TableHead></TableRow></TableHeader>
					<TableBody>
						{#each data.courseMappings as mapping (mapping.id)}
							<TableRow>
								<TableCell>{mapping.cplCode} · {mapping.cplTitle}</TableCell>
								<TableCell class="text-right tabular-nums">{mapping.contribution === null ? 'belum diisi' : `${mapping.contribution}%`}</TableCell>
								<TableCell>{mapping.approvalSource ?? '—'}</TableCell>
								<TableCell class="text-right"><ConfirmForm action="?/removeCourseCpl" fields={{ mappingId: mapping.id }} triggerLabel="Hapus" tone="destructive" title="Hapus pemetaan?" description="Pemetaan mata kuliah ke CPL ini dihapus." confirmLabel="Hapus" /></TableCell>
							</TableRow>
						{/each}
					</TableBody>
				</Table>
			</div>
		{/if}
	</section>

	<section aria-labelledby="cpmk-cpl-heading" class="space-y-3">
		<h2 id="cpmk-cpl-heading" class="text-lg font-semibold">CPMK ke CPL</h2>
		<p class="text-sm text-muted-foreground">Bobot menentukan kontribusi relatif tiap CPMK terhadap nilai CPL. Hasil CPL hanya terhitung bila CPMK dipetakan di sini; perubahan memicu perhitungan ulang semua kelas mata kuliah ini.</p>
		<form method="POST" action="?/setCpmkCpl" use:enhance class="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4">
			<Field id="cm-cpmk" label="CPMK" errors={errorsOf(form, 'cpmkId')}>{#snippet children({ describedBy, invalid })}<NativeSelect id="cm-cpmk" name="cpmkId" options={cpmkOptions} placeholder="Pilih CPMK" required {invalid} {describedBy} />{/snippet}</Field>
			<Field id="cm-cpl" label="CPL" errors={errorsOf(form, 'cplId')}>{#snippet children({ describedBy, invalid })}<NativeSelect id="cm-cpl" name="cplId" options={cplOptions} placeholder="Pilih CPL" required {invalid} {describedBy} />{/snippet}</Field>
			<Field id="cm-weight" label="Bobot" errors={errorsOf(form, 'weight')}>{#snippet children({ describedBy, invalid })}<Input id="cm-weight" name="weight" inputmode="decimal" value="1" required aria-invalid={invalid} aria-describedby={describedBy} />{/snippet}</Field>
			<div class="flex items-end"><Button type="submit">Simpan</Button></div>
		</form>
		{#if data.cpmkMappings.length}
			<div class="overflow-x-auto rounded-lg border bg-card">
				<Table>
					<TableHeader><TableRow><TableHead>CPMK</TableHead><TableHead>CPL</TableHead><TableHead class="text-right">Bobot</TableHead><TableHead class="text-right">Aksi</TableHead></TableRow></TableHeader>
					<TableBody>
						{#each data.cpmkMappings as mapping (mapping.id)}
							<TableRow>
								<TableCell class="font-mono text-sm">{mapping.cpmkCode}</TableCell>
								<TableCell>{mapping.cplCode}</TableCell>
								<TableCell class="text-right tabular-nums">{mapping.weight}</TableCell>
								<TableCell class="text-right"><ConfirmForm action="?/removeCpmkCpl" fields={{ mappingId: mapping.id }} triggerLabel="Hapus" tone="destructive" title="Hapus pemetaan?" description="Hasil CPL kelas yang bergantung pada pemetaan ini dihitung ulang otomatis." confirmLabel="Hapus" /></TableCell>
							</TableRow>
						{/each}
					</TableBody>
				</Table>
			</div>
		{/if}
	</section>
</div>
