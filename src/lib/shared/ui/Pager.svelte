<script lang="ts">
	import { ChevronLeft, ChevronRight } from '@lucide/svelte';
	import { Button } from '#lib/components/ui/button/index.ts';

	let { page, pageCount, total, href }: { page: number; pageCount: number; total: number; href: (page: number) => string } = $props();
</script>

<nav class="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Navigasi halaman">
	<p class="text-muted-foreground" aria-live="polite">Halaman {page} dari {pageCount} · {total} data</p>
	<div class="flex gap-2">
		<Button variant="outline" size="sm" href={page > 1 ? href(page - 1) : undefined} disabled={page <= 1} aria-label="Halaman sebelumnya">
			<ChevronLeft class="size-4" aria-hidden="true" />
			Sebelumnya
		</Button>
		<Button variant="outline" size="sm" href={page < pageCount ? href(page + 1) : undefined} disabled={page >= pageCount} aria-label="Halaman berikutnya">
			Berikutnya
			<ChevronRight class="size-4" aria-hidden="true" />
		</Button>
	</div>
</nav>
