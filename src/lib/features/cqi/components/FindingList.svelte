<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Card, CardContent, CardHeader, CardTitle } from '#lib/components/ui/card/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#lib/components/ui/table/index.ts';
	import { Textarea } from '#lib/components/ui/textarea/index.ts';
	import { errorsOf, type FormState } from '#lib/shared/http/form-state.ts';
	import EmptyState from '#lib/shared/ui/EmptyState.svelte';
	import Field from '#lib/shared/ui/Field.svelte';
	import FormMessage from '#lib/shared/ui/FormMessage.svelte';
	import NativeSelect from '#lib/shared/ui/NativeSelect.svelte';
	import Pager from '#lib/shared/ui/Pager.svelte';
	import StatusBadge from '#lib/shared/ui/StatusBadge.svelte';
	import { priorityTone, statusTone } from '../cqi.labels.ts';
	import { priorities, priorityLabels } from '../cqi.validation.ts';
	import { cqiStatuses, statusLabels } from '../cqi.workflow.ts';

	type Row = { id: string; code: string; title: string; priority: string; status: (typeof cqiStatuses)[number]; offeringLabel: string | null; actionTotal: number; actionDone: number; actionOverdue: number };

	let {
		rows,
		total,
		page,
		pageCount,
		query,
		canCreate,
		offeringOptions,
		cplOptions,
		basePath,
		form
	}: { rows: Row[]; total: number; page: number; pageCount: number; query: { status: string; priority: string; search: string }; canCreate: boolean; offeringOptions: { id: string; label: string }[]; cplOptions: { id: string; label: string }[]; basePath: string; form: FormState } = $props();

	const href = (target: number) => `?${new URLSearchParams({ ...(query.search ? { cari: query.search } : {}), ...(query.status ? { status: query.status } : {}), ...(query.priority ? { prioritas: query.priority } : {}), halaman: String(target) })}`;
	const statusOptions = cqiStatuses.map((value) => ({ value, label: statusLabels[value] }));
	const priorityOptions = priorities.map((value) => ({ value, label: priorityLabels[value] }));
</script>

{#if canCreate}
	<Card class="mb-8">
		<CardHeader><CardTitle><h2 class="text-base font-semibold">Catat temuan baru</h2></CardTitle></CardHeader>
		<CardContent>
			<FormMessage message={form?.message} />
			<form method="POST" action="?/create" use:enhance class="mt-2 grid gap-3 md:grid-cols-2">
				<div class="md:col-span-2"><Field id="f-title" label="Judul temuan" errors={errorsOf(form, 'title')}>{#snippet children({ describedBy, invalid })}<Input id="f-title" name="title" required value={form?.values?.title ?? ''} aria-invalid={invalid} aria-describedby={describedBy} />{/snippet}</Field></div>
				<div class="md:col-span-2"><Field id="f-desc" label="Deskripsi" errors={errorsOf(form, 'description')} hint="Jelaskan data yang mendasari temuan dan dampaknya.">{#snippet children({ describedBy, invalid })}<Textarea id="f-desc" name="description" rows={3} required value={form?.values?.description ?? ''} aria-invalid={invalid} aria-describedby={describedBy} />{/snippet}</Field></div>
				<Field id="f-priority" label="Prioritas" errors={errorsOf(form, 'priority')}>{#snippet children({ describedBy, invalid })}<NativeSelect id="f-priority" name="priority" options={priorityOptions} value={form?.values?.priority ?? 'medium'} {invalid} {describedBy} />{/snippet}</Field>
				<Field id="f-offering" label="Kelas terkait (opsional)" errors={errorsOf(form, 'offeringId')}>{#snippet children({ describedBy, invalid })}<NativeSelect id="f-offering" name="offeringId" options={offeringOptions.map((o) => ({ value: o.id, label: o.label }))} placeholder="Tidak terkait kelas" value={form?.values?.offeringId ?? ''} {invalid} {describedBy} />{/snippet}</Field>
				<Field id="f-cpl" label="CPL terkait (opsional)" errors={errorsOf(form, 'cplId')}>{#snippet children({ describedBy, invalid })}<NativeSelect id="f-cpl" name="cplId" options={cplOptions.map((c) => ({ value: c.id, label: c.label }))} placeholder="Tidak terkait CPL" value={form?.values?.cplId ?? ''} {invalid} {describedBy} />{/snippet}</Field>
				<div class="flex items-end"><Button type="submit">Catat temuan</Button></div>
			</form>
		</CardContent>
	</Card>
{/if}

<form method="GET" class="mb-4 flex flex-wrap gap-2" role="search">
	<Input name="cari" type="search" placeholder="Cari kode atau judul" value={query.search} aria-label="Cari temuan" class="max-w-xs" />
	<NativeSelect id="q-status" name="status" label="Saring berdasarkan status" value={query.status} placeholder="Semua status" options={statusOptions} class="max-w-48" />
	<NativeSelect id="q-priority" name="prioritas" label="Saring berdasarkan prioritas" value={query.priority} placeholder="Semua prioritas" options={priorityOptions} class="max-w-44" />
	<Button type="submit" variant="secondary">Terapkan</Button>
</form>

{#if rows.length === 0}
	<EmptyState title={query.search || query.status || query.priority ? 'Tidak ada temuan yang cocok' : 'Belum ada temuan'} description={canCreate ? 'Catat temuan dari data ketercapaian yang perlu ditindaklanjuti.' : 'Temuan yang melibatkan kelas atau tindakan Anda akan muncul di sini.'} />
{:else}
	<div class="overflow-x-auto rounded-lg border bg-card">
		<Table>
			<TableHeader><TableRow><TableHead>Kode</TableHead><TableHead>Temuan</TableHead><TableHead>Prioritas</TableHead><TableHead>Status</TableHead><TableHead class="text-right">Tindakan</TableHead><TableHead class="text-right">Aksi</TableHead></TableRow></TableHeader>
			<TableBody>
				{#each rows as row (row.id)}
					<TableRow>
						<TableCell class="font-mono text-xs">{row.code}</TableCell>
						<TableCell class="max-w-md"><span class="font-medium">{row.title}</span>{#if row.offeringLabel}<span class="block text-xs text-muted-foreground">{row.offeringLabel}</span>{/if}</TableCell>
						<TableCell><StatusBadge status={priorityTone[row.priority] ?? 'neutral'} label={priorityLabels[row.priority as keyof typeof priorityLabels] ?? row.priority} /></TableCell>
						<TableCell><StatusBadge status={statusTone[row.status]} label={statusLabels[row.status]} /></TableCell>
						<TableCell class="text-right text-sm tabular-nums">{row.actionDone}/{row.actionTotal}{#if row.actionOverdue > 0}<span class="block text-xs text-status-danger">{row.actionOverdue} terlambat</span>{/if}</TableCell>
						<TableCell class="text-right"><Button variant="outline" size="sm" href={`${basePath}/${row.id}`}>Buka</Button></TableCell>
					</TableRow>
				{/each}
			</TableBody>
		</Table>
	</div>
	<Pager {page} {pageCount} {total} {href} />
{/if}
