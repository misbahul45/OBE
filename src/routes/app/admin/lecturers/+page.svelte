<script lang="ts">
	import { enhance } from '$app/forms';
	import { Copy } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { Alert, AlertDescription, AlertTitle } from '#lib/components/ui/alert/index.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Card, CardContent, CardHeader, CardTitle } from '#lib/components/ui/card/index.ts';
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
	const editing = $derived(data.editing);
	const field = (name: 'name' | 'email' | 'lecturerCode' | 'nidn') => form?.values?.[name] ?? (editing ? String((editing as Record<string, unknown>)[name] ?? '') : '');
	const href = (page: number) => `?${new URLSearchParams({ ...(data.search ? { cari: data.search } : {}), ...(data.status !== 'all' ? { status: data.status } : {}), halaman: String(page) })}`;

	async function copyPassword() {
		if (!form?.temporaryPassword) return;
		await navigator.clipboard.writeText(form.temporaryPassword);
		toast.success('Password sementara disalin ke papan klip.');
	}
</script>

<svelte:head><title>Dosen · OBE Teknik Biomedis</title></svelte:head>

<PageHeader title="Dosen" description="Akun dosen dibuat oleh Super Admin. Tidak ada pendaftaran mandiri." />

<div class="mb-4 space-y-3">
	<FormMessage message={form?.message} />
	{#if form?.temporaryPassword}
		<Alert role="status">
			<AlertTitle>Password sementara untuk {form.temporaryEmail}</AlertTitle>
			<AlertDescription>
				<p class="mb-2">{form.success}</p>
				<div class="flex flex-wrap items-center gap-2">
					<code class="rounded bg-muted px-2 py-1 font-mono text-sm" data-testid="temporary-password">{form.temporaryPassword}</code>
					<Button type="button" variant="outline" size="sm" onclick={copyPassword} class="gap-1.5"><Copy class="size-3.5" aria-hidden="true" />Salin</Button>
				</div>
				<p class="mt-2 text-xs text-muted-foreground">Dosen wajib mengganti password ini saat masuk pertama kali.</p>
			</AlertDescription>
		</Alert>
	{:else}
		<FormMessage success={form?.success} />
	{/if}
</div>

<Card class="mb-8">
	<CardHeader><CardTitle>{editing ? `Ubah ${editing.name}` : 'Tambah dosen'}</CardTitle></CardHeader>
	<CardContent>
		{#key editing?.id ?? 'baru'}
			<form method="POST" action={editing ? '?/update' : '?/create'} use:enhance class="grid gap-4 md:grid-cols-2">
				{#if editing}<input type="hidden" name="id" value={editing.id} />{/if}
				<Field id="name" label="Nama lengkap" errors={errorsOf(form, 'name')}>
					{#snippet children({ describedBy, invalid })}
						<Input id="name" name="name" required value={field('name')} aria-invalid={invalid} aria-describedby={describedBy} />
					{/snippet}
				</Field>
				<Field id="email" label="Email" errors={errorsOf(form, 'email')} hint={editing ? 'Email tidak dapat diubah.' : undefined}>
					{#snippet children({ describedBy, invalid })}
						<Input id="email" name="email" type="email" required disabled={!!editing} value={field('email')} aria-invalid={invalid} aria-describedby={describedBy} />
					{/snippet}
				</Field>
				<Field id="lecturerCode" label="Kode dosen (opsional)" errors={errorsOf(form, 'lecturerCode')}>
					{#snippet children({ describedBy, invalid })}
						<Input id="lecturerCode" name="lecturerCode" value={field('lecturerCode')} aria-invalid={invalid} aria-describedby={describedBy} />
					{/snippet}
				</Field>
				<Field id="nidn" label="NIDN (opsional)" errors={errorsOf(form, 'nidn')}>
					{#snippet children({ describedBy, invalid })}
						<Input id="nidn" name="nidn" inputmode="numeric" value={field('nidn')} aria-invalid={invalid} aria-describedby={describedBy} />
					{/snippet}
				</Field>
				<div class="flex gap-2 md:col-span-2">
					<Button type="submit">{editing ? 'Simpan perubahan' : 'Buat akun dosen'}</Button>
					{#if editing}<Button variant="outline" href="?">Batal</Button>{/if}
				</div>
			</form>
		{/key}
	</CardContent>
</Card>

<form method="GET" class="mb-4 flex flex-wrap gap-2" role="search">
	<Input name="cari" type="search" placeholder="Cari nama, email, atau kode" value={data.search} aria-label="Cari dosen" class="max-w-xs" />
	<NativeSelect id="status" name="status" label="Saring berdasarkan status akun" value={data.status} class="max-w-40" options={[{ value: 'all', label: 'Semua status' }, { value: 'active', label: 'Aktif' }, { value: 'inactive', label: 'Nonaktif' }]} />
	<Button type="submit" variant="secondary">Terapkan</Button>
</form>

{#if data.rows.length === 0}
	<EmptyState title="Tidak ada dosen" description="Belum ada akun dosen yang cocok dengan filter." actionLabel="Hapus filter" actionHref="/app/admin/lecturers" />
{:else}
	<div class="overflow-x-auto rounded-lg border bg-card">
		<Table>
			<TableHeader>
				<TableRow><TableHead>Nama</TableHead><TableHead>Email</TableHead><TableHead>Kode</TableHead><TableHead class="text-right">Kelas</TableHead><TableHead>Status</TableHead><TableHead class="text-right">Aksi</TableHead></TableRow>
			</TableHeader>
			<TableBody>
				{#each data.rows as lecturer (lecturer.id)}
					<TableRow>
						<TableCell class="font-medium">{lecturer.name}</TableCell>
						<TableCell>{lecturer.email}</TableCell>
						<TableCell class="font-mono text-sm">{lecturer.lecturerCode ?? '—'}</TableCell>
						<TableCell class="text-right tabular-nums">{lecturer.assignmentCount}</TableCell>
						<TableCell>
							<div class="flex flex-wrap gap-1">
								<StatusBadge status={lecturer.banned ? 'neutral' : 'success'} label={lecturer.banned ? 'Nonaktif' : 'Aktif'} />
								{#if lecturer.mustChangePassword}<StatusBadge status="warning" label="Wajib ganti password" />{/if}
							</div>
						</TableCell>
						<TableCell class="text-right">
							<div class="flex flex-wrap justify-end gap-2">
								<Button variant="outline" size="sm" href={`?ubah=${lecturer.id}`}>Ubah</Button>
								<ConfirmForm action="?/resetPassword" fields={{ id: lecturer.id, email: lecturer.email }} triggerLabel="Reset password" title="Terbitkan password sementara baru?" description="Password lama tidak berlaku lagi dan seluruh sesi dosen dicabut. Password baru hanya ditampilkan sekali." confirmLabel="Terbitkan" />
								{#if lecturer.banned}
									<ConfirmForm action="?/reactivate" fields={{ id: lecturer.id }} triggerLabel="Aktifkan" title="Aktifkan kembali akun ini?" description="Dosen dapat masuk lagi dengan password yang berlaku." confirmLabel="Aktifkan" />
								{:else}
									<ConfirmForm action="?/deactivate" fields={{ id: lecturer.id }} triggerLabel="Nonaktifkan" tone="destructive" title="Nonaktifkan akun dosen?" description="Dosen tidak dapat masuk dan seluruh sesi yang sedang berjalan dicabut. Data nilai tetap tersimpan." confirmLabel="Nonaktifkan" />
								{/if}
							</div>
						</TableCell>
					</TableRow>
				{/each}
			</TableBody>
		</Table>
	</div>
	<Pager page={data.page} pageCount={data.pageCount} total={data.total} {href} />
{/if}
