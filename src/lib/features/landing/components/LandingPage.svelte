<script lang="ts">
	import { onMount } from 'svelte';
	import { gsap } from 'gsap';
	import { ScrollTrigger } from 'gsap/ScrollTrigger';
	import { ArrowRight, Briefcase, ClipboardCheck, FileText, FileUp, GraduationCap, Target } from '@lucide/svelte';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.ts';
	import { cn } from '#lib/utils.js';
	import ThemeToggle from '#lib/shared/ui/ThemeToggle.svelte';
	import { landingCopy } from '../landing.copy.ts';
	import DotField from './DotField.svelte';
	import OutcomeOrbitVisual from './OutcomeOrbitVisual.svelte';

	let root = $state<HTMLDivElement | null>(null);

	const moduleIcons = { target: Target, upload: FileUp, graduation: GraduationCap, report: FileText, profile: Briefcase, quality: ClipboardCheck } as const;

	onMount(() => {
		if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		gsap.registerPlugin(ScrollTrigger);
		const context = gsap.context(() => {
			gsap.from('[data-hero]', { autoAlpha: 0, y: 28, duration: 1, ease: 'power3.out', stagger: 0.12, delay: 0.1 });
			for (const element of gsap.utils.toArray<HTMLElement>('[data-reveal]')) {
				gsap.from(element, { autoAlpha: 0, y: 40, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: element, start: 'top 86%', once: true } });
			}
		}, root);
		return () => context.revert();
	});
</script>

<div bind:this={root} class="relative min-h-svh overflow-x-clip bg-background">
	<DotField />

	<div class="relative z-10">
		<header class="sticky top-0 z-30 border-b border-transparent bg-background/70 backdrop-blur-md">
			<div class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3 lg:px-10">
				<a href="/" class="flex items-center gap-3 text-foreground">
					<img src={landingCopy.logoSrc} alt={landingCopy.logoAlt} width="224" height="224" class="size-11 shrink-0" />
					<span class="flex flex-col leading-tight">
						<span class="text-[15px] font-semibold tracking-tight">{landingCopy.university}</span>
						<span class="text-xs text-muted-foreground">{landingCopy.brand}</span>
					</span>
				</a>
				<div class="flex items-center gap-2">
					<ThemeToggle />
					<a href={landingCopy.loginHref} class={cn(buttonVariants({ variant: 'outline' }), 'h-9 rounded-full px-4 text-sm')}>Masuk</a>
				</div>
			</div>
		</header>

		<main>
			<section data-dot-stage="0" class="relative mx-auto flex min-h-[calc(100svh-4.5rem)] max-w-5xl flex-col items-center justify-center px-6 pb-16 pt-10 text-center before:pointer-events-none before:absolute before:inset-x-[8%] before:inset-y-[12%] before:-z-10 before:bg-[radial-gradient(closest-side,var(--background)_45%,transparent)] before:content-['']">
				<h1 data-hero class="text-balance text-4xl font-medium leading-[1.06] tracking-[-0.03em] text-foreground sm:text-6xl md:text-7xl">{landingCopy.title}</h1>
				<h2 data-hero class="mt-6 max-w-2xl text-pretty text-xl font-normal leading-snug text-muted-foreground md:mt-8 md:text-2xl">{landingCopy.subtitle}</h2>
				<div data-hero class="mt-10 md:mt-12">
					<Button href={landingCopy.loginHref} size="lg" class="h-12 gap-2 rounded-full px-7 text-base">
						{landingCopy.cta}
						<ArrowRight aria-hidden="true" class="size-4" />
					</Button>
				</div>
			</section>

			<section aria-labelledby="chain-title" class="mx-auto max-w-6xl px-4 pb-10 sm:px-6 lg:px-10">
				<div data-reveal class="mx-auto max-w-3xl pb-10 text-center">
					<p id="chain-title" class="text-balance text-3xl font-medium leading-tight tracking-[-0.02em] text-foreground md:text-4xl">{landingCopy.chainTitle}</p>
					<p class="mt-4 text-pretty text-lg text-muted-foreground">{landingCopy.chainIntro}</p>
				</div>
				{#each landingCopy.steps as step, index (step.title)}
					<div data-dot-stage={index} class={cn('flex min-h-[62svh] items-center py-6', index % 2 === 1 ? 'md:justify-end' : 'md:justify-start')}>
						<div data-reveal class="w-full max-w-xl rounded-3xl border bg-background/80 p-7 shadow-sm backdrop-blur-md md:p-10">
							<span aria-hidden="true" class="grid size-10 place-items-center rounded-full bg-primary-muted text-base font-semibold text-primary">{index + 1}</span>
							<p class="mt-6 text-balance text-2xl font-medium leading-snug tracking-[-0.01em] text-foreground md:text-3xl">{step.title}</p>
							<p class="mt-3 text-pretty leading-relaxed text-muted-foreground">{step.body}</p>
						</div>
					</div>
				{/each}
			</section>

			<section class="mx-auto max-w-6xl px-3 py-16 sm:px-6 lg:px-10">
				<div data-reveal class="rounded-[2rem] border bg-secondary/80 bg-[radial-gradient(var(--border)_1.2px,transparent_1.2px)] bg-[length:26px_26px] p-3 backdrop-blur-sm sm:p-8 md:p-12">
					<OutcomeOrbitVisual />
				</div>
			</section>

			<section data-dot-stage="3" aria-labelledby="audience-title" class="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-10">
				<p id="audience-title" data-reveal class="mx-auto max-w-3xl text-balance text-center text-3xl font-medium leading-tight tracking-[-0.02em] text-foreground md:text-4xl">{landingCopy.audiencesTitle}</p>
				<div class="mt-10 grid gap-4 md:grid-cols-3">
					{#each landingCopy.audiences as audience (audience.title)}
						<div data-reveal class="rounded-3xl border bg-background/80 p-7 backdrop-blur-md">
							<p class="text-xl font-medium tracking-[-0.01em] text-foreground">{audience.title}</p>
							<p class="mt-3 text-pretty leading-relaxed text-muted-foreground">{audience.body}</p>
						</div>
					{/each}
				</div>
			</section>

			<section data-dot-stage="3" aria-labelledby="modules-title" class="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-10">
				<p id="modules-title" data-reveal class="mx-auto max-w-3xl text-balance text-center text-3xl font-medium leading-tight tracking-[-0.02em] text-foreground md:text-4xl">{landingCopy.modulesTitle}</p>
				<div class="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each landingCopy.modules as module (module.title)}
						{@const Icon = moduleIcons[module.icon]}
						<div data-reveal class="rounded-3xl border bg-background/80 p-7 backdrop-blur-md">
							<span aria-hidden="true" class="grid size-10 place-items-center rounded-full bg-primary-muted text-primary"><Icon class="size-5" /></span>
							<p class="mt-5 text-lg font-medium tracking-[-0.01em] text-foreground">{module.title}</p>
							<p class="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">{module.body}</p>
						</div>
					{/each}
				</div>
			</section>

			<section data-dot-stage="3" aria-labelledby="cycle-title" class="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-10">
				<p id="cycle-title" data-reveal class="mx-auto max-w-3xl text-balance text-center text-3xl font-medium leading-tight tracking-[-0.02em] text-foreground md:text-4xl">{landingCopy.cycleTitle}</p>
				<div class="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{#each landingCopy.cycle as phase, index (phase.key)}
						<div data-reveal class="rounded-3xl border bg-background/80 p-7 backdrop-blur-md">
							<p class="flex items-baseline gap-2 text-foreground">
								<span class="text-2xl font-semibold text-primary">{phase.key}</span>
								<span aria-hidden="true" class="text-sm text-muted-foreground">{index + 1}/4</span>
							</p>
							<p class="mt-3 text-lg font-medium tracking-[-0.01em] text-foreground">{phase.title}</p>
							<p class="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">{phase.body}</p>
						</div>
					{/each}
				</div>
			</section>

			<section data-dot-stage="0" aria-labelledby="closing-title" class="relative mx-auto flex min-h-[70svh] max-w-3xl flex-col items-center justify-center px-6 py-20 text-center before:pointer-events-none before:absolute before:inset-x-[8%] before:inset-y-[12%] before:-z-10 before:bg-[radial-gradient(closest-side,var(--background)_45%,transparent)] before:content-['']">
				<p id="closing-title" data-reveal class="text-balance text-3xl font-medium leading-tight tracking-[-0.02em] text-foreground md:text-5xl">{landingCopy.closingTitle}</p>
				<p data-reveal class="mt-5 max-w-xl text-pretty text-lg text-muted-foreground">{landingCopy.closingBody}</p>
				<div data-reveal class="mt-9">
					<a href={landingCopy.loginHref} class={cn(buttonVariants({ size: 'lg' }), 'h-12 gap-2 rounded-full px-7 text-base')}>
						{landingCopy.closingCta}
						<ArrowRight aria-hidden="true" class="size-4" />
					</a>
				</div>
			</section>
		</main>

		<footer class="mx-auto flex max-w-7xl flex-col items-center gap-3 px-6 pb-10 text-center lg:px-10">
			<img src={landingCopy.logoSrc} alt="" aria-hidden="true" width="224" height="224" class="size-9 opacity-90" />
			<p class="text-sm text-muted-foreground">{landingCopy.program} · {landingCopy.faculty} · {landingCopy.university}</p>
		</footer>
	</div>
</div>
