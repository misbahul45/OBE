<script lang="ts">
	import { describeBars, formatValue, linearScale, niceMax, ticks, type BarItem } from './chart-math.ts';
	import ChartFrame from './ChartFrame.svelte';

	let {
		title,
		description,
		items,
		max,
		target = null,
		targetLabel = 'Target',
		unit = '',
		emptyText = 'Belum ada data untuk ditampilkan.'
	}: { title: string; description?: string; items: BarItem[]; max?: number; target?: number | null; targetLabel?: string; unit?: string; emptyText?: string } = $props();

	const rowHeight = 30;
	const labelWidth = 170;
	const valueWidth = 70;
	const plotWidth = 360;
	const width = labelWidth + plotWidth + valueWidth;
	const top = 18;
	const domainMax = $derived(max ?? niceMax([...items.map((i) => i.value), target], 100));
	const x = $derived(linearScale([0, domainMax], [labelWidth, labelWidth + plotWidth]));
	const height = $derived(top + items.length * rowHeight + 22);
	const axis = $derived(ticks(domainMax, 5));
	const summary = $derived(describeBars(items, target, unit));
	const reached = (value: number | null) => value !== null && target !== null && value >= target;
	const truncate = (text: string, size = 26) => (text.length > size ? `${text.slice(0, size - 1)}…` : text);
</script>

{#if items.length === 0}
	<p class="rounded-lg border border-dashed bg-card p-4 text-sm text-muted-foreground" role="status">{emptyText}</p>
{:else}
	<ChartFrame {title} {description} {summary}>
		{#snippet chart({ titleId, descId })}
			<svg viewBox={`0 0 ${width} ${height}`} class="h-auto w-full min-w-[480px]" role="img" aria-labelledby={`${titleId} ${descId}`}>
				{#each axis as tick (tick)}
					<line x1={x(tick)} x2={x(tick)} y1={top - 6} y2={top + items.length * rowHeight} class="stroke-border" stroke-width="1" />
					<text x={x(tick)} y={top + items.length * rowHeight + 14} text-anchor="middle" class="fill-muted-foreground text-[10px]">{formatValue(tick, 0)}</text>
				{/each}
				{#each items as item, i (item.label + i)}
					{@const y = top + i * rowHeight}
					<text x={labelWidth - 8} y={y + rowHeight / 2 + 4} text-anchor="end" class="fill-foreground text-[11px]">{truncate(item.label)}</text>
					{#if item.value !== null}
						<rect x={labelWidth} y={y + 5} width={Math.max(0, x(Math.min(item.value, domainMax)) - labelWidth)} height={rowHeight - 12} rx="3" fill={target === null || reached(item.value) ? 'var(--chart-1)' : 'var(--warning)'} />
						<text x={x(Math.min(item.value, domainMax)) + 6} y={y + rowHeight / 2 + 4} class="fill-foreground text-[11px] font-medium">{formatValue(item.value)}{unit}</text>
					{:else}
						<text x={labelWidth + 6} y={y + rowHeight / 2 + 4} class="fill-muted-foreground text-[11px] italic">belum ada nilai</text>
					{/if}
				{/each}
				{#if target !== null}
					<line x1={x(target)} x2={x(target)} y1={top - 8} y2={top + items.length * rowHeight} stroke="var(--destructive)" stroke-width="2" stroke-dasharray="5 3" />
					<text x={x(target)} y={top - 10} text-anchor="middle" class="fill-foreground text-[10px] font-medium">{targetLabel} {formatValue(target)}{unit}</text>
				{/if}
			</svg>
		{/snippet}
		{#snippet table()}
			<table class="w-full text-left text-sm">
				<thead><tr class="border-b text-muted-foreground"><th class="py-1 pr-4 font-medium">Item</th><th class="py-1 pr-4 text-right font-medium">Nilai</th>{#if target !== null}<th class="py-1 font-medium">Terhadap target {formatValue(target)}{unit}</th>{/if}</tr></thead>
				<tbody>
					{#each items as item, i (item.label + i)}
						<tr class="border-b last:border-0">
							<td class="py-1 pr-4">{item.label}{#if item.note} <span class="text-muted-foreground">({item.note})</span>{/if}</td>
							<td class="py-1 pr-4 text-right tabular-nums">{formatValue(item.value)}{item.value !== null ? unit : ''}</td>
							{#if target !== null}<td class="py-1">{item.value === null ? 'Belum ada nilai' : reached(item.value) ? 'Tercapai' : 'Belum tercapai'}</td>{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		{/snippet}
	</ChartFrame>
{/if}
