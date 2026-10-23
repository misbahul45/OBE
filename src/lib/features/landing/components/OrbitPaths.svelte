<script lang="ts">
	import { hubRadius, orbitCenter, orbitRadius, orbitView, type OrbitLayout, type OrbitNodeId } from '../landing.orbit.ts';

	let { orbit, active }: { orbit: OrbitLayout; active: OrbitNodeId | null } = $props();

	const stateOf = (from: OrbitNodeId, to: OrbitNodeId) => (active === from ? 'outgoing' : active === to ? 'incoming' : 'idle');
</script>

<svg viewBox="0 0 {orbitView} {orbitView}" class="absolute inset-0 size-full" aria-hidden="true" focusable="false" data-orbit-paths>
	<defs>
		<path id="orbit-path" d={orbit.fullCircle} />
	</defs>
	<circle cx={orbitCenter} cy={orbitCenter} r={orbitRadius} fill="none" stroke="var(--border)" stroke-width="1.5" />
	<circle cx={orbitCenter} cy={orbitCenter} r={hubRadius + 16} fill="none" stroke="var(--primary-muted)" stroke-width="1.5" stroke-dasharray="2 8" stroke-linecap="round" />

	{#each orbit.arcs as arc (arc.index)}
		<g class="orbit-arc" class:is-feedback={arc.feedback} data-state={stateOf(arc.from, arc.to)} data-from={arc.from} data-to={arc.to} style="--i: {arc.index}">
			<path class="arc-track" d={arc.path} />
			<path class="arc-dots" d={arc.path} />
			<path class="arc-arrow" d="M -7 -7 L 5 0 L -7 7" transform="translate({arc.arrow.x} {arc.arrow.y}) rotate({arc.arrow.rotate})" />
		</g>
	{/each}

	<g class="tracer">
		<circle class="tracer-halo" r="11" />
		<circle class="tracer-dot" r="4.5" />
		<animateMotion dur="18s" repeatCount="indefinite" rotate="auto">
			<mpath href="#orbit-path" />
		</animateMotion>
	</g>
</svg>

<style>
	.orbit-arc {
		opacity: 0.6;
		animation: arc-glow 18s linear infinite;
		animation-delay: calc(var(--i) * 4.5s);
		transition: opacity 0.25s ease;
	}
	.arc-track {
		fill: none;
		stroke: var(--muted-foreground);
		stroke-opacity: 0.45;
		stroke-width: 2;
		stroke-linecap: round;
		transition:
			stroke 0.25s ease,
			stroke-opacity 0.25s ease,
			stroke-width 0.25s ease;
	}
	.arc-dots {
		fill: none;
		stroke: var(--primary-light);
		stroke-width: 4;
		stroke-linecap: round;
		stroke-dasharray: 0.1 12;
		transition: stroke 0.25s ease;
	}
	.arc-arrow {
		fill: none;
		stroke: var(--primary-light);
		stroke-width: 3;
		stroke-linecap: round;
		stroke-linejoin: round;
		transition:
			stroke 0.25s ease,
			stroke-width 0.25s ease;
	}
	.is-feedback .arc-track {
		stroke: var(--chart-5);
		stroke-opacity: 0.85;
		stroke-dasharray: 8 7;
	}
	.is-feedback .arc-dots {
		display: none;
	}
	.is-feedback .arc-arrow {
		stroke: var(--chart-5);
	}
	.orbit-arc[data-state='outgoing'],
	.orbit-arc[data-state='incoming'] {
		animation: none;
		opacity: 1;
	}
	.orbit-arc[data-state='outgoing'] .arc-track {
		stroke: var(--primary);
		stroke-opacity: 1;
		stroke-width: 4;
	}
	.orbit-arc[data-state='outgoing'] .arc-dots,
	.orbit-arc[data-state='outgoing'] .arc-arrow {
		stroke: var(--primary);
	}
	.orbit-arc[data-state='outgoing'] .arc-arrow {
		stroke-width: 3.5;
	}
	.orbit-arc[data-state='incoming'] .arc-track {
		stroke: var(--primary-light);
		stroke-opacity: 0.85;
		stroke-width: 3;
	}
	.is-feedback[data-state='outgoing'] .arc-track,
	.is-feedback[data-state='incoming'] .arc-track {
		stroke: var(--chart-5);
		stroke-opacity: 1;
	}
	.is-feedback[data-state='outgoing'] .arc-arrow {
		stroke: var(--chart-5);
	}
	.tracer-halo {
		fill: var(--chart-5);
		opacity: 0.22;
	}
	.tracer-dot {
		fill: var(--chart-5);
	}
	@keyframes arc-glow {
		0% {
			opacity: 0.6;
		}
		6% {
			opacity: 1;
		}
		22% {
			opacity: 1;
		}
		30% {
			opacity: 0.6;
		}
		100% {
			opacity: 0.6;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.orbit-arc {
			animation: none;
			opacity: 0.85;
			transition: none;
		}
		.tracer {
			display: none;
		}
	}
</style>
