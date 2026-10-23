<script lang="ts">
	import { landingCopy } from '../landing.copy.ts';
	import { buildOrbit, type OrbitNodeId } from '../landing.orbit.ts';
	import OrbitPaths from './OrbitPaths.svelte';

	const orbit = buildOrbit();
	const loop = landingCopy.loop;
	const detailOf = (id: OrbitNodeId) => loop.nodes.find((node) => node.id === id)!;
	const nextOf = (index: number) => detailOf(orbit.nodes[(index + 1) % orbit.nodes.length].id);

	let selected = $state<OrbitNodeId | null>(null);
	let hovered = $state<OrbitNodeId | null>(null);
	let focused = $state<OrbitNodeId | null>(null);
	let buttons: Partial<Record<OrbitNodeId, HTMLButtonElement>> = {};

	const active = $derived(hovered ?? focused ?? selected);
	const current = $derived(selected ? detailOf(selected) : null);
	const currentStep = $derived(selected ? orbit.nodes.findIndex((node) => node.id === selected) + 1 : 0);

	const choose = (id: OrbitNodeId) => {
		selected = selected === id ? null : id;
	};

	function handleKey(event: KeyboardEvent, index: number) {
		if (event.key === 'Escape') {
			selected = null;
			return;
		}
		const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
		if (!step) return;
		event.preventDefault();
		buttons[orbit.nodes[(index + step + orbit.nodes.length) % orbit.nodes.length].id]?.focus();
	}
</script>

<div class="grid items-center gap-8 lg:grid-cols-[minmax(0,34rem)_minmax(0,1fr)] lg:gap-14" role="group" aria-labelledby="orbit-title" aria-describedby="orbit-desc" data-orbit-loop>
	<p id="orbit-title" class="sr-only">{landingCopy.visualTitle}</p>
	<p id="orbit-desc" class="sr-only">{landingCopy.visualDescription}</p>

	<div class="@container relative mx-auto aspect-square w-full max-w-[34rem] select-none" data-orbit-stage>
		<OrbitPaths {orbit} {active} />

		<div
			class="absolute left-1/2 top-1/2 grid aspect-square -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-primary/40 bg-[radial-gradient(circle_at_50%_35%,var(--primary-muted),var(--primary-soft))] text-center shadow-[inset_0_0_0_7px_var(--background),inset_0_0_0_8px_var(--border)]"
			style="width: {orbit.hubSizePercent}%"
			data-orbit-hub
		>
			<span class="flex max-w-[78%] flex-col items-center gap-0.5">
				<span class="text-[clamp(20px,6.4cqw,40px)] font-semibold leading-none tracking-tight text-foreground">{loop.hub.label}</span>
				<span class="hidden text-[clamp(9px,2cqw,13px)] font-medium leading-tight text-foreground @min-[24rem]:block">{loop.hub.name}</span>
				<span class="hidden text-[clamp(8px,1.7cqw,11px)] leading-tight text-muted-foreground @min-[32rem]:block">{loop.hub.caption}</span>
			</span>
		</div>

		<span
			class="pointer-events-none absolute hidden -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-background/85 px-2 py-0.5 text-[clamp(9px,1.9cqw,12px)] font-medium text-chart-5 @min-[24rem]:block"
			style="left: {orbit.feedbackLabel.leftPercent}%; top: {orbit.feedbackLabel.topPercent}%"
			data-orbit-feedback
		>
			{loop.feedback}
		</span>

		{#each orbit.nodes as node, index (node.id)}
			{@const detail = detailOf(node.id)}
			<button
				bind:this={buttons[node.id]}
				type="button"
				class="absolute grid aspect-square -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-primary-light bg-card text-foreground outline-none transition-[scale,border-color,background-color,box-shadow] duration-200 hover:scale-[1.04] hover:border-primary focus-visible:ring-4 focus-visible:ring-ring/60 data-[selected=true]:scale-105 data-[selected=true]:border-chart-5 data-[selected=true]:bg-primary-soft data-[selected=true]:ring-4 data-[selected=true]:ring-chart-5/30 motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:data-[selected=true]:scale-100"
				style="left: {node.leftPercent}%; top: {node.topPercent}%; width: {node.sizePercent}%"
				aria-label="{detail.label}, tahap {index + 1} dari {orbit.nodes.length}, mengalir ke {nextOf(index).label}"
				aria-pressed={selected === node.id}
				aria-controls="orbit-panel"
				data-selected={selected === node.id}
				data-node={node.id}
				onclick={() => choose(node.id)}
				onpointerenter={() => (hovered = node.id)}
				onpointerleave={() => (hovered = null)}
				onfocus={() => (focused = node.id)}
				onblur={() => (focused = null)}
				onkeydown={(event) => handleKey(event, index)}
			>
				<span class="max-w-[74%] text-balance text-center text-[clamp(11px,3.9cqw,26px)] font-semibold leading-[1.08] tracking-tight">{detail.label}</span>
				<span aria-hidden="true" class="absolute -right-[2%] -top-[2%] grid w-[26%] aspect-square place-items-center rounded-full border border-primary-light bg-background text-[clamp(9px,2.3cqw,15px)] font-semibold leading-none text-primary">{index + 1}</span>
			</button>
		{/each}
	</div>

	<div class="min-w-0">
		<div id="orbit-panel" aria-live="polite" class="min-h-64 rounded-2xl border bg-background/85 p-6 backdrop-blur-md lg:min-h-72 lg:p-8" data-orbit-panel>
			{#key current?.id ?? 'overview'}
				<div class="panel-in">
					{#if current}
						<p class="text-4xl font-semibold tracking-tight text-foreground" data-orbit-panel-title>{current.label}</p>
						<p class="mt-1 text-sm text-muted-foreground">{current.fullName}</p>
						<p class="mt-5 text-pretty leading-relaxed text-foreground/90">{current.body}</p>
						<p class="mt-5 text-sm font-medium text-primary">Tahap {currentStep} dari {orbit.nodes.length}. {current.flow}</p>
					{:else}
						<p class="text-2xl font-semibold tracking-tight text-foreground" data-orbit-panel-title>{loop.overview.title}</p>
						<p class="mt-1 text-sm text-muted-foreground">{loop.hub.name}: {loop.hub.caption}</p>
						<p class="mt-5 text-pretty leading-relaxed text-foreground/90">{loop.overview.body}</p>
					{/if}
				</div>
			{/key}
		</div>
		<p class="mt-3 text-pretty text-xs leading-relaxed text-muted-foreground">{loop.overview.hint}</p>
	</div>
</div>

<style>
	.panel-in {
		animation: panel-in 0.2s ease-out;
	}
	@keyframes panel-in {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.panel-in {
			animation: none;
		}
	}
</style>
