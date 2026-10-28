<script lang="ts">
	import { formatValue, linearScale, ticks, type DumbbellItem } from './chart-math.ts';
	import ChartFrame from './ChartFrame.svelte';
	import ChartReadout from './ChartReadout.svelte';
	import { markBinding } from './chart-marks.ts';

	let {
		title,
		description,
		items,
		firstLabel = 'Excel',
		secondLabel = 'Hitung sistem',
		max = 100,
		emptyText = 'Belum ada pasangan nilai untuk dibandingkan.'
	}: { title: string; description?: string; items: DumbbellItem[]; firstLabel?: string; secondLabel?: string; max?: number; emptyText?: string } = $props();

	const rowHeight = 30;
	const labelWidth = 84;
	const plotWidth = 380;
	const endWidth = 90;
	const top = 12;
	const paired = $derived(items.filter((i) => i.first !== null && i.second !== null));
	const x = $derived(linearScale([0, max], [labelWidth, labelWidth + plotWidth]));
	const axis = $derived(ticks(max, 5));
	const delta = (item: DumbbellItem) => (item.first !== null && item.second !== null ? Math.round((item.second - item.first) * 100) / 100 : null);
	const signed = (value: number | null) => (value === null ? '—' : `${value > 0 ? '+' : ''}${formatValue(value, 2)}`);
	const summary = $derived(paired.length === 0 ? 'Tidak ada pasangan nilai.' : `${paired.length} pasangan. Selisih terbesar ${signed([...paired].sort((a, b) => Math.abs(delta(b) as number) - Math.abs(delta(a) as number)).map(delta)[0])}.`);
	let active = $state<string | null>(null);
	const readout = (item: DumbbellItem) => `${item.label}: ${firstLabel} ${formatValue(item.first)}, ${secondLabel} ${formatValue(item.second)}, selisih ${signed(delta(item))}.`;
	const shown = $derived(paired.find((i) => i.label === active));
</script>

{#if paired.length === 0}
	<p class="rounded-lg border border-dashed bg-card p-4 text-sm text-muted-foreground" role="status">{emptyText}</p>
{:else}
	<ChartFrame {title} {description} {summary}>
		{#snippet chart({ titleId, descId })}
			<ul class="mb-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legenda">
				<li class="inline-flex items-center gap-1.5"><span class="inline-block size-3 rounded-full" style:background="var(--chart-2)"></span>{firstLabel}</li>
				<li class="inline-flex items-center gap-1.5"><span class="inline-block size-3 rounded-full" style:background="var(--chart-1)"></span>{secondLabel}</li>
			</ul>
			<svg viewBox={`0 0 ${labelWidth + plotWidth + endWidth} ${top + paired.length * rowHeight + 22}`} class="h-auto w-full min-w-[500px]" role="group" aria-labelledby={`${titleId} ${descId}`}>
				{#each axis as tick (tick)}
					<line x1={x(tick)} x2={x(tick)} y1={top - 4} y2={top + paired.length * rowHeight} class="stroke-border" stroke-width="1" />
					<text x={x(tick)} y={top + paired.length * rowHeight + 14} text-anchor="middle" class="fill-muted-foreground text-[10px]">{formatValue(tick, 0)}</text>
				{/each}
				{#each paired as item, i (item.label)}
					{@const y = top + i * rowHeight + rowHeight / 2}
					<text x={labelWidth - 8} y={y + 4} text-anchor="end" class="fill-foreground text-[11px]">{item.label}</text>
					<line x1={x(item.first as number)} x2={x(item.second as number)} y1={y} y2={y} stroke="var(--muted-foreground)" stroke-width="2" stroke-linecap="round" />
					<circle cx={x(item.first as number)} cy={y} r="5" fill="var(--chart-2)" stroke="var(--card)" stroke-width="2" />
					<circle cx={x(item.second as number)} cy={y} r="5" fill="var(--chart-1)" stroke="var(--card)" stroke-width="2" />
					<text x={labelWidth + plotWidth + 10} y={y + 4} class="fill-foreground text-[11px] font-medium">{signed(delta(item))}</text>
					<rect x={labelWidth} y={y - rowHeight / 2} width={plotWidth} height={rowHeight} fill="transparent" aria-label={readout(item)} {...markBinding((k) => (active = k), item.label)} />
				{/each}
			</svg>
			<ChartReadout text={shown ? readout(shown) : null} />
		{/snippet}
		{#snippet table()}
			<table class="w-full text-left text-sm">
				<thead><tr class="border-b text-muted-foreground"><th class="py-1 pr-4 font-medium">Item</th><th class="py-1 pr-4 text-right font-medium">{firstLabel}</th><th class="py-1 pr-4 text-right font-medium">{secondLabel}</th><th class="py-1 text-right font-medium">Selisih</th></tr></thead>
				<tbody>
					{#each paired as item (item.label)}
						<tr class="border-b last:border-0"><td class="py-1 pr-4">{item.label}</td><td class="py-1 pr-4 text-right tabular-nums">{formatValue(item.first, 2)}</td><td class="py-1 pr-4 text-right tabular-nums">{formatValue(item.second, 2)}</td><td class="py-1 text-right tabular-nums">{signed(delta(item))}</td></tr>
					{/each}
				</tbody>
			</table>
		{/snippet}
	</ChartFrame>
{/if}
