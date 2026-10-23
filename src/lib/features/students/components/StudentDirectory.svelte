<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#lib/components/ui/table/index.ts';
	import EmptyState from '#lib/shared/ui/EmptyState.svelte';
	import NativeSelect from '#lib/shared/ui/NativeSelect.svelte';
	import Pager from '#lib/shared/ui/Pager.svelte';
	import StatusBadge from '#lib/shared/ui/StatusBadge.svelte';

	type Row = { id: string; nim: string; name: string; cohortYear: number | null; enrollmentCount: number; semesterCount: number; completeEnrollments: number };
	type Query = { search: string; cohort: string; semester: string; course: string; completeness: string };

	let { rows, total, page, pageCount, cohorts, semesters, courses, query }: { rows: Row[]; total: number; page: number; pageCount: number; cohorts: number[]; semesters: { id: string; name: string }[]; courses: { id: string; label: string }[]; query: Query } = $props();

	const cohortOptions = $derived([{ value: 'unknown', label: 'Angkatan belum diisi' }, ...cohorts.map((c) => ({ value: String(c), label: `Angkatan ${c}` }))]);
	const semesterOptions = $derived(semesters.map((s) => ({ value: s.id, label: s.name })));
	const courseOptions = $derived(courses.map((c) => ({ value: c.id, label: c.label })));
	const completenessOptions = [
		{ value: 'complete', label: 'Semua nilai lengkap' },
		{ value: 'incomplete', label: 'Ada yang belum lengkap' }
	];
	const href = (target: number) => `?${new URLSearchParams({ ...(query.search ? { cari: query.search } : {}), ...(query.cohort ? { angkatan: query.cohort } : {}), ...(query.semester ? { semester: query.semester } : {}), ...(query.course ? { matkul: query.course } : {}), ...(query.completeness ? { kelengkapan: query.completeness } : {}), halaman: String(target) })}`;
</script>

<form method="GET" class="mb-4 grid gap-2 md:grid-cols-3 xl:grid-cols-6" role="search">
	<Input name="cari" type="search" placeholder="Cari NIM atau nama" value={query.search} aria-label="Cari mahasiswa" class="xl:col-span-2" />
	<NativeSelect id="f-angkatan" name="angkatan" label="Saring berdasarkan angkatan" value={query.cohort} placeholder="Semua angkatan" options={cohortOptions} />
	<NativeSelect id="f-semester" name="semester" label="Saring berdasarkan semester" value={query.semester} placeholder="Semua semester" options={semesterOptions} />
	<NativeSelect id="f-matkul" name="matkul" label="Saring berdasarkan mata kuliah" value={query.course} placeholder="Semua mata kuliah" options={courseOptions} />
	<NativeSelect id="f-kelengkapan" name="kelengkapan" label="Saring berdasarkan kelengkapan nilai" value={query.completeness} placeholder="Semua kelengkapan" options={completenessOptions} />
	<div class="md:col-span-3 xl:col-span-6"><Button type="submit" variant="secondary">Terapkan filter</Button> <Button variant="ghost" href="?">Atur ulang</Button></div>
</form>

{#if rows.length === 0}
	<EmptyState title="Tidak ada mahasiswa" description="Mahasiswa muncul setelah nilai diimpor, atau ubah filter pencarian." actionLabel="Impor nilai" actionHref="/app/admin/imports" />
{:else}
	<div class="overflow-x-auto rounded-lg border bg-card">
		<Table>
			<TableHeader>
				<TableRow><TableHead>NIM</TableHead><TableHead>Nama</TableHead><TableHead>Angkatan</TableHead><TableHead class="text-right">Mata kuliah</TableHead><TableHead class="text-right">Semester</TableHead><TableHead>Kelengkapan nilai</TableHead></TableRow>
			</TableHeader>
			<TableBody>
				{#each rows as row (row.id)}
					<TableRow>
						<TableCell class="font-mono text-xs">{row.nim}</TableCell>
						<TableCell><a class="font-medium text-primary underline-offset-4 hover:underline" href={`/app/students/${row.id}`}>{row.name}</a></TableCell>
						<TableCell>
							<form method="POST" action="?/setCohort" use:enhance={() => async ({ update }) => update({ reset: false })} class="flex items-center gap-1">
								<input type="hidden" name="studentId" value={row.id} />
								<Input name="cohortYear" inputmode="numeric" value={row.cohortYear ?? ''} placeholder="—" class="h-8 w-20" aria-label={`Angkatan ${row.name}`} />
								<Button type="submit" size="sm" variant="ghost">Simpan</Button>
							</form>
						</TableCell>
						<TableCell class="text-right tabular-nums">{row.enrollmentCount}</TableCell>
						<TableCell class="text-right tabular-nums">{row.semesterCount}</TableCell>
						<TableCell><StatusBadge status={row.completeEnrollments === row.enrollmentCount ? 'success' : 'warning'} label={`${row.completeEnrollments} dari ${row.enrollmentCount} lengkap`} /></TableCell>
					</TableRow>
				{/each}
			</TableBody>
		</Table>
	</div>
	<Pager {page} {pageCount} {total} {href} />
{/if}
