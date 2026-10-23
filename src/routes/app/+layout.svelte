<script lang="ts">
	import AppShell from '#lib/features/dashboard/components/AppShell.svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();
</script>

<AppShell user={data.user}>
	{@render children()}
</AppShell>
