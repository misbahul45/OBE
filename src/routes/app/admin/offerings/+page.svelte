<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#lib/components/ui/card/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#lib/components/ui/table/index.ts';
	import { errorsOf, type FormState } from '#lib/shared/http/form-state.ts';
	import ConfirmForm from '#lib/shared/ui/ConfirmForm.svelte';
	import EmptyState from '#lib/shared/ui/EmptyState.svelte';
	import Field from '#lib/shared/ui/Field.svelte';
	import FormMessage from '#lib/shared/ui/FormMessage.svelte';
	import NativeSelect from '#lib/shared/ui/NativeSelect.svelte';
	import PageHeader from '#lib/shared/ui/PageHeader.svelte';
	import Pager from '#lib/shared/ui/Pager.svelte';
	import StatusBadge from '#lib/shared/ui/StatusBadge.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form: rawForm }: { data: PageData; form: ActionData } = $props();
	const form = $derived(rawForm as FormState);
	const semesterOptions = $derived(data.semesters.map((s) => ({ value: s.id, label: s.status === 'active' ? `${s.name} (aktif)` : s.name })));
	const courseOptions = $derived(data.courses.map((c) => ({ value: c.id, label: c.label })));
	const lecturerOptions = $derived(data.lecturers.map((l) => ({ value: l.id, label: l.lecturerCode ? `${l.name} (${l.lecturerCode})` : l.name })));
	const href = (page: number) => `?${new URLSearchParams({ ...(data.semesterId ? { semester: data.semesterId } : {}), ...(data.search ? { cari: data.search } : {}), halaman: String(page) })}`;
	const semesterTone = { planned: 'info', active: 'success', closed: 'neutral' } as const;
</script>

<svelte:head><title>Penawaran kelas · OBE Teknik Biomedis</title></svelte:head>

<PageHeader title="Penawaran kelas dan penugasan dosen" description="Satu mata kuliah dapat ditawarkan di banyak semester dan kelas paralel. Dosen hanya mengelola kelas yang ditugaskan kepadanya." />

<div class="mb-4"><FormMessage message={form?.message} success={form?.success} /></div>

<Card class="mb-8">
	<CardHeader><CardTitle>Tambah penawaran kelas</CardTitle><CardDescription>Pilih mata kuliah dan semester, lalu tentukan kode kelas (bawaan A).</CardDescription></CardHeader>
	<CardContent>
		<form method="POST" action="?/create" use:enhance class="grid gap-4 md:grid-cols-4">
			<div class="md:col-span-2">
				<Field id="courseId" label="Mata kuliah" errors={errorsOf(form, 'courseId')}>
					{#snippet children({ describedBy, invalid })}
						<NativeSelect id="courseId" name="courseId" options={courseOptions} placeholder="Pilih mata kuliah" required {invalid} {describedBy} />
					{/snippet}
				</Field>
			</div>
			<Field id="semesterId" label="Semester" errors={errorsOf(form, 'semesterId')}>
				{#snippet children({ describedBy, invalid })}
					<NativeSelect id="semesterId" name="semesterId" options={semesterOptions} placeholder="Pilih semester" required {invalid} {describedBy} />
				{/snippet}
			</Field>
			<Field id="section" label="Kelas" errors={errorsOf(form, 'section')} hint="Contoh: A, T1">
				{#snippet children({ describedBy, invalid })}
					<Input id="section" name="section" placeholder="A" aria-invalid={invalid} aria-describedby={describedBy} />
				{/snippet}
			</Field>
			<div class="md:col-span-4"><Button type="submit">Tambah penawaran</Button></div>
		</form>
	</CardContent>
</Card>

<form method="GET" class="mb-4 flex flex-wrap gap-2" role="search">
	<NativeSelect id="filter-semester" name="semester" label="Saring berdasarkan semester" value={data.semesterId} placeholder="Semua semester" options={semesterOptions} class="max-w-60" />
	<Input name="cari" type="search" placeholder="Cari kode atau nama mata kuliah" value={data.search} aria-label="Cari penawaran" class="max-w-xs" />
	<Button type="submit" variant="secondary">Terapkan</Button>
</form>

{#if data.offerings.rows.length === 0}
	<EmptyState title="Belum ada penawaran kelas" description="Penawaran kelas memerlukan semester aktif dan mata kuliah. Setelah keduanya ada, buat penawaran lalu tugaskan dosen pengampu." actionLabel="Periksa Mata kuliah" actionHref="/app/admin/courses" />
{:else}
	<div class="overflow-x-auto rounded-lg border bg-card">
		<Table>
			<TableHeader>
				<TableRow><TableHead>Mata kuliah</TableHead><TableHead>Semester</TableHead><TableHead>Kelas</TableHead><TableHead class="text-right">Mahasiswa</TableHead><TableHead>Dosen pengampu</TableHead><TableHead class="text-right">Aksi</TableHead></TableRow>
			</TableHeader>
			<TableBody>
				{#each data.offerings.rows as offering (offering.id)}
					<TableRow>
						<TableCell><div class="font-medium">{offering.courseName}</div><div class="font-mono text-xs text-muted-foreground">{offering.courseCode} · {offering.credits} SKS</div></TableCell>
						<TableCell><div>{offering.semesterName}</div><StatusBadge status={semesterTone[offering.semesterStatus]} label={offering.semesterStatus === 'active' ? 'Aktif' : offering.semesterStatus === 'closed' ? 'Ditutup' : 'Direncanakan'} /></TableCell>
						<TableCell class="font-mono">{offering.section}</TableCell>
						<TableCell class="text-right tabular-nums">{offering.enrollmentCount}</TableCell>
						<TableCell class="min-w-64">
							<ul class="mb-2 space-y-1">
								{#each offering.lecturers as lecturer (lecturer.assignmentId)}
									<li class="flex items-center justify-between gap-2 text-sm">
										<span>{lecturer.name}{lecturer.role === 'coordinator' ? ' (koordinator)' : ''}</span>
										<ConfirmForm action="?/unassign" fields={{ assignmentId: lecturer.assignmentId }} triggerLabel="Cabut" tone="destructive" title="Cabut penugasan?" description="Dosen kehilangan akses ke kelas ini seketika." confirmLabel="Cabut penugasan" />
									</li>
								{:else}
									<li class="text-sm text-muted-foreground">Belum ada dosen</li>
								{/each}
							</ul>
							<form method="POST" action="?/assign" use:enhance class="flex gap-2">
								<input type="hidden" name="offeringId" value={offering.id} />
								<NativeSelect id={`lecturer-${offering.id}`} name="lecturerId" label={`Tugaskan dosen untuk ${offering.courseName}`} options={lecturerOptions} placeholder="Tugaskan dosen" required class="min-w-40" />
								<Button type="submit" size="sm" variant="secondary">Tugaskan</Button>
							</form>
						</TableCell>
						<TableCell class="text-right"><Button variant="outline" size="sm" href={`/app/admin/offerings/${offering.id}`}>Buka kelas</Button></TableCell>
					</TableRow>
				{/each}
			</TableBody>
		</Table>
	</div>
	<Pager page={data.offerings.page} pageCount={data.offerings.pageCount} total={data.offerings.total} {href} />
{/if}
