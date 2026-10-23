<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		AlertDialog,
		AlertDialogAction,
		AlertDialogCancel,
		AlertDialogContent,
		AlertDialogDescription,
		AlertDialogFooter,
		AlertDialogHeader,
		AlertDialogTitle,
		AlertDialogTrigger
	} from '#lib/components/ui/alert-dialog/index.ts';
	import { buttonVariants } from '#lib/components/ui/button/index.ts';

	let {
		action,
		fields = {},
		triggerLabel,
		title,
		description,
		confirmLabel = 'Ya, lanjutkan',
		tone = 'default'
	}: { action: string; fields?: Record<string, string>; triggerLabel: string; title: string; description: string; confirmLabel?: string; tone?: 'default' | 'destructive' } = $props();

	const uid = $props.id();
	const formId = $derived(`confirm-${uid}`);
</script>

<form id={formId} method="POST" {action} use:enhance>
	{#each Object.entries(fields) as [name, value] (name)}<input type="hidden" {name} {value} />{/each}
</form>

<AlertDialog>
	<AlertDialogTrigger class={buttonVariants({ variant: tone === 'destructive' ? 'destructive' : 'outline', size: 'sm' })}>{triggerLabel}</AlertDialogTrigger>
	<AlertDialogContent>
		<AlertDialogHeader>
			<AlertDialogTitle>{title}</AlertDialogTitle>
			<AlertDialogDescription>{description}</AlertDialogDescription>
		</AlertDialogHeader>
		<AlertDialogFooter>
			<AlertDialogCancel>Batal</AlertDialogCancel>
			<AlertDialogAction type="submit" form={formId} class={tone === 'destructive' ? buttonVariants({ variant: 'destructive-solid' }) : undefined}>{confirmLabel}</AlertDialogAction>
		</AlertDialogFooter>
	</AlertDialogContent>
</AlertDialog>
