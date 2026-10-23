<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Card, CardContent, CardHeader, CardTitle } from '#lib/components/ui/card/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#lib/components/ui/table/index.ts';
	import { Textarea } from '#lib/components/ui/textarea/index.ts';
	import { PolicyPanel } from '#lib/features/curriculum/components/index.ts';
	import { errorsOf, type FormState } from '#lib/shared/http/form-state.ts';
	import CodeChips from '#lib/shared/ui/CodeChips.svelte';
	import EmptyState from '#lib/shared/ui/EmptyState.svelte';
	import Field from '#lib/shared/ui/Field.svelte';
	import FormMessage from '#lib/shared/ui/FormMessage.svelte';
	import PageHeader from '#lib/shared/ui/PageHeader.svelte';
	import StatusBadge from '#lib/shared/ui/StatusBadge.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form: rawForm }: { data: PageData; form: ActionData } = $props();
	const form = $derived(rawForm as FormState);
	const editing = $derived(data.editing);
	const value = (name: 'code' | 'title' | 'description' | 'graduateAttributes' | 'knowledgeProfiles' | 'sortOrder') => {
		const submitted = form?.values?.[name];
		if (submitted !== undefined) return submitted;
		if (!editing) return name === 'sortOrder' ? String(data.cpl.length + 1) : '';
		if (name === 'graduateAttributes' || name === 'knowledgeProfiles') return editing[name].join(', ');
		return String(editing[name] ?? '');
	};
</script>

<svelte:head><title>CPL dan CPMK · OBE Teknik Biomedis</title></svelte:head>

<PageHeader title="Kurikulum OBE" description="Definisi CPL, CPMK per mata kuliah, pemetaan, dan kebijakan penilaian ketercapaian. Hubungan CPL dengan profil lulusan ada di menu Profil lulusan." />

<div class="mb-4"><FormMessage message={form?.message} success={form?.success} /></div>

<section aria-labelledby="cpl-heading" class="mb-10 space-y-4">
	<h2 id="cpl-heading" class="text-lg font-semibold">Capaian Pembelajaran Lulusan (CPL)</h2>
	<Card>
		<CardHeader><CardTitle><h3 class="text-base font-semibold">{editing ? `Ubah ${editing.code}` : 'Tambah CPL'}</h3></CardTitle></CardHeader>
		<CardContent>
			{#key editing?.id ?? 'baru'}
				<form method="POST" action={editing ? '?/updateCpl' : '?/createCpl'} use:enhance class="grid gap-3 md:grid-cols-6">
					{#if editing}<input type="hidden" name="id" value={editing.id} />{/if}
					<Field id="cpl-code" label="Kode" errors={errorsOf(form, 'code')} hint="Contoh: CPL-1">{#snippet children({ describedBy, invalid })}<Input id="cpl-code" name="code" required value={value('code')} aria-invalid={invalid} aria-describedby={describedBy} />{/snippet}</Field>
					<div class="md:col-span-3"><Field id="cpl-title" label="Judul" errors={errorsOf(form, 'title')}>{#snippet children({ describedBy, invalid })}<Input id="cpl-title" name="title" required value={value('title')} aria-invalid={invalid} aria-describedby={describedBy} />{/snippet}</Field></div>
					<Field id="cpl-order" label="Urutan" errors={errorsOf(form, 'sortOrder')}>{#snippet children({ describedBy, invalid })}<Input id="cpl-order" name="sortOrder" type="number" min="0" value={value('sortOrder')} aria-invalid={invalid} aria-describedby={describedBy} />{/snippet}</Field>
					<div class="md:col-span-3"><Field id="cpl-wa" label="Atribut lulusan WA (opsional)" errors={errorsOf(form, 'graduateAttributes')} hint="Pisahkan dengan koma. Contoh: WA-1, WA-5. Lihat Panduan istilah untuk daftar kode.">{#snippet children({ describedBy, invalid })}<Input id="cpl-wa" name="graduateAttributes" value={value('graduateAttributes')} aria-invalid={invalid} aria-describedby={describedBy} />{/snippet}</Field></div>
					<div class="md:col-span-3"><Field id="cpl-wk" label="Profil pengetahuan WK (opsional)" errors={errorsOf(form, 'knowledgeProfiles')} hint="Pisahkan dengan koma. Contoh: WK-1, WK-3.">{#snippet children({ describedBy, invalid })}<Input id="cpl-wk" name="knowledgeProfiles" value={value('knowledgeProfiles')} aria-invalid={invalid} aria-describedby={describedBy} />{/snippet}</Field></div>
					<div class="md:col-span-6"><Field id="cpl-desc" label="Deskripsi (opsional)" errors={errorsOf(form, 'description')}>{#snippet children({ describedBy, invalid })}<Textarea id="cpl-desc" name="description" rows={2} value={value('description')} aria-invalid={invalid} aria-describedby={describedBy} />{/snippet}</Field></div>
					<div class="flex gap-2 md:col-span-6"><Button type="submit">{editing ? 'Simpan perubahan' : 'Tambah CPL'}</Button>{#if editing}<Button variant="outline" href="?">Batal</Button>{/if}</div>
				</form>
			{/key}
		</CardContent>
	</Card>
	{#if data.cpl.length === 0}
		<EmptyState title="Belum ada CPL" description="Tambahkan CPL pada formulir di atas. Untuk memuat 8 CPL beserta profil lulusan dari dokumen kurikulum, jalankan `bun run seed:curriculum`." />
	{:else}
		<div class="overflow-x-auto rounded-lg border bg-card">
			<Table>
				<TableHeader><TableRow><TableHead>Kode</TableHead><TableHead>Judul</TableHead><TableHead>WA</TableHead><TableHead>WK</TableHead><TableHead class="text-right">Urutan</TableHead><TableHead class="text-right">Aksi</TableHead></TableRow></TableHeader>
				<TableBody>
					{#each data.cpl as item (item.id)}
						<TableRow><TableCell class="font-mono text-sm">{item.code}</TableCell><TableCell class="min-w-64 whitespace-normal">{item.title}</TableCell><TableCell><CodeChips codes={item.graduateAttributes} kind="WA" label={`Atribut lulusan ${item.code}`} /></TableCell><TableCell><CodeChips codes={item.knowledgeProfiles} kind="WK" label={`Profil pengetahuan ${item.code}`} /></TableCell><TableCell class="text-right tabular-nums">{item.sortOrder}</TableCell><TableCell class="text-right"><Button variant="outline" size="sm" href={`?ubah=${item.id}`}>Ubah</Button></TableCell></TableRow>
					{/each}
				</TableBody>
			</Table>
		</div>
	{/if}
</section>

<section aria-labelledby="courses-heading" class="mb-10 space-y-3">
	<h2 id="courses-heading" class="text-lg font-semibold">CPMK per mata kuliah</h2>
	{#if data.courses.length === 0}
		<EmptyState title="Belum ada mata kuliah" description="CPMK dikelola per mata kuliah, jadi tambahkan mata kuliah terlebih dahulu." actionLabel="Buka Mata kuliah" actionHref="/app/admin/courses" />
	{:else}
		<div class="overflow-x-auto rounded-lg border bg-card">
			<Table>
				<TableHeader><TableRow><TableHead>Kode</TableHead><TableHead>Mata kuliah</TableHead><TableHead>CPMK</TableHead><TableHead class="text-right">Aksi</TableHead></TableRow></TableHeader>
				<TableBody>
					{#each data.courses as course (course.id)}
						<TableRow>
							<TableCell class="font-mono text-sm">{course.code}</TableCell>
							<TableCell class="font-medium">{course.name}</TableCell>
							<TableCell><StatusBadge status={course.cpmkCount > 0 ? 'success' : 'warning'} label={course.cpmkCount > 0 ? `${course.cpmkCount} CPMK` : 'Belum ada CPMK'} /></TableCell>
							<TableCell class="text-right"><Button variant="outline" size="sm" href={`/app/admin/curriculum/${course.id}`}>Kelola CPMK dan pemetaan</Button></TableCell>
						</TableRow>
					{/each}
				</TableBody>
			</Table>
		</div>
	{/if}
</section>

<section aria-labelledby="policy-heading" class="space-y-4">
	<h2 id="policy-heading" class="text-lg font-semibold">Kebijakan penilaian ketercapaian</h2>
	<PolicyPanel policies={data.policies} cpl={data.cpl} {form} />
</section>
