<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#lib/components/ui/table/index.ts';
	import EmptyState from '#lib/shared/ui/EmptyState.svelte';
	import NativeSelect from '#lib/shared/ui/NativeSelect.svelte';
	import Pager from '#lib/shared/ui/Pager.svelte';
	import StatusBadge from '#lib/shared/ui/StatusBadge.svelte';
	import { batchStatusLabel, batchStatusTone } from '../imports.labels.ts';

	type Row = { id: string; fileName: string; status: string; createdAt: Date; uploaderName: string; sheetCount: number; totalRows: number; errorRows: number; scoresInserted: number; scoresUpdated: number };

	let { rows, total, page, pageCount, search, status, basePath, showUploader = false }: { rows: Row[]; total: number; page: number; pageCount: number; search: string; status: string; basePath: string; showUploader?: boolean } = $props();

	const stamp = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
	const href = (target: number) => `?${new URLSearchParams({ ...(search ? { cari: search } : {}), ...(status ? { status } : {}), halaman: String(target) })}`;
	const statusOptions = Object.entries(batchStatusLabel).map(([value, label]) => ({ value, label }));
</script>

<form method="GET" class="mb-4 flex flex-wrap gap-2" role="search">
	<Input name="cari" type="search" placeholder="Cari nama berkas" value={search} aria-label="Cari berkas impor" class="max-w-xs" />
	<NativeSelect id="status" name="status" label="Saring berdasarkan status" value={status} placeholder="Semua status" options={statusOptions} class="max-w-48" />
	<Button type="submit" variant="secondary">Terapkan</Button>
</form>

{#if rows.length === 0}
	<EmptyState
		title={search || status ? 'Tidak ada impor yang cocok' : 'Belum ada impor'}
		description={search || status ? 'Ubah kata kunci atau status, atau hapus filter.' : 'Batch yang Anda unggah akan muncul di sini beserta statusnya.'}
		actionLabel={search || status ? 'Hapus filter' : showUploader ? undefined : 'Mulai impor nilai'}
		actionHref={search || status ? basePath : showUploader ? undefined : basePath.replace(/imports$/, 'import')}
	/>
{:else}
	<div class="overflow-x-auto rounded-lg border bg-card">
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Berkas</TableHead>
					{#if showUploader}<TableHead>Pengunggah</TableHead>{/if}
					<TableHead>Waktu</TableHead>
					<TableHead class="text-right">Sheet</TableHead>
					<TableHead class="text-right">Nilai baru / diubah</TableHead>
					<TableHead>Status</TableHead>
					<TableHead class="text-right">Aksi</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{#each rows as row (row.id)}
					<TableRow>
						<TableCell class="max-w-72 truncate font-medium" title={row.fileName}>{row.fileName}</TableCell>
						{#if showUploader}<TableCell>{row.uploaderName}</TableCell>{/if}
						<TableCell>{stamp.format(new Date(row.createdAt))}</TableCell>
						<TableCell class="text-right tabular-nums">{row.sheetCount}</TableCell>
						<TableCell class="text-right tabular-nums">{row.scoresInserted} / {row.scoresUpdated}</TableCell>
						<TableCell><StatusBadge status={batchStatusTone[row.status] ?? 'neutral'} label={batchStatusLabel[row.status] ?? row.status} /></TableCell>
						<TableCell class="text-right"><Button variant="outline" size="sm" href={`${basePath}/${row.id}`}>{row.status === 'committed' || row.status === 'cancelled' ? 'Lihat laporan' : 'Lanjutkan'}</Button></TableCell>
					</TableRow>
				{/each}
			</TableBody>
		</Table>
	</div>
	<Pager {page} {pageCount} {total} {href} />
{/if}
