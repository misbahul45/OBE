<script lang="ts">
	import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from '@lucide/svelte';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { pageWindow, pageRange } from './pager.ts';

	let {
		page,
		pageCount,
		total,
		href,
		pageSize,
		shown,
		pageSizes,
		sizeHref
	}: { page: number; pageCount: number; total: number; href: (page: number) => string; pageSize?: number; shown?: number; pageSizes?: readonly number[]; sizeHref?: (size: number) => string } = $props();

	const slots = $derived(pageWindow(page, pageCount));
	const range = $derived(pageSize !== undefined && shown !== undefined ? pageRange(page, pageSize, shown, total) : null);
</script>

<nav class="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Navigasi halaman">
	<p class="text-muted-foreground" aria-live="polite">
		{#if range}Menampilkan {range.from}–{range.to} dari {total} · {/if}Halaman {page} dari {pageCount}{#if !range} · {total} data{/if}
	</p>
	<div class="flex flex-wrap items-center gap-1.5">
		<Button variant="outline" size="sm" href={page > 1 ? href(1) : undefined} disabled={page <= 1} aria-label="Halaman pertama"><ChevronsLeft class="size-4" aria-hidden="true" /></Button>
		<Button variant="outline" size="sm" href={page > 1 ? href(page - 1) : undefined} disabled={page <= 1} aria-label="Halaman sebelumnya">
			<ChevronLeft class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">Sebelumnya</span>
		</Button>
		{#each slots as slot, i (slot === 'gap' ? `gap-${i}` : slot)}
			{#if slot === 'gap'}
				<span class="px-1 text-muted-foreground" aria-hidden="true">…</span>
			{:else}
				<Button variant={slot === page ? 'default' : 'outline'} size="sm" href={slot === page ? undefined : href(slot)} aria-current={slot === page ? 'page' : undefined} aria-label={`Halaman ${slot}`} class="min-w-8 tabular-nums">{slot}</Button>
			{/if}
		{/each}
		<Button variant="outline" size="sm" href={page < pageCount ? href(page + 1) : undefined} disabled={page >= pageCount} aria-label="Halaman berikutnya">
			<span class="hidden sm:inline">Berikutnya</span>
			<ChevronRight class="size-4" aria-hidden="true" />
		</Button>
		<Button variant="outline" size="sm" href={page < pageCount ? href(pageCount) : undefined} disabled={page >= pageCount} aria-label="Halaman terakhir"><ChevronsRight class="size-4" aria-hidden="true" /></Button>
	</div>
	{#if pageSizes && sizeHref && pageSize !== undefined}
		<div class="flex items-center gap-1.5" role="group" aria-label="Jumlah baris per halaman">
			<span class="text-muted-foreground">Baris:</span>
			{#each pageSizes as size (size)}
				<Button variant={size === pageSize ? 'secondary' : 'ghost'} size="sm" href={size === pageSize ? undefined : sizeHref(size)} aria-current={size === pageSize ? 'true' : undefined} aria-label={`${size} baris per halaman`} class="tabular-nums">{size}</Button>
			{/each}
		</div>
	{/if}
</nav>
