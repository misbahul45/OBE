<script lang="ts">
	import { enhance } from '$app/forms';
	import { LoaderCircle } from '@lucide/svelte';
	import { Alert, AlertDescription } from '#lib/components/ui/alert/index.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Label } from '#lib/components/ui/label/index.ts';
	import PasswordField from './PasswordField.svelte';

	type LoginFormState = { message?: string; fieldErrors?: Record<string, string[]>; email?: string } | null | undefined;

	let { form, next }: { form: LoginFormState; next: string | null } = $props();

	let pending = $state(false);
	const emailErrors = $derived(form?.fieldErrors?.email ?? []);
	const passwordErrors = $derived(form?.fieldErrors?.password ?? []);
</script>

<form
	method="POST"
	class="space-y-5"
	novalidate
	use:enhance={() => {
		pending = true;
		return async ({ update }) => {
			await update({ reset: false });
			pending = false;
		};
	}}
>
	{#if next}<input type="hidden" name="next" value={next} />{/if}

	{#if form?.message}
		<Alert variant="destructive" role="alert">
			<AlertDescription>{form.message}</AlertDescription>
		</Alert>
	{/if}

	<div class="space-y-2">
		<Label for="email">Email</Label>
		<Input
			id="email"
			name="email"
			type="email"
			autocomplete="username"
			placeholder="nama@kampus.ac.id"
			required
			value={form?.email ?? ''}
			aria-invalid={emailErrors.length > 0}
			aria-describedby={emailErrors.length ? 'email-error' : undefined}
		/>
		{#if emailErrors.length}<p id="email-error" class="text-sm text-destructive" role="alert">{emailErrors[0]}</p>{/if}
	</div>

	<PasswordField id="password" name="password" label="Password" autocomplete="current-password" errors={passwordErrors} />

	<Button type="submit" class="w-full" disabled={pending}>
		{#if pending}
			<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
			Memproses…
		{:else}
			Masuk
		{/if}
	</Button>
</form>
