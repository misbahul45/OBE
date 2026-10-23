<script lang="ts">
	import { enhance } from '$app/forms';
	import { LoaderCircle } from '@lucide/svelte';
	import { Alert, AlertDescription } from '#lib/components/ui/alert/index.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import PasswordField from './PasswordField.svelte';

	type ChangeFormState = { message?: string; fieldErrors?: Record<string, string[]> } | null | undefined;

	let { form }: { form: ChangeFormState } = $props();

	let pending = $state(false);
	const errors = (field: string) => form?.fieldErrors?.[field] ?? [];
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
	{#if form?.message}
		<Alert variant="destructive" role="alert">
			<AlertDescription>{form.message}</AlertDescription>
		</Alert>
	{/if}

	<PasswordField id="currentPassword" name="currentPassword" label="Password saat ini" autocomplete="current-password" errors={errors('currentPassword')} />
	<PasswordField
		id="newPassword"
		name="newPassword"
		label="Password baru"
		autocomplete="new-password"
		errors={errors('newPassword')}
		hint="Minimal 10 karakter dengan huruf besar, huruf kecil, angka, dan simbol."
	/>
	<PasswordField id="confirmPassword" name="confirmPassword" label="Ulangi password baru" autocomplete="new-password" errors={errors('confirmPassword')} />

	<Button type="submit" disabled={pending}>
		{#if pending}
			<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
			Menyimpan…
		{:else}
			Simpan password baru
		{/if}
	</Button>
</form>
