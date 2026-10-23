<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Button } from '#lib/components/ui/button/index.ts';

	let {
		title,
		description,
		actionLabel,
		actionHref,
		action
	}: { title: string; description?: string; actionLabel?: string; actionHref?: string; action?: Snippet } = $props();
</script>

<div class="rounded-lg border border-dashed bg-card px-6 py-10 text-center" role="status">
	<p class="font-medium">{title}</p>
	{#if description}<p class="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>{/if}
	{#if actionLabel && actionHref}
		<div class="mt-4 flex justify-center"><Button href={actionHref} variant="outline" size="sm">{actionLabel}</Button></div>
	{:else if action}
		<div class="mt-4 flex justify-center">{@render action()}</div>
	{/if}
</div>
