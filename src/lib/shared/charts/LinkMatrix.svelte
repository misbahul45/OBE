<script lang="ts">
	import { formatValue } from './chart-math.ts';
	import ChartFrame from './ChartFrame.svelte';

	type Cell = number | null;

	let {
		title,
		description,
		rows,
		columns,
		cells,
		digits = 2,
		emptyText = 'Belum ada hubungan untuk ditampilkan.'
	}: { title: string; description?: string; rows: string[]; columns: string[]; cells: Cell[][]; digits?: number; emptyText?: string } = $props();

	const peak = $derived(Math.max(0, ...cells.flat().filter((v): v is number => v !== null)));
	const links = $derived(cells.flat().filter((v) => v !== null && v > 0).length);
	const summary = $derived(rows.length === 0 || columns.length === 0 ? 'Tidak ada data.' : `${rows.length} baris dan ${columns.length} kolom; ${links} hubungan terisi.`);
	const shade = (value: Cell) => (value === null || value <= 0 || peak === 0 ? 'transparent' : `color-mix(in srgb, var(--chart-1) ${Math.round(18 + (value / peak) * 62)}%, var(--card))`);
	const ink = (value: Cell) => (value !== null && peak > 0 && value / peak > 0.62 ? 'var(--primary-foreground)' : 'var(--foreground)');
</script>

{#if rows.length === 0 || columns.length === 0 || links === 0}
	<p class="rounded-lg border border-dashed bg-card p-4 text-sm text-muted-foreground" role="status">{emptyText}</p>
{:else}
	<ChartFrame {title} {description} {summary}>
		{#snippet chart()}
			<div class="min-w-[420px]" aria-hidden="true">
				<div class="grid gap-0.5" style:grid-template-columns={`minmax(88px, 140px) repeat(${columns.length}, minmax(48px, 1fr))`}>
					<div></div>
					{#each columns as column (column)}<div class="px-1 pb-1 text-center text-xs font-medium text-muted-foreground">{column}</div>{/each}
					{#each rows as row, r (row)}
						<div class="flex items-center pr-2 text-xs font-medium">{row}</div>
						{#each columns as column, c (column)}
							{@const value = cells[r]?.[c] ?? null}
							<div class="flex h-8 items-center justify-center rounded text-xs tabular-nums" style:background={shade(value)} style:color={ink(value)} style:border={value !== null && value > 0 ? '1px solid var(--border)' : '1px solid transparent'}>{value !== null && value > 0 ? formatValue(value, digits) : ''}</div>
						{/each}
					{/each}
				</div>
			</div>
		{/snippet}
		{#snippet table()}
			<table class="w-full text-left text-sm">
				<thead><tr class="border-b text-muted-foreground"><th class="py-1 pr-4 font-medium">Baris</th>{#each columns as column (column)}<th class="py-1 pr-4 text-right font-medium">{column}</th>{/each}</tr></thead>
				<tbody>
					{#each rows as row, r (row)}
						<tr class="border-b last:border-0"><td class="py-1 pr-4">{row}</td>{#each columns as column, c (column)}<td class="py-1 pr-4 text-right tabular-nums">{cells[r]?.[c] ? formatValue(cells[r][c], digits) : '—'}</td>{/each}</tr>
					{/each}
				</tbody>
			</table>
		{/snippet}
	</ChartFrame>
{/if}
