<script lang="ts">
	import { binLabel, describeBins, formatValue, linearScale, niceMax, ticks, type Bin } from './chart-math.ts';
	import ChartFrame from './ChartFrame.svelte';

	let { title, description, bins, unitLabel = 'mahasiswa', emptyText = 'Belum ada data untuk ditampilkan.' }: { title: string; description?: string; bins: Bin[]; unitLabel?: string; emptyText?: string } = $props();

	const width = 560;
	const height = 220;
	const left = 36;
	const bottom = 32;
	const topPad = 14;
	const total = $derived(bins.reduce((sum, b) => sum + b.count, 0));
	const yMax = $derived(niceMax(bins.map((b) => b.count)));
	const y = $derived(linearScale([0, yMax], [height - bottom, topPad]));
	const slot = $derived((width - left - 8) / Math.max(1, bins.length));
	const axis = $derived(ticks(yMax, 4));
	const summary = $derived(describeBins(bins));
</script>

{#if total === 0}
	<p class="rounded-lg border border-dashed bg-card p-4 text-sm text-muted-foreground" role="status">{emptyText}</p>
{:else}
	<ChartFrame {title} {description} {summary}>
		{#snippet chart({ titleId, descId })}
			<svg viewBox={`0 0 ${width} ${height}`} class="h-auto w-full min-w-[420px]" role="img" aria-labelledby={`${titleId} ${descId}`}>
				{#each axis as tick (tick)}
					<line x1={left} x2={width - 8} y1={y(tick)} y2={y(tick)} class="stroke-border" stroke-width="1" />
					<text x={left - 6} y={y(tick) + 3} text-anchor="end" class="fill-muted-foreground text-[10px]">{formatValue(tick, 0)}</text>
				{/each}
				{#each bins as bin, i (bin.from)}
					{@const barX = left + i * slot + 3}
					{@const barH = height - bottom - y(bin.count)}
					<rect x={barX} y={y(bin.count)} width={Math.max(2, slot - 6)} height={barH} rx="2" fill="var(--chart-1)" />
					{#if bin.count > 0}<text x={barX + (slot - 6) / 2} y={y(bin.count) - 4} text-anchor="middle" class="fill-foreground text-[10px] font-medium">{bin.count}</text>{/if}
					<text x={barX + (slot - 6) / 2} y={height - bottom + 14} text-anchor="middle" class="fill-muted-foreground text-[10px]">{binLabel(bin)}</text>
				{/each}
			</svg>
		{/snippet}
		{#snippet table()}
			<table class="w-full text-left text-sm">
				<thead><tr class="border-b text-muted-foreground"><th class="py-1 pr-4 font-medium">Rentang nilai</th><th class="py-1 text-right font-medium">Jumlah {unitLabel}</th></tr></thead>
				<tbody>
					{#each bins as bin (bin.from)}
						<tr class="border-b last:border-0"><td class="py-1 pr-4">{binLabel(bin)}</td><td class="py-1 text-right tabular-nums">{bin.count}</td></tr>
					{/each}
				</tbody>
			</table>
		{/snippet}
	</ChartFrame>
{/if}
