<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { ArrowDown, ArrowUp, ArrowUpDown, Search, X } from '@lucide/svelte';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#lib/components/ui/table/index.ts';
	import EmptyState from '#lib/shared/ui/EmptyState.svelte';
	import NativeSelect from '#lib/shared/ui/NativeSelect.svelte';
	import Pager from '#lib/shared/ui/Pager.svelte';
	import StatusBadge from '#lib/shared/ui/StatusBadge.svelte';
	import { highlightParts, studentPageSizes, type StudentSort } from '../students.search.ts';

	type Row = { id: string; nim: string; name: string; cohortYear: number | null; enrollmentCount: number; semesterCount: number; completeEnrollments: number };
	type Query = { search: string; cohort: string; semester: string; course: string; completeness: string; sort: string; direction: string; pageSize: number };

	let {
		rows,
		total,
		page,
		pageCount,
		pageSize,
		tokens,
		matched,
		cohorts,
		semesters,
		courses,
		query
	}: { rows: Row[]; total: number; page: number; pageCount: number; pageSize: number; tokens: string[]; matched: 'phrase' | 'tokens'; cohorts: number[]; semesters: { id: string; name: string }[]; courses: { id: string; label: string }[]; query: Query } = $props();

	const cohortOptions = $derived([{ value: 'unknown', label: 'Angkatan belum diisi' }, ...cohorts.map((c) => ({ value: String(c), label: `Angkatan ${c}` }))]);
	const semesterOptions = $derived(semesters.map((s) => ({ value: s.id, label: s.name })));
	const courseOptions = $derived(courses.map((c) => ({ value: c.id, label: c.label })));
	const completenessOptions = [
		{ value: 'complete', label: 'Semua nilai lengkap' },
		{ value: 'incomplete', label: 'Ada yang belum lengkap' }
	];

	type Params = Partial<{ cari: string; angkatan: string; semester: string; matkul: string; kelengkapan: string; urut: string; arah: string; ukuran: string; halaman: string }>;

	const current = $derived<Params>({
		cari: query.search,
		angkatan: query.cohort,
		semester: query.semester,
		matkul: query.course,
		kelengkapan: query.completeness,
		urut: query.sort,
		arah: query.direction,
		ukuran: query.pageSize === 20 ? '' : String(query.pageSize)
	});
	const build = (changes: Params) => {
		const merged = { ...current, ...changes };
		const params = new URLSearchParams();
		for (const [key, value] of Object.entries(merged)) if (value) params.set(key, value);
		const text = params.toString();
		return text ? `?${text}` : '?';
	};
	const pageHref = (target: number) => build({ halaman: target > 1 ? String(target) : '' });
	const sizeHref = (size: number) => build({ ukuran: size === 20 ? '' : String(size), halaman: '' });
	const sortHref = (key: StudentSort) => build({ urut: key, arah: query.sort === key && query.direction !== 'turun' ? 'turun' : 'naik', halaman: '' });
	const sortState = (key: StudentSort) => (query.sort === key ? (query.direction === 'turun' ? 'descending' : 'ascending') : 'none');

	const labelOf = (options: { value: string; label: string }[], value: string) => options.find((o) => o.value === value)?.label ?? value;
	const chips = $derived(
		[
			query.search ? { key: 'cari', label: `Kata kunci “${query.search}”` } : null,
			query.cohort ? { key: 'angkatan', label: labelOf(cohortOptions, query.cohort) } : null,
			query.semester ? { key: 'semester', label: labelOf(semesterOptions, query.semester) } : null,
			query.course ? { key: 'matkul', label: labelOf(courseOptions, query.course) } : null,
			query.completeness ? { key: 'kelengkapan', label: labelOf(completenessOptions, query.completeness) } : null
		].filter((chip): chip is { key: keyof Params; label: string } => chip !== null)
	);

	let timer: ReturnType<typeof setTimeout> | undefined;
	function searchAsYouType(event: Event) {
		const value = (event.currentTarget as HTMLInputElement).value.trim();
		clearTimeout(timer);
		timer = setTimeout(() => {
			if (value !== query.search) void goto(build({ cari: value, halaman: '' }), { replace: true, reset: false });
		}, 350);
	}
</script>

<form method="GET" class="mb-3 grid gap-2 md:grid-cols-3 xl:grid-cols-6" role="search">
	<div class="relative xl:col-span-2">
		<Search class="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" aria-hidden="true" />
		<Input name="cari" type="search" placeholder="Cari NIM atau nama (beberapa kata, urutan bebas)" value={query.search} aria-label="Cari mahasiswa" class="pl-8" oninput={searchAsYouType} autocomplete="off" />
	</div>
	<NativeSelect id="f-angkatan" name="angkatan" label="Saring berdasarkan angkatan" value={query.cohort} placeholder="Semua angkatan" options={cohortOptions} />
	<NativeSelect id="f-semester" name="semester" label="Saring berdasarkan semester" value={query.semester} placeholder="Semua semester" options={semesterOptions} />
	<NativeSelect id="f-matkul" name="matkul" label="Saring berdasarkan mata kuliah" value={query.course} placeholder="Semua mata kuliah" options={courseOptions} />
	<NativeSelect id="f-kelengkapan" name="kelengkapan" label="Saring berdasarkan kelengkapan nilai" value={query.completeness} placeholder="Semua kelengkapan" options={completenessOptions} />
	{#if query.sort}<input type="hidden" name="urut" value={query.sort} />{/if}
	{#if query.direction}<input type="hidden" name="arah" value={query.direction} />{/if}
	{#if query.pageSize !== 20}<input type="hidden" name="ukuran" value={query.pageSize} />{/if}
	<div class="md:col-span-3 xl:col-span-6"><Button type="submit" variant="secondary">Terapkan filter</Button> <Button variant="ghost" href="?">Atur ulang</Button></div>
</form>

<div class="mb-3 flex flex-wrap items-center gap-2 text-sm">
	<p class="text-muted-foreground" aria-live="polite"><span class="font-medium text-foreground tabular-nums">{total}</span> mahasiswa{chips.length ? ' sesuai pencarian' : ''}</p>
	{#if tokens.length > 1 && matched === 'tokens' && total > 0}<span class="text-xs text-muted-foreground">Tidak ada yang memuat frasa utuh; ditampilkan yang memuat semua kata.</span>{/if}
	{#each chips as chip (chip.key)}
		<a href={build({ [chip.key]: '', halaman: '' })} class="inline-flex max-w-72 items-center gap-1 rounded-full border bg-card px-2.5 py-0.5 text-xs hover:bg-muted" aria-label={`Hapus penyaring ${chip.label}`}>
			<span class="truncate">{chip.label}</span>
			<X class="size-3 shrink-0" aria-hidden="true" />
		</a>
	{/each}
</div>

{#snippet sortHead(key: StudentSort, label: string, align: 'left' | 'right' = 'left')}
	<TableHead aria-sort={sortState(key)} class={align === 'right' ? 'text-right' : ''}>
		<a href={sortHref(key)} class="inline-flex items-center gap-1 hover:text-foreground" aria-label={`Urutkan menurut ${label}`}>
			{label}
			{#if query.sort === key}
				{#if query.direction === 'turun'}<ArrowDown class="size-3.5" aria-hidden="true" />{:else}<ArrowUp class="size-3.5" aria-hidden="true" />{/if}
			{:else}
				<ArrowUpDown class="size-3.5 text-muted-foreground" aria-hidden="true" />
			{/if}
		</a>
	</TableHead>
{/snippet}

{#snippet marked(text: string)}
	{#each highlightParts(text, tokens) as part, i (i)}{#if part.match}<mark class="rounded-sm bg-primary-muted px-0.5 text-foreground">{part.text}</mark>{:else}{part.text}{/if}{/each}
{/snippet}

{#if rows.length === 0}
	<EmptyState title="Tidak ada mahasiswa" description={chips.length ? 'Tidak ada yang cocok. Hapus salah satu penyaring di atas atau coba kata kunci yang lebih pendek.' : 'Mahasiswa muncul setelah nilai diimpor.'} actionLabel={chips.length ? 'Atur ulang pencarian' : 'Impor nilai'} actionHref={chips.length ? '?' : '/app/admin/imports'} />
{:else}
	<div class="overflow-x-auto rounded-lg border bg-card">
		<Table>
			<TableHeader>
				<TableRow>
					{@render sortHead('nim', 'NIM')}
					{@render sortHead('nama', 'Nama')}
					{@render sortHead('angkatan', 'Angkatan')}
					{@render sortHead('matkul', 'Mata kuliah', 'right')}
					<TableHead class="text-right">Semester</TableHead>
					<TableHead>Kelengkapan nilai</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{#each rows as row (row.id)}
					<TableRow>
						<TableCell class="font-mono text-xs">{@render marked(row.nim)}</TableCell>
						<TableCell><a class="font-medium text-primary underline-offset-4 hover:underline" href={`/app/students/${row.id}`}>{@render marked(row.name)}</a></TableCell>
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
	<Pager {page} {pageCount} {total} {pageSize} shown={rows.length} href={pageHref} pageSizes={studentPageSizes} {sizeHref} />
{/if}
