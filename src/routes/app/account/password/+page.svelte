<script lang="ts">
	import { Alert, AlertDescription, AlertTitle } from '#lib/components/ui/alert/index.ts';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#lib/components/ui/card/index.ts';
	import ChangePasswordForm from '#lib/features/auth/components/ChangePasswordForm.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Ganti password · OBE Teknik Biomedis</title>
</svelte:head>

<div class="mx-auto w-full max-w-xl space-y-6">
	<h1 class="text-2xl font-semibold tracking-tight">Ganti password</h1>
	{#if data.mustChange}
		<Alert>
			<AlertTitle>Password sementara</AlertTitle>
			<AlertDescription>Anda harus mengganti password sementara sebelum memakai fitur akademik.</AlertDescription>
		</Alert>
	{/if}
	<Card>
		<CardHeader>
			<CardTitle>Password baru</CardTitle>
			<CardDescription>Setelah disimpan, sesi di perangkat lain akan dikeluarkan.</CardDescription>
		</CardHeader>
		<CardContent>
			<ChangePasswordForm {form} />
		</CardContent>
	</Card>
</div>
