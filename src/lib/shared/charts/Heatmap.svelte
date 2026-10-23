<script lang="ts">
	import { formatValue, heatBand, heatBands } from './chart-math.ts';
	import ChartFrame from './ChartFrame.svelte';

	type Cell = { value: number | null; note?: string };

	let {
		title,
		description,
		rows,
		columns,
		cells,
		emptyText = 'Belum ada data untuk ditampilkan.'
	}: { title: string; description?: string; rows: string[]; columns: string[]; cells: Cell[][]; emptyText?: string } = $props();

	const filled = $derived(cells.flat().filter((c) => c.value !== null).length);
	const summary = $derived(rows.length === 0 || columns.length === 0 ? 'Tidak ada data.' : `${rows.length} baris dan ${columns.length} kolom; ${filled} sel memiliki nilai, ${rows.length * columns.length - filled} belum ada nilai.`);
	const truncate = (text: string, size = 28) => (text.length > size ? `${text.slice(0, size - 1)}…` : text);
</script>

{#if rows.length === 0 || columns.length === 0}
	<p class="rounded-lg border border-dashed bg-card p-4 text-sm text-muted-foreground" role="status">{emptyText}</p>
{:else}
	<ChartFrame {title} {description} {summary}>
		{#snippet chart()}
			<div class="min-w-[420px]" aria-hidden="true">
				<div class="grid gap-1" style:grid-template-columns={`minmax(120px, 190px) repeat(${columns.length}, minmax(64px, 1fr))`}>
					<div></div>
					{#each columns as column (column)}<div class="px-1 pb-1 text-center text-xs font-medium text-muted-foreground">{column}</div>{/each}
					{#each rows as row, r (row + r)}
						<div class="flex items-center pr-2 text-xs" title={row}>{truncate(row)}</div>
						{#each columns as column, c (column)}
							{@const cell = cells[r]?.[c]}
							{@const band = heatBand(cell?.value)}
							<div class="flex h-9 items-center justify-center rounded text-xs font-semibold tabular-nums" style:background={band?.background ?? 'transparent'} style:color={band?.foreground ?? 'var(--muted-foreground)'} style:border={band ? '1px solid var(--border)' : '1px dashed var(--border)'}>
								{formatValue(cell?.value)}
							</div>
						{/each}
					{/each}
				</div>
				<div class="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
					{#each heatBands as band (band.min)}
						<span class="inline-flex items-center gap-1.5"><span class="inline-block size-3 rounded-sm border" style:background={band.background}></span>{band.label}</span>
					{/each}
					<span class="inline-flex items-center gap-1.5"><span class="inline-block size-3 rounded-sm border border-dashed"></span>belum ada nilai</span>
				</div>
			</div>
		{/snippet}
		{#snippet table()}
			<table class="w-full text-left text-sm">
				<thead>
					<tr class="border-b text-muted-foreground"><th class="py-1 pr-4 font-medium">Baris</th>{#each columns as column (column)}<th class="py-1 pr-4 text-right font-medium">{column}</th>{/each}</tr>
				</thead>
				<tbody>
					{#each rows as row, r (row + r)}
						<tr class="border-b last:border-0"><td class="py-1 pr-4">{row}</td>{#each columns as column, c (column)}<td class="py-1 pr-4 text-right tabular-nums">{formatValue(cells[r]?.[c]?.value)}</td>{/each}</tr>
					{/each}
				</tbody>
			</table>
		{/snippet}
	</ChartFrame>
{/if}
