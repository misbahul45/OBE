<script lang="ts">
	import { CircleAlert, CircleCheck } from '@lucide/svelte';
	import { Alert, AlertDescription } from '#lib/components/ui/alert/index.ts';

	let { message, success }: { message?: string | null; success?: string | null } = $props();
</script>

{#if success}
	<Alert role="status">
		<CircleCheck class="size-4" aria-hidden="true" />
		<AlertDescription>{success}</AlertDescription>
	</Alert>
{:else if message}
	<Alert variant="destructive" role="alert">
		<CircleAlert class="size-4" aria-hidden="true" />
		<AlertDescription>{message}</AlertDescription>
	</Alert>
{/if}
