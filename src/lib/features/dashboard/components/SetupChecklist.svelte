<script lang="ts">
	import { ArrowRight, Check } from '@lucide/svelte';
	import { Button } from '#lib/components/ui/button/index.ts';
	import type { SetupStep } from '../dashboard.setup.ts';

	let { steps }: { steps: SetupStep[] } = $props();

	const next = $derived(steps.find((step) => !step.done) ?? null);
	const doneCount = $derived(steps.filter((step) => step.done).length);
</script>

{#if next}
	<section aria-labelledby="setup-heading" class="mb-8 rounded-lg border bg-card p-4">
		<div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
			<h2 id="setup-heading" class="text-base font-semibold">Mulai dari sini</h2>
			<p class="text-sm text-muted-foreground">{doneCount} dari {steps.length} langkah persiapan selesai. Kerjakan berurutan; langkah berikutnya ditandai.</p>
		</div>
		<ol class="space-y-2">
			{#each steps as step, index (step.key)}
				<li class="flex flex-wrap items-start gap-x-3 gap-y-2 rounded-md px-2 py-1.5 {step === next ? 'bg-primary-soft' : ''}" aria-current={step === next ? 'step' : undefined}>
					<span class="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border text-xs {step.done ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground'}" aria-hidden="true">
						{#if step.done}<Check class="size-3" />{:else}{index + 1}{/if}
					</span>
					<div class="min-w-0 flex-1 basis-48">
						<p class="text-sm font-medium">{step.title}<span class="sr-only">{step.done ? ' (selesai)' : ' (belum selesai)'}</span></p>
						<p class="text-xs {step === next ? 'text-secondary-foreground' : 'text-muted-foreground'}">{step.detail}</p>
					</div>
					{#if step === next}
						<Button href={step.href} size="sm" class="ml-8 shrink-0 gap-1.5 sm:ml-0">{step.actionLabel}<ArrowRight class="size-3.5" aria-hidden="true" /></Button>
					{/if}
				</li>
			{/each}
		</ol>
	</section>
{/if}
