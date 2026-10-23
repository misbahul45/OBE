<script lang="ts">
	import { Moon, Sun } from '@lucide/svelte';
	import { Button, type ButtonVariant } from '#lib/components/ui/button/index.ts';
	import { cn } from '#lib/utils.js';
	import { theme } from '#lib/shared/theme/theme.svelte.ts';

	let { variant = 'ghost', class: className }: { variant?: ButtonVariant; class?: string } = $props();

	const label = $derived(theme.resolved === 'dark' ? 'Ganti ke tema terang' : 'Ganti ke tema gelap');
</script>

<Button type="button" {variant} size="icon" class={cn('rounded-full', className)} aria-label={label} title={label} data-theme-toggle onclick={() => theme.toggle()}>
	<Sun class="hidden size-4 dark:block" aria-hidden="true" />
	<Moon class="size-4 dark:hidden" aria-hidden="true" />
</Button>
