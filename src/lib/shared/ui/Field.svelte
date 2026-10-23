<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Label } from '#lib/components/ui/label/index.ts';

	let {
		id,
		label,
		errors = [],
		hint,
		children
	}: { id: string; label: string; errors?: string[]; hint?: string; children: Snippet<[{ describedBy: string | undefined; invalid: boolean }]> } = $props();

	const describedBy = $derived([hint ? `${id}-hint` : null, errors.length ? `${id}-error` : null].filter(Boolean).join(' ') || undefined);
</script>

<div class="space-y-1.5">
	<Label for={id}>{label}</Label>
	{@render children({ describedBy, invalid: errors.length > 0 })}
	{#if hint}<p id="{id}-hint" class="text-xs text-muted-foreground">{hint}</p>{/if}
	{#if errors.length}
		<ul id="{id}-error" class="space-y-0.5 text-sm text-destructive" role="alert">
			{#each errors as message (message)}<li>{message}</li>{/each}
		</ul>
	{/if}
</div>
