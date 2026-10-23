<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { KeyRound, LoaderCircle, LogOut } from '@lucide/svelte';
	import { Alert, AlertDescription, AlertTitle } from '#lib/components/ui/alert/index.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#lib/components/ui/card/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import Field from '#lib/shared/ui/Field.svelte';
	import FormMessage from '#lib/shared/ui/FormMessage.svelte';
	import PageHeader from '#lib/shared/ui/PageHeader.svelte';
	import ThemeSelector from '#lib/shared/ui/ThemeSelector.svelte';
	import { roleLabels } from '../auth.roles.ts';
	import type { OwnProfile } from '../auth.types.ts';

	type ProfileFormState = { success?: string; message?: string; fieldErrors?: Record<string, string[]>; name?: string } | null | undefined;

	let { profile, form }: { profile: OwnProfile; form: ProfileFormState } = $props();

	let pending = $state(false);
	let name = $state(untrack(() => form?.name ?? profile.name));
	$effect(() => {
		name = form?.name ?? profile.name;
	});

	const joined = $derived(new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date(profile.createdAt)));
	const errors = $derived(form?.fieldErrors?.name ?? []);
</script>

<PageHeader title="Profil akun" description="Identitas, tampilan, dan keamanan akun Anda.">
	{#snippet actions()}
		<form method="POST" action="/app/logout">
			<Button type="submit" variant="outline" class="gap-1.5"><LogOut class="size-4" aria-hidden="true" />Keluar</Button>
		</form>
	{/snippet}
</PageHeader>

<div class="mx-auto max-w-3xl space-y-6">
	{#if profile.mustChangePassword}
		<Alert role="status">
			<AlertTitle>Password sementara</AlertTitle>
			<AlertDescription>Ganti password sementara Anda sebelum memakai fitur akademik.</AlertDescription>
		</Alert>
	{/if}

	<Card>
		<CardHeader>
			<CardTitle>Identitas</CardTitle>
			<CardDescription>Nama tampil di jejak audit dan daftar pengampu. Email dan peran hanya dapat diubah oleh Super Admin.</CardDescription>
		</CardHeader>
		<CardContent class="space-y-6">
			<form
				method="POST"
				action="?/name"
				class="space-y-4"
				novalidate
				use:enhance={() => {
					pending = true;
					return async ({ update }) => {
						await update({ reset: false });
						pending = false;
					};
				}}
			>
				<FormMessage message={form?.message} success={form?.success} />
				<Field id="profile-name" label="Nama tampilan" {errors}>
					{#snippet children({ describedBy, invalid })}
						<Input id="profile-name" name="name" autocomplete="name" required maxlength={100} bind:value={name} aria-invalid={invalid} aria-describedby={describedBy} />
					{/snippet}
				</Field>
				<Button type="submit" disabled={pending} class="gap-1.5">
					{#if pending}<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />{/if}
					Simpan nama
				</Button>
			</form>

			<dl class="grid gap-4 border-t pt-6 text-sm sm:grid-cols-2">
				<div>
					<dt class="text-muted-foreground">Email</dt>
					<dd class="mt-0.5 break-all font-medium" data-profile="email">{profile.email}</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">Peran</dt>
					<dd class="mt-0.5 font-medium" data-profile="role">{roleLabels[profile.role]}</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">Akun dibuat</dt>
					<dd class="mt-0.5 font-medium">{joined}</dd>
				</div>
				{#if profile.lecturer}
					<div>
						<dt class="text-muted-foreground">Kelas aktif semester ini</dt>
						<dd class="mt-0.5 font-medium"><a href="/app/lecturer/courses" class="text-primary hover:underline">{profile.lecturer.activeClasses} kelas</a></dd>
					</div>
					<div>
						<dt class="text-muted-foreground">Kode dosen</dt>
						<dd class="mt-0.5 font-medium">{profile.lecturer.lecturerCode ?? 'Belum diisi'}</dd>
					</div>
					<div>
						<dt class="text-muted-foreground">NIDN</dt>
						<dd class="mt-0.5 font-medium">{profile.lecturer.nidn ?? 'Belum diisi'}</dd>
					</div>
				{/if}
			</dl>
		</CardContent>
	</Card>

	<Card>
		<CardHeader>
			<CardTitle>Tampilan</CardTitle>
			<CardDescription>Pilihan tersimpan di peramban ini. "Ikuti sistem" mengikuti pengaturan terang atau gelap perangkat Anda.</CardDescription>
		</CardHeader>
		<CardContent>
			<ThemeSelector />
		</CardContent>
	</Card>

	<Card>
		<CardHeader>
			<CardTitle>Keamanan</CardTitle>
			<CardDescription>{profile.activeSessions} sesi aktif. Mengganti password mengeluarkan sesi di perangkat lain.</CardDescription>
		</CardHeader>
		<CardContent>
			<Button href="/app/account/password" variant="outline" class="gap-1.5"><KeyRound class="size-4" aria-hidden="true" />Ganti password</Button>
		</CardContent>
	</Card>
</div>
