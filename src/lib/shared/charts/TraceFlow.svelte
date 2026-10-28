<script lang="ts">
	import { formatValue, layoutFlow, type FlowLink, type FlowNode } from './chart-math.ts';
	import ChartFrame from './ChartFrame.svelte';
	import ChartReadout from './ChartReadout.svelte';
	import { markBinding } from './chart-marks.ts';

	let {
		title,
		description,
		nodes,
		links,
		sourceLabel,
		emptyText = 'Belum ada jejak untuk ditampilkan.'
	}: { title: string; description?: string; nodes: FlowNode[]; links: FlowLink[]; sourceLabel?: string; emptyText?: string } = $props();

	const width = 760;
	const nodeWidth = 14;
	const top = 26;
	const gap = 10;
	const height = $derived(Math.max(220, Math.max(...[0, 1, 2].map((c) => nodes.filter((n) => n.column === c).length)) * 44));
	const layout = $derived(layoutFlow(nodes, links, width - 2, height, nodeWidth, gap));
	const heads = ['Komponen penilaian', 'CPMK', 'CPL'];
	let active = $state<string | null>(null);

	const connected = $derived.by(() => {
		if (active === null) return null;
		const ids = new Set([active]);
		let grew = true;
		while (grew) {
			grew = false;
			for (const link of links) {
				if (ids.has(link.from) && !ids.has(link.to) && layout.nodes.find((n) => n.id === link.to)!.column > layout.nodes.find((n) => n.id === link.from)!.column) {
					ids.add(link.to);
					grew = true;
				}
				if (ids.has(link.to) && !ids.has(link.from) && layout.nodes.find((n) => n.id === link.from)!.column < layout.nodes.find((n) => n.id === link.to)!.column) {
					ids.add(link.from);
					grew = true;
				}
			}
		}
		return ids;
	});
	const fillOf = (node: FlowNode) => (node.column === 0 ? 'var(--chart-2)' : node.reached === true ? 'var(--chart-1)' : node.reached === false ? 'var(--warning)' : 'var(--muted-foreground)');
	const statusOf = (node: FlowNode) => (node.column === 0 ? 'komponen' : node.reached === true ? 'memenuhi rasio kelas' : node.reached === false ? 'di bawah rasio kelas' : 'belum dinilai');
	const readout = (node: FlowNode) => `${node.code}${node.label && node.label !== node.code ? ` — ${node.label}` : ''}: rata-rata ${formatValue(node.value)}${node.column > 0 ? `, ${node.ratio === null ? 'rasio belum ada' : `${formatValue(node.ratio)}% mahasiswa tercapai`}, ${statusOf(node)}` : ''}.`;
	const labelOf = (id: string) => nodes.find((n) => n.id === id)?.code ?? id;
	const shown = $derived(nodes.find((n) => n.id === active));
	const summary = $derived(`${nodes.filter((n) => n.column === 0).length} komponen mengalir ke ${nodes.filter((n) => n.column === 1).length} CPMK dan ${nodes.filter((n) => n.column === 2).length} CPL melalui ${links.length} hubungan.`);
</script>

{#if nodes.length === 0 || links.length === 0}
	<p class="rounded-lg border border-dashed bg-card p-4 text-sm text-muted-foreground" role="status">{emptyText}</p>
{:else}
	<ChartFrame {title} {description} {summary}>
		{#snippet chart({ titleId, descId })}
			<ul class="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legenda">
				<li class="inline-flex items-center gap-1.5"><span class="inline-block size-3 rounded-sm" style:background="var(--chart-2)"></span>Komponen</li>
				<li class="inline-flex items-center gap-1.5"><span class="inline-block size-3 rounded-sm" style:background="var(--chart-1)"></span>Memenuhi rasio kelas</li>
				<li class="inline-flex items-center gap-1.5"><span class="inline-block size-3 rounded-sm" style:background="var(--warning)"></span>Di bawah rasio kelas</li>
				<li class="inline-flex items-center gap-1.5"><span class="inline-block size-3 rounded-sm" style:background="var(--muted-foreground)"></span>Belum dinilai</li>
			</ul>
			<svg viewBox={`0 0 ${width + 150} ${height + top + 8}`} class="h-auto w-full min-w-[640px]" role="group" aria-labelledby={`${titleId} ${descId}`}>
				{#each heads as head, i (head)}
					<text x={i === 0 ? 150 : i === 1 ? 150 + (width - nodeWidth) / 2 : 150 + width - nodeWidth} y="14" text-anchor={i === 0 ? 'start' : i === 1 ? 'middle' : 'end'} class="fill-muted-foreground text-[11px] font-medium" dx={i === 0 ? 0 : i === 1 ? nodeWidth / 2 : nodeWidth}>{head}</text>
				{/each}
				<g transform={`translate(150, ${top})`}>
					{#each layout.paths as path (path.link.from + path.link.to)}
						{@const dim = connected !== null && !(connected.has(path.link.from) && connected.has(path.link.to))}
						<path d={path.d} fill="var(--chart-1)" fill-opacity={dim ? 0.05 : connected !== null ? 0.4 : 0.18} stroke="none" />
					{/each}
					{#each layout.nodes as node (node.id)}
						{@const dim = connected !== null && !connected.has(node.id)}
						<rect x={node.x} y={node.y} width={nodeWidth} height={node.height} rx="3" fill={fillOf(node)} opacity={dim ? 0.35 : 1} />
						<text x={node.column === 0 ? node.x - 8 : node.x + nodeWidth + 8} y={node.y + node.height / 2 + 4} text-anchor={node.column === 0 ? 'end' : 'start'} class="fill-foreground text-[11px] font-medium" opacity={dim ? 0.45 : 1}>{node.code}{node.value !== null ? ` · ${formatValue(node.value, 0)}` : ''}</text>
						<rect x={node.x - (node.column === 0 ? 150 : 8)} y={node.y} width={nodeWidth + (node.column === 0 ? 150 : 16)} height={node.height} fill="transparent" aria-label={readout(node)} {...markBinding((k) => (active = k), node.id)} />
					{/each}
				</g>
			</svg>
			<ChartReadout text={shown ? readout(shown) : null} />
			{#if sourceLabel}<p class="mt-1 text-xs text-muted-foreground">Sumber hubungan: {sourceLabel}. Lebar pita menunjukkan kontribusi (koefisien × bobot komponen, atau bobot CPMK ke CPL).</p>{/if}
		{/snippet}
		{#snippet table()}
			<table class="w-full text-left text-sm">
				<thead><tr class="border-b text-muted-foreground"><th class="py-1 pr-4 font-medium">Dari</th><th class="py-1 pr-4 font-medium">Ke</th><th class="py-1 text-right font-medium">Koefisien atau bobot</th></tr></thead>
				<tbody>
					{#each links as link (link.from + link.to)}
						<tr class="border-b last:border-0"><td class="py-1 pr-4">{labelOf(link.from)}</td><td class="py-1 pr-4">{labelOf(link.to)}</td><td class="py-1 text-right tabular-nums">{formatValue(link.display, 2)}</td></tr>
					{/each}
				</tbody>
			</table>
		{/snippet}
	</ChartFrame>
{/if}
