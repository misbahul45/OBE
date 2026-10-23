<script lang="ts">
	import LoginForm from '#lib/features/auth/components/LoginForm.svelte';
	import ThemeToggle from '#lib/shared/ui/ThemeToggle.svelte';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#lib/components/ui/card/index.ts';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Masuk · OBE Teknik Biomedis</title>
</svelte:head>

<main class="relative grid min-h-svh place-items-center px-4 py-10">
	<div class="absolute right-4 top-4">
		<ThemeToggle variant="outline" />
	</div>
	<div class="w-full max-w-md space-y-6">
		<a href="/" class="block text-center text-sm font-semibold tracking-tight text-foreground">OBE Teknik Biomedis</a>
		<Card>
			<CardHeader>
				<CardTitle>
					<h1 class="text-2xl font-semibold tracking-tight">Masuk</h1>
				</CardTitle>
				<CardDescription>Gunakan email dan password akun yang diberikan Super Admin.</CardDescription>
			</CardHeader>
			<CardContent>
				<LoginForm {form} next={data.next} />
			</CardContent>
		</Card>
	</div>
</main>
