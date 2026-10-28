<script lang="ts">
	import { describeRadar, formatValue, polar, type RadarAxis } from './chart-math.ts';
	import ChartFrame from './ChartFrame.svelte';
	import ChartReadout from './ChartReadout.svelte';
	import { markBinding } from './chart-marks.ts';

	let {
		title,
		description,
		axes,
		max = 100,
		valueLabel = 'Nilai',
		targetLabel = 'Ambang',
		emptyText = 'Belum ada data untuk ditampilkan.'
	}: { title: string; description?: string; axes: RadarAxis[]; max?: number; valueLabel?: string; targetLabel?: string; emptyText?: string } = $props();

	const size = 400;
	const cx = size / 2;
	const cy = 168;
	const radius = 116;
	const rings = [0.25, 0.5, 0.75, 1];
	const count = $derived(axes.length);
	const point = (index: number, value: number) => polar(cx, cy, (Math.max(0, Math.min(value, max)) / max) * radius, index, count);
	const polygon = (values: (number | null)[]) => values.map((v, i) => point(i, v ?? 0)).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
	const hasTarget = $derived(axes.some((a) => a.target !== null));
	const summary = $derived(describeRadar(axes));
	let active = $state<number | null>(null);
	const readout = (axis: RadarAxis) => `${axis.label}: ${axis.value === null ? 'belum ada nilai' : formatValue(axis.value)}${axis.target !== null ? `, ${targetLabel.toLowerCase()} ${formatValue(axis.target)}${axis.value !== null ? (axis.value >= axis.target ? ', tercapai' : ', belum tercapai') : ''}` : ''}${axis.note ? ` (${axis.note})` : ''}.`;
	const anchor = (index: number) => {
		const p = polar(cx, cy, radius + 18, index, count);
		return { ...p, align: p.x < cx - 8 ? 'end' : p.x > cx + 8 ? 'start' : 'middle' } as const;
	};
</script>

{#if axes.length < 3}
	<p class="rounded-lg border border-dashed bg-card p-4 text-sm text-muted-foreground" role="status">{axes.length === 0 ? emptyText : 'Grafik radar membutuhkan minimal tiga CPL; lihat grafik batang di sebelahnya.'}</p>
{:else}
	<ChartFrame {title} {description} {summary}>
		{#snippet chart({ titleId, descId })}
			<ul class="mb-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legenda">
				<li class="inline-flex items-center gap-1.5"><span class="inline-block h-0.5 w-4" style:background="var(--chart-1)"></span>{valueLabel}</li>
				{#if hasTarget}<li class="inline-flex items-center gap-1.5"><span class="inline-block h-0.5 w-4" style:background="var(--destructive)"></span>{targetLabel}</li>{/if}
			</ul>
			<svg viewBox={`0 0 ${size} 340`} class="mx-auto h-auto w-full max-w-[440px]" role="group" aria-labelledby={`${titleId} ${descId}`}>
				{#each rings as ring (ring)}
					<polygon points={Array.from({ length: count }, (_, i) => polar(cx, cy, radius * ring, i, count)).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')} fill="none" class="stroke-border" stroke-width="1" />
					<text x={cx + 3} y={cy - radius * ring - 2} class="fill-muted-foreground text-[9px]">{formatValue(max * ring, 0)}</text>
				{/each}
				{#each axes as axis, i (axis.label)}
					{@const end = polar(cx, cy, radius, i, count)}
					{@const label = anchor(i)}
					<line x1={cx} y1={cy} x2={end.x} y2={end.y} class="stroke-border" stroke-width="1" />
					<text x={label.x} y={label.y + 4} text-anchor={label.align} class="fill-foreground text-[11px] font-medium">{axis.label}</text>
				{/each}
				{#if hasTarget}
					<polygon points={polygon(axes.map((a) => a.target))} fill="none" stroke="var(--destructive)" stroke-width="1.5" stroke-linejoin="round" />
				{/if}
				<polygon points={polygon(axes.map((a) => a.value))} fill="var(--chart-1)" fill-opacity="0.12" stroke="var(--chart-1)" stroke-width="2" stroke-linejoin="round" />
				{#each axes as axis, i (axis.label)}
					{@const p = point(i, axis.value ?? 0)}
					{#if axis.value !== null}
						<circle cx={p.x} cy={p.y} r="4.5" fill="var(--chart-1)" stroke="var(--card)" stroke-width="2" opacity={active === null || active === i ? 1 : 0.5} />
					{/if}
					<circle cx={p.x} cy={p.y} r="14" fill="transparent" aria-label={readout(axis)} {...markBinding((k) => (active = k), i)} />
				{/each}
			</svg>
			<ChartReadout text={active === null ? null : readout(axes[active])} />
		{/snippet}
		{#snippet table()}
			<table class="w-full text-left text-sm">
				<thead><tr class="border-b text-muted-foreground"><th class="py-1 pr-4 font-medium">Sumbu</th><th class="py-1 pr-4 text-right font-medium">{valueLabel}</th><th class="py-1 pr-4 text-right font-medium">{targetLabel}</th><th class="py-1 font-medium">Status</th></tr></thead>
				<tbody>
					{#each axes as axis (axis.label)}
						<tr class="border-b last:border-0">
							<td class="py-1 pr-4">{axis.label}{#if axis.note} <span class="text-muted-foreground">({axis.note})</span>{/if}</td>
							<td class="py-1 pr-4 text-right tabular-nums">{formatValue(axis.value)}</td>
							<td class="py-1 pr-4 text-right tabular-nums">{formatValue(axis.target)}</td>
							<td class="py-1">{axis.value === null ? 'Belum ada nilai' : axis.target === null ? 'Ambang belum diatur' : axis.value >= axis.target ? 'Tercapai' : 'Belum tercapai'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/snippet}
	</ChartFrame>
{/if}
