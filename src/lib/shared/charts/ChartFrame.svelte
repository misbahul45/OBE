<script lang="ts">
	import type { Snippet } from 'svelte';
	import { focusableWhenScrollable } from '../ui/focusable-scroll.ts';

	let {
		title,
		description,
		summary,
		chart,
		table
	}: { title: string; description?: string; summary: string; chart: Snippet<[{ titleId: string; descId: string }]>; table: Snippet } = $props();

	const uid = $props.id();
	const titleId = `chart-title-${uid}`;
	const descId = `chart-desc-${uid}`;
</script>

<figure class="min-w-0 rounded-lg border bg-card p-4" aria-labelledby={titleId}>
	<figcaption>
		<h3 id={titleId} class="text-base font-semibold">{title}</h3>
		{#if description}<p class="mt-0.5 text-sm text-muted-foreground">{description}</p>{/if}
	</figcaption>
	<div class="mt-3 overflow-x-auto" use:focusableWhenScrollable>{@render chart({ titleId, descId })}</div>
	<p id={descId} class="sr-only">{summary}</p>
	<details class="mt-3 text-sm">
		<summary class="cursor-pointer text-muted-foreground">Lihat data sebagai tabel</summary>
		<div class="mt-2 overflow-x-auto">{@render table()}</div>
	</details>
</figure>
