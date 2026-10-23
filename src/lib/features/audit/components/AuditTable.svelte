<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#lib/components/ui/table/index.ts';
	import EmptyState from '#lib/shared/ui/EmptyState.svelte';
	import NativeSelect from '#lib/shared/ui/NativeSelect.svelte';
	import Pager from '#lib/shared/ui/Pager.svelte';

	type Row = { id: string; createdAt: Date; action: string; entityType: string; entityId: string | null; summary: string; actorName: string | null; actorRole: string | null; before: unknown; after: unknown };

	let { rows, total, page, pageCount, search, entityType, entities }: { rows: Row[]; total: number; page: number; pageCount: number; search: string; entityType: string; entities: string[] } = $props();

	const stamp = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'medium' });
	const href = (target: number) => `?${new URLSearchParams({ ...(search ? { cari: search } : {}), ...(entityType ? { entitas: entityType } : {}), halaman: String(target) })}`;
	const json = (value: unknown) => JSON.stringify(value, null, 2);
</script>

<form method="GET" class="mb-4 flex flex-wrap gap-2" role="search">
	<Input name="cari" type="search" placeholder="Cari ringkasan atau aksi" value={search} aria-label="Cari jejak audit" class="max-w-xs" />
	<NativeSelect id="entitas" name="entitas" label="Saring berdasarkan entitas" value={entityType} placeholder="Semua entitas" options={entities.map((e) => ({ value: e, label: e }))} class="max-w-56" />
	<Button type="submit" variant="secondary">Terapkan</Button>
</form>

{#if rows.length === 0}
	<EmptyState title="Tidak ada catatan" description="Belum ada aktivitas yang cocok dengan filter." actionLabel="Hapus filter" actionHref="/app/admin/audit" />
{:else}
	<div class="overflow-x-auto rounded-lg border bg-card">
		<Table>
			<TableHeader><TableRow><TableHead>Waktu</TableHead><TableHead>Pelaku</TableHead><TableHead>Aksi</TableHead><TableHead>Ringkasan</TableHead></TableRow></TableHeader>
			<TableBody>
				{#each rows as row (row.id)}
					<TableRow>
						<TableCell class="whitespace-nowrap text-xs">{stamp.format(new Date(row.createdAt))}</TableCell>
						<TableCell class="text-sm">{row.actorName ?? 'Sistem'}<span class="block text-xs text-muted-foreground">{row.actorRole ?? ''}</span></TableCell>
						<TableCell class="font-mono text-xs">{row.action}</TableCell>
						<TableCell class="max-w-md text-sm">
							{row.summary}
							{#if row.before || row.after}
								<details class="mt-1 text-xs"><summary class="cursor-pointer text-muted-foreground">Rincian</summary>
									{#if row.before}<p class="mt-1 font-medium">Sebelum</p><pre class="max-h-48 overflow-auto rounded bg-muted p-2">{json(row.before)}</pre>{/if}
									{#if row.after}<p class="mt-1 font-medium">Sesudah</p><pre class="max-h-48 overflow-auto rounded bg-muted p-2">{json(row.after)}</pre>{/if}
								</details>
							{/if}
						</TableCell>
					</TableRow>
				{/each}
			</TableBody>
		</Table>
	</div>
	<Pager {page} {pageCount} {total} {href} />
{/if}
