<script lang="ts">
	import { onMount } from 'svelte';
	import { theme } from '#lib/shared/theme/theme.svelte.ts';
	import './layout.css';

	const { children } = $props();

	onMount(() => theme.init());
</script>

{@render children()}
