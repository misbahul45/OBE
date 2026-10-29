<script lang="ts">
	import { describeShares, formatValue, type ShareItem } from './chart-math.ts';
	import ChartFrame from './ChartFrame.svelte';
	import ChartReadout from './ChartReadout.svelte';
	import { markBinding } from './chart-marks.ts';

	let {
		title,
		description,
		items,
		classRatio = null,
		labels = { achieved: 'Tercapai', notAchieved: 'Belum tercapai', insufficient: 'Data belum cukup' },
		ratioLabel = 'rasio tercapai',
		emptyText = 'Belum ada data untuk ditampilkan.'
	}: { title: string; description?: string; items: ShareItem[]; classRatio?: number | null; labels?: { achieved: string; notAchieved: string; insufficient: string }; ratioLabel?: string; emptyText?: string } = $props();

	const rowHeight = 34;
	const barHeight = 18;
	const plotWidth = 300;
	const endWidth = 190;
	const labelWidth = $derived(Math.min(240, Math.max(84, Math.ceil(Math.max(0, ...items.map((i) => i.label.length)) * 6.6) + 16)));
	const width = $derived(labelWidth + plotWidth + endWidth);
	const gap = 2;
	const minLabelWidth = 26;
	const summary = $derived(describeShares(items));
	let active = $state<string | null>(null);

	const total = (item: ShareItem) => item.achieved + item.notAchieved + item.insufficient;
	const segments = (item: ShareItem) => {
		const sum = total(item);
		if (sum === 0) return [];
		const parts = [
			{ key: 'achieved', count: item.achieved, fill: 'var(--chart-1)', ink: 'var(--primary-foreground)', label: labels.achieved },
			{ key: 'notAchieved', count: item.notAchieved, fill: 'var(--warning)', ink: '#0f172a', label: labels.notAchieved },
			{ key: 'insufficient', count: item.insufficient, fill: 'var(--border)', ink: 'var(--foreground)', label: labels.insufficient }
		].filter((p) => p.count > 0);
		let x = labelWidth;
		return parts.map((p, i) => {
			const w = (p.count / sum) * plotWidth;
			const part = { ...p, x, w: Math.max(0, w - (i < parts.length - 1 ? gap : 0)) };
			x += w;
			return part;
		});
	};
	const readout = (item: ShareItem) =>
		`${item.label}: ${item.achieved} mahasiswa ${labels.achieved.toLowerCase()}, ${item.notAchieved} ${labels.notAchieved.toLowerCase()}, ${item.insufficient} ${labels.insufficient.toLowerCase()}${item.ratio !== null ? `; ${ratioLabel} ${formatValue(item.ratio)}%` : ''}${classRatio !== null && item.meets !== null ? (item.meets ? `, memenuhi rasio kelas ${formatValue(classRatio)}%` : `, di bawah rasio kelas ${formatValue(classRatio)}%`) : ''}.`;
	const shown = $derived(items.find((i) => i.label === active));
	const truncate = (text: string, size = 12) => (text.length > size ? `${text.slice(0, size - 1)}…` : text);
</script>

{#if items.length === 0}
	<p class="rounded-lg border border-dashed bg-card p-4 text-sm text-muted-foreground" role="status">{emptyText}</p>
{:else}
	<ChartFrame {title} {description} {summary}>
		{#snippet chart({ titleId, descId })}
			<ul class="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legenda">
				<li class="inline-flex items-center gap-1.5"><span class="inline-block size-3 rounded-sm" style:background="var(--chart-1)"></span>{labels.achieved}</li>
				<li class="inline-flex items-center gap-1.5"><span class="inline-block size-3 rounded-sm" style:background="var(--warning)"></span>{labels.notAchieved}</li>
				<li class="inline-flex items-center gap-1.5"><span class="inline-block size-3 rounded-sm" style:background="var(--border)"></span>{labels.insufficient}</li>
			</ul>
			<svg viewBox={`0 0 ${width} ${items.length * rowHeight + 4}`} class="h-auto w-full min-w-[520px]" role="group" aria-labelledby={`${titleId} ${descId}`}>
				{#each items as item, i (item.label)}
					{@const y = i * rowHeight + (rowHeight - barHeight) / 2}
					<g>
						<text x={labelWidth - 8} y={y + barHeight / 2 + 4} text-anchor="end" class="fill-foreground text-[11px] font-medium">{item.label}</text>
						{#if total(item) === 0}
							<text x={labelWidth + 4} y={y + barHeight / 2 + 4} class="fill-muted-foreground text-[11px] italic">belum ada mahasiswa</text>
						{:else}
							{#each segments(item) as part (part.key)}
								<rect x={part.x} {y} width={part.w} height={barHeight} rx="3" fill={part.fill} opacity={active === null || active === item.label ? 1 : 0.45} />
								{#if part.w >= minLabelWidth && part.key !== 'insufficient'}
									<text x={part.x + part.w / 2} y={y + barHeight / 2 + 4} text-anchor="middle" class="text-[10px] font-semibold" fill={part.ink}>{part.count}</text>
								{/if}
							{/each}
							<rect x={labelWidth} y={y - 4} width={plotWidth} height={barHeight + 8} fill="transparent" aria-label={readout(item)} {...markBinding((k) => (active = k), item.label)} />
							<text x={labelWidth + plotWidth + 10} y={y + barHeight / 2 + 4} class="fill-foreground text-[11px] font-semibold">{item.ratio === null ? '—' : `${formatValue(item.ratio)}%`}</text>
							{#if item.meets !== null}
								<text x={labelWidth + plotWidth + 58} y={y + barHeight / 2 + 4} class="fill-muted-foreground text-[11px]">{item.meets ? 'memenuhi rasio' : 'di bawah rasio'}</text>
							{/if}
						{/if}
					</g>
				{/each}
			</svg>
			<ChartReadout text={shown ? readout(shown) : null} />
		{/snippet}
		{#snippet table()}
			<table class="w-full text-left text-sm">
				<thead><tr class="border-b text-muted-foreground"><th class="py-1 pr-4 font-medium">Capaian</th><th class="py-1 pr-4 text-right font-medium">{labels.achieved}</th><th class="py-1 pr-4 text-right font-medium">{labels.notAchieved}</th><th class="py-1 pr-4 text-right font-medium">{labels.insufficient}</th><th class="py-1 pr-4 text-right font-medium">Rasio</th><th class="py-1 font-medium">Terhadap rasio kelas</th></tr></thead>
				<tbody>
					{#each items as item (item.label)}
						<tr class="border-b last:border-0">
							<td class="py-1 pr-4">{truncate(item.label, 40)}{#if item.note} <span class="text-muted-foreground">({item.note})</span>{/if}</td>
							<td class="py-1 pr-4 text-right tabular-nums">{item.achieved}</td>
							<td class="py-1 pr-4 text-right tabular-nums">{item.notAchieved}</td>
							<td class="py-1 pr-4 text-right tabular-nums">{item.insufficient}</td>
							<td class="py-1 pr-4 text-right tabular-nums">{item.ratio === null ? '—' : `${formatValue(item.ratio)}%`}</td>
							<td class="py-1">{item.meets === null ? 'Rasio kelas belum diatur' : item.meets ? 'Memenuhi' : 'Di bawah rasio'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/snippet}
	</ChartFrame>
{/if}
