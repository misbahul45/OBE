<script lang="ts">
	import { FileDown } from '@lucide/svelte';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#lib/components/ui/table/index.ts';
	import EmptyState from '#lib/shared/ui/EmptyState.svelte';
	import NativeSelect from '#lib/shared/ui/NativeSelect.svelte';
	import Pager from '#lib/shared/ui/Pager.svelte';

	type Row = { id: string; courseCode: string; courseName: string; section: string; students: number };

	let { semesters, semesterId, search, rows, total, page, pageCount }: { semesters: { id: string; name: string }[]; semesterId: string; search: string; rows: Row[]; total: number; page: number; pageCount: number } = $props();

	const href = (target: number) => `?${new URLSearchParams({ semester: semesterId, ...(search ? { cari: search } : {}), halaman: String(target) })}`;
</script>

<form method="GET" class="mb-4 flex flex-wrap gap-2" role="search">
	<NativeSelect id="semester" name="semester" label="Pilih semester" value={semesterId} options={semesters.map((s) => ({ value: s.id, label: s.name }))} class="max-w-60" />
	<Input name="cari" type="search" placeholder="Cari kode atau nama mata kuliah" value={search} aria-label="Cari kelas" class="max-w-xs" />
	<Button type="submit" variant="secondary">Terapkan</Button>
</form>

{#if rows.length === 0}
	<EmptyState title="Tidak ada kelas" description="Pilih semester lain atau buat penawaran kelas terlebih dahulu." actionLabel="Buka Penawaran kelas" actionHref="/app/admin/offerings" />
{:else}
	<div class="overflow-x-auto rounded-lg border bg-card">
		<Table>
			<TableHeader><TableRow><TableHead>Kode</TableHead><TableHead>Mata kuliah</TableHead><TableHead>Kelas</TableHead><TableHead class="text-right">Mahasiswa</TableHead><TableHead class="text-right">Laporan</TableHead></TableRow></TableHeader>
			<TableBody>
				{#each rows as row (row.id)}
					<TableRow>
						<TableCell class="font-mono text-sm">{row.courseCode}</TableCell>
						<TableCell class="font-medium">{row.courseName}</TableCell>
						<TableCell>{row.section}</TableCell>
						<TableCell class="text-right tabular-nums">{row.students}</TableCell>
						<TableCell class="text-right"><Button variant="outline" size="sm" href={`/app/admin/offerings/${row.id}/report.pdf`} download class="gap-1.5"><FileDown class="size-4" aria-hidden="true" />PDF kelas</Button></TableCell>
					</TableRow>
				{/each}
			</TableBody>
		</Table>
	</div>
	<Pager {page} {pageCount} {total} {href} />
{/if}
