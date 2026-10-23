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
	import StatusBadge from '#lib/shared/ui/StatusBadge.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form: rawForm }: { data: PageData; form: ActionData } = $props();
	const form = $derived(rawForm as FormState);

	const statusLabel = { planned: 'Direncanakan', active: 'Aktif', closed: 'Ditutup' } as const;
	const statusTone = { planned: 'info', active: 'success', closed: 'neutral' } as const;
	const allSemesters = $derived(data.years.flatMap((year) => year.semesters));
	const yearOptions = $derived(data.years.map((year) => ({ value: year.id, label: year.code })));
	const termOptions = [
		{ value: 'ganjil', label: 'Ganjil' },
		{ value: 'genap', label: 'Genap' },
		{ value: 'pendek', label: 'Pendek' }
	];
	const dateFormat = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
	const fmt = (iso: string) => dateFormat.format(new Date(`${iso}T00:00:00`));
</script>

<svelte:head><title>Tahun akademik · OBE Teknik Biomedis</title></svelte:head>

<PageHeader title="Tahun akademik dan semester" description="Satu semester aktif pada satu waktu. Mengaktifkan semester menutup semester aktif sebelumnya." />

<div class="mb-4"><FormMessage message={form?.message} success={form?.success} /></div>

<div class="mb-8 grid gap-4 lg:grid-cols-2">
	<Card>
		<CardHeader><CardTitle>Tambah tahun akademik</CardTitle><CardDescription>Kode dibentuk otomatis, misalnya 2026/2027.</CardDescription></CardHeader>
		<CardContent>
			<form method="POST" action="?/createYear" use:enhance class="flex items-end gap-3">
				<div class="flex-1">
					<Field id="startYear" label="Tahun mulai" errors={errorsOf(form, 'startYear')}>
						{#snippet children({ describedBy, invalid })}
							<Input id="startYear" name="startYear" type="number" min="2000" max="2100" required value={form?.values?.startYear ?? ''} aria-invalid={invalid} aria-describedby={describedBy} />
						{/snippet}
					</Field>
				</div>
				<Button type="submit">Tambah</Button>
			</form>
		</CardContent>
	</Card>

	<Card>
		<CardHeader><CardTitle>Tambah semester</CardTitle><CardDescription>Tiap tahun akademik memiliki satu semester per jenis.</CardDescription></CardHeader>
		<CardContent>
			<form method="POST" action="?/createSemester" use:enhance class="grid gap-3 sm:grid-cols-2">
				<Field id="academicYearId" label="Tahun akademik" errors={errorsOf(form, 'academicYearId')}>
					{#snippet children({ describedBy, invalid })}
						<NativeSelect id="academicYearId" name="academicYearId" options={yearOptions} placeholder="Pilih tahun" required {invalid} {describedBy} />
					{/snippet}
				</Field>
				<Field id="term" label="Jenis semester" errors={errorsOf(form, 'term')}>
					{#snippet children({ describedBy, invalid })}
						<NativeSelect id="term" name="term" options={termOptions} placeholder="Pilih jenis" required {invalid} {describedBy} />
					{/snippet}
				</Field>
				<Field id="startDate" label="Tanggal mulai" errors={errorsOf(form, 'startDate')}>
					{#snippet children({ describedBy, invalid })}
						<Input id="startDate" name="startDate" type="date" required aria-invalid={invalid} aria-describedby={describedBy} />
					{/snippet}
				</Field>
				<Field id="endDate" label="Tanggal akhir" errors={errorsOf(form, 'endDate')}>
					{#snippet children({ describedBy, invalid })}
						<Input id="endDate" name="endDate" type="date" required aria-invalid={invalid} aria-describedby={describedBy} />
					{/snippet}
				</Field>
				<div class="sm:col-span-2"><Button type="submit">Tambah semester</Button></div>
			</form>
		</CardContent>
	</Card>
</div>

{#if allSemesters.length === 0 && data.years.length === 0}
	<EmptyState title="Belum ada tahun akademik" description="Tambahkan tahun akademik terlebih dahulu, lalu buat semester di dalamnya." />
{/if}

<div class="space-y-6">
	{#each data.years as year (year.id)}
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<h2 class="text-lg font-semibold">{year.code}</h2>
					{#if year.isActive}<StatusBadge status="success" label="Tahun aktif" />{/if}
				</CardTitle>
			</CardHeader>
			<CardContent>
				{#if year.semesters.length === 0}
					<p class="text-sm text-muted-foreground">Belum ada semester.</p>
				{:else}
					<Table>
						<TableHeader>
							<TableRow><TableHead>Semester</TableHead><TableHead>Periode</TableHead><TableHead>Status</TableHead><TableHead class="text-right">Aksi</TableHead></TableRow>
						</TableHeader>
						<TableBody>
							{#each year.semesters as semester (semester.id)}
								<TableRow>
									<TableCell class="font-medium">{semester.name}</TableCell>
									<TableCell>{fmt(semester.startDate)} – {fmt(semester.endDate)}</TableCell>
									<TableCell><StatusBadge status={statusTone[semester.status]} label={statusLabel[semester.status]} /></TableCell>
									<TableCell class="text-right">
										<div class="flex justify-end gap-2">
											{#if semester.status !== 'active'}
												<ConfirmForm action="?/activate" fields={{ semesterId: semester.id }} triggerLabel="Aktifkan" title="Aktifkan semester ini?" description="Semester aktif saat ini akan ditutup. Impor dan dashboard memakai semester aktif." confirmLabel="Aktifkan" />
											{/if}
											{#if semester.status !== 'closed'}
												<ConfirmForm action="?/close" fields={{ semesterId: semester.id }} triggerLabel="Tutup" title="Tutup semester ini?" description="Semester ditutup dan tidak lagi dianggap berjalan." confirmLabel="Tutup semester" />
											{/if}
										</div>
									</TableCell>
								</TableRow>
							{/each}
						</TableBody>
					</Table>
				{/if}
			</CardContent>
		</Card>
	{/each}
</div>
