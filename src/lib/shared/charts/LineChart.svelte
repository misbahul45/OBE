<script lang="ts">
	import { formatValue, linearScale, ticks } from './chart-math.ts';
	import ChartFrame from './ChartFrame.svelte';

	type Series = { name: string; values: (number | null)[] };

	let {
		title,
		description,
		categories,
		series,
		max = 100,
		target = null,
		unit = '',
		emptyText = 'Belum ada data untuk ditampilkan.'
	}: { title: string; description?: string; categories: string[]; series: Series[]; max?: number; target?: number | null; unit?: string; emptyText?: string } = $props();

	const width = 560;
	const height = 240;
	const left = 40;
	const right = 16;
	const topPad = 16;
	const bottom = 36;
	const colors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-4)'];
	const dashes = ['', '6 3', '2 3'];
	const y = $derived(linearScale([0, max], [height - bottom, topPad]));
	const step = $derived((width - left - right) / Math.max(1, categories.length - 1));
	const px = (i: number) => (categories.length === 1 ? (left + width - right) / 2 : left + i * step);
	const axis = $derived(ticks(max, 5));
	const hasData = $derived(series.some((s) => s.values.some((v) => v !== null)));
	const summary = $derived(`${series.length} seri pada ${categories.length} titik. ${series.map((s) => `${s.name}: ${s.values.map((v, i) => `${categories[i]} ${formatValue(v)}${v === null ? '' : unit}`).join(', ')}`).join('. ')}.`);
	const segments = (values: (number | null)[]) => {
		const out: string[] = [];
		let current = '';
		values.forEach((v, i) => {
			if (v === null) {
				if (current) out.push(current);
				current = '';
			} else current += `${current ? ' L' : 'M'}${px(i)} ${y(v)}`;
		});
		if (current) out.push(current);
		return out;
	};
</script>

{#if categories.length === 0 || !hasData}
	<p class="rounded-lg border border-dashed bg-card p-4 text-sm text-muted-foreground" role="status">{emptyText}</p>
{:else}
	<ChartFrame {title} {description} {summary}>
		{#snippet chart({ titleId, descId })}
			<svg viewBox={`0 0 ${width} ${height}`} class="h-auto w-full min-w-[420px]" role="img" aria-labelledby={`${titleId} ${descId}`}>
				{#each axis as tick (tick)}
					<line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} class="stroke-border" stroke-width="1" />
					<text x={left - 6} y={y(tick) + 3} text-anchor="end" class="fill-muted-foreground text-[10px]">{formatValue(tick, 0)}</text>
				{/each}
				{#if target !== null}
					<line x1={left} x2={width - right} y1={y(target)} y2={y(target)} stroke="var(--destructive)" stroke-width="2" stroke-dasharray="5 3" />
					<text x={width - right} y={y(target) - 4} text-anchor="end" class="fill-foreground text-[10px] font-medium">Target {formatValue(target)}{unit}</text>
				{/if}
				{#each categories as category, i (category + i)}
					<text x={px(i)} y={height - bottom + 16} text-anchor="middle" class="fill-muted-foreground text-[10px]">{category}</text>
				{/each}
				{#each series as line, s (line.name)}
					{#each segments(line.values) as path (path)}
						<path d={path} fill="none" stroke={colors[s % colors.length]} stroke-width="2.5" stroke-dasharray={dashes[s % dashes.length]} stroke-linejoin="round" />
					{/each}
					{#each line.values as value, i (i)}
						{#if value !== null}
							<circle cx={px(i)} cy={y(value)} r="4" fill={colors[s % colors.length]} class="stroke-card" stroke-width="2" />
							<text x={px(i)} y={y(value) - 9} text-anchor="middle" class="fill-foreground text-[10px] font-medium">{formatValue(value)}</text>
						{/if}
					{/each}
				{/each}
			</svg>
			{#if series.length > 1}
				<ul class="mt-2 flex flex-wrap gap-4 text-xs">
					{#each series as line, s (line.name)}
						<li class="inline-flex items-center gap-1.5"><svg width="24" height="8" aria-hidden="true"><line x1="0" x2="24" y1="4" y2="4" stroke={colors[s % colors.length]} stroke-width="2.5" stroke-dasharray={dashes[s % dashes.length]} /></svg>{line.name}</li>
					{/each}
				</ul>
			{/if}
		{/snippet}
		{#snippet table()}
			<table class="w-full text-left text-sm">
				<thead>
					<tr class="border-b text-muted-foreground"><th class="py-1 pr-4 font-medium">Periode</th>{#each series as line (line.name)}<th class="py-1 pr-4 text-right font-medium">{line.name}</th>{/each}</tr>
				</thead>
				<tbody>
					{#each categories as category, i (category + i)}
						<tr class="border-b last:border-0"><td class="py-1 pr-4">{category}</td>{#each series as line (line.name)}<td class="py-1 pr-4 text-right tabular-nums">{formatValue(line.values[i])}</td>{/each}</tr>
					{/each}
				</tbody>
			</table>
		{/snippet}
	</ChartFrame>
{/if}
