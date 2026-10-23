<script lang="ts">
	import { Eye, EyeOff } from '@lucide/svelte';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Label } from '#lib/components/ui/label/index.ts';

	let {
		id,
		name,
		label,
		autocomplete,
		errors = [],
		hint
	}: { id: string; name: string; label: string; autocomplete: 'current-password' | 'new-password'; errors?: string[]; hint?: string } = $props();

	let visible = $state(false);
	let value = $state('');
	const describedBy = $derived([errors.length ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined);
</script>

<div class="space-y-2">
	<Label for={id}>{label}</Label>
	<div class="relative">
		<Input {id} {name} type={visible ? 'text' : 'password'} {autocomplete} required aria-invalid={errors.length > 0} aria-describedby={describedBy} bind:value class="pr-11" />
		<Button
			type="button"
			variant="ghost"
			size="icon"
			class="absolute right-1 top-1/2 size-8 -translate-y-1/2"
			aria-label={visible ? 'Sembunyikan password' : 'Tampilkan password'}
			aria-pressed={visible}
			onclick={() => (visible = !visible)}
		>
			{#if visible}
				<EyeOff class="size-4" aria-hidden="true" />
			{:else}
				<Eye class="size-4" aria-hidden="true" />
			{/if}
		</Button>
	</div>
	{#if hint}<p id="{id}-hint" class="text-sm text-muted-foreground">{hint}</p>{/if}
	{#if errors.length}
		<ul id="{id}-error" class="space-y-0.5 text-sm text-destructive" role="alert">
			{#each errors as message (message)}<li>{message}</li>{/each}
		</ul>
	{/if}
</div>
