<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Card, CardContent, CardHeader, CardTitle } from '#lib/components/ui/card/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#lib/components/ui/table/index.ts';
	import { Textarea } from '#lib/components/ui/textarea/index.ts';
	import { errorsOf, type FormState } from '#lib/shared/http/form-state.ts';
	import ConfirmForm from '#lib/shared/ui/ConfirmForm.svelte';
	import EmptyState from '#lib/shared/ui/EmptyState.svelte';
	import Field from '#lib/shared/ui/Field.svelte';
	import FormMessage from '#lib/shared/ui/FormMessage.svelte';
	import PageHeader from '#lib/shared/ui/PageHeader.svelte';
	import Pager from '#lib/shared/ui/Pager.svelte';
	import StatusBadge from '#lib/shared/ui/StatusBadge.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form: rawForm }: { data: PageData; form: ActionData } = $props();
	const form = $derived(rawForm as FormState);
	const editing = $derived(data.editing);
	const href = (page: number) => `?${new URLSearchParams({ ...(data.search ? { cari: data.search } : {}), halaman: String(page) })}`;
	const value = (name: 'code' | 'name' | 'credits' | 'description') => form?.values?.[name] ?? (editing ? String(editing[name] ?? '') : '');
</script>

<svelte:head><title>Mata kuliah · OBE Teknik Biomedis</title></svelte:head>

<PageHeader title="Mata kuliah" description="Master data mata kuliah dan SKS. Kode bersifat unik dan selalu huruf besar." />

<div class="mb-4"><FormMessage message={form?.message} success={form?.success} /></div>

<Card class="mb-8">
	<CardHeader><CardTitle>{editing ? `Ubah ${editing.code}` : 'Tambah mata kuliah'}</CardTitle></CardHeader>
	<CardContent>
		{#key editing?.id ?? 'baru'}
			<form method="POST" action={editing ? '?/update' : '?/create'} use:enhance class="grid gap-4 md:grid-cols-4">
				{#if editing}<input type="hidden" name="id" value={editing.id} />{/if}
				<Field id="code" label="Kode" errors={errorsOf(form, 'code')} hint="Contoh: BME301">
					{#snippet children({ describedBy, invalid })}
						<Input id="code" name="code" required value={value('code')} aria-invalid={invalid} aria-describedby={describedBy} />
					{/snippet}
				</Field>
				<div class="md:col-span-2">
					<Field id="name" label="Nama mata kuliah" errors={errorsOf(form, 'name')}>
						{#snippet children({ describedBy, invalid })}
							<Input id="name" name="name" required value={value('name')} aria-invalid={invalid} aria-describedby={describedBy} />
						{/snippet}
					</Field>
				</div>
				<Field id="credits" label="SKS" errors={errorsOf(form, 'credits')}>
					{#snippet children({ describedBy, invalid })}
						<Input id="credits" name="credits" type="number" min="1" max="12" required value={value('credits')} aria-invalid={invalid} aria-describedby={describedBy} />
					{/snippet}
				</Field>
				<div class="md:col-span-4">
					<Field id="description" label="Deskripsi (opsional)" errors={errorsOf(form, 'description')}>
						{#snippet children({ describedBy, invalid })}
							<Textarea id="description" name="description" rows={2} value={value('description')} aria-invalid={invalid} aria-describedby={describedBy} />
						{/snippet}
					</Field>
				</div>
				<div class="flex gap-2 md:col-span-4">
					<Button type="submit">{editing ? 'Simpan perubahan' : 'Tambah mata kuliah'}</Button>
					{#if editing}<Button variant="outline" href="?">Batal</Button>{/if}
				</div>
			</form>
		{/key}
	</CardContent>
</Card>

<form method="GET" class="mb-4 flex max-w-md gap-2" role="search">
	<Input name="cari" type="search" placeholder="Cari kode atau nama" value={data.search} aria-label="Cari mata kuliah" />
	<Button type="submit" variant="secondary">Cari</Button>
</form>

{#if data.rows.length === 0}
	<EmptyState title={data.search ? 'Tidak ada mata kuliah yang cocok' : 'Belum ada mata kuliah'} description={data.search ? 'Ubah kata kunci pencarian.' : 'Tambahkan mata kuliah pertama melalui formulir di atas.'} />
{:else}
	<div class="overflow-x-auto rounded-lg border bg-card">
		<Table>
			<TableHeader><TableRow><TableHead>Kode</TableHead><TableHead>Nama</TableHead><TableHead class="text-right">SKS</TableHead><TableHead>Status</TableHead><TableHead class="text-right">Aksi</TableHead></TableRow></TableHeader>
			<TableBody>
				{#each data.rows as course (course.id)}
					<TableRow>
						<TableCell class="font-mono text-sm">{course.code}</TableCell>
						<TableCell class="font-medium">{course.name}</TableCell>
						<TableCell class="text-right tabular-nums">{course.credits}</TableCell>
						<TableCell><StatusBadge status={course.isActive ? 'success' : 'neutral'} label={course.isActive ? 'Aktif' : 'Nonaktif'} /></TableCell>
						<TableCell class="text-right">
							<div class="flex justify-end gap-2">
								<Button variant="outline" size="sm" href={`?ubah=${course.id}${data.search ? `&cari=${encodeURIComponent(data.search)}` : ''}`}>Ubah</Button>
								<ConfirmForm
									action="?/toggle"
									fields={{ id: course.id, active: String(!course.isActive) }}
									triggerLabel={course.isActive ? 'Nonaktifkan' : 'Aktifkan'}
									title={course.isActive ? 'Nonaktifkan mata kuliah?' : 'Aktifkan mata kuliah?'}
									description={course.isActive ? 'Mata kuliah tidak muncul lagi sebagai pilihan penawaran baru. Data historis tetap tersimpan.' : 'Mata kuliah dapat dipilih kembali untuk penawaran kelas.'}
								/>
							</div>
						</TableCell>
					</TableRow>
				{/each}
			</TableBody>
		</Table>
	</div>
	<Pager page={data.page} pageCount={data.pageCount} total={data.total} {href} />
{/if}
