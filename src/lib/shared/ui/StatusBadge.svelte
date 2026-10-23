<script lang="ts">
	import { CircleAlert, CircleCheck, CircleDashed, CircleX, Info } from '@lucide/svelte';

	type Status = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

	let { status, label, class: className = '' }: { status: Status; label: string; class?: string } = $props();

	const styles: Record<Status, string> = {
		success: 'bg-status-success-soft text-status-success',
		warning: 'bg-status-warning-soft text-status-warning',
		danger: 'bg-status-danger-soft text-status-danger',
		info: 'bg-status-info-soft text-status-info',
		neutral: 'bg-status-neutral-soft text-status-neutral'
	};
</script>

<span class="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium {styles[status]} {className}" data-status={status}>
	{#if status === 'success'}
		<CircleCheck class="size-3.5" aria-hidden="true" />
	{:else if status === 'warning'}
		<CircleAlert class="size-3.5" aria-hidden="true" />
	{:else if status === 'danger'}
		<CircleX class="size-3.5" aria-hidden="true" />
	{:else if status === 'info'}
		<Info class="size-3.5" aria-hidden="true" />
	{:else}
		<CircleDashed class="size-3.5" aria-hidden="true" />
	{/if}
	{label}
</span>
