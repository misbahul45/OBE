<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.ts';
	import { CourseCards } from '#lib/features/dashboard/components/index.ts';
	import { batchStatusLabel, batchStatusTone } from '#lib/features/imports/index.ts';
	import EmptyState from '#lib/shared/ui/EmptyState.svelte';
	import PageHeader from '#lib/shared/ui/PageHeader.svelte';
	import StatusBadge from '#lib/shared/ui/StatusBadge.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const stamp = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
</script>

<svelte:head><title>Dashboard dosen · OBE Teknik Biomedis</title></svelte:head>

<PageHeader title="Dashboard dosen" description={data.semester ? `Semester aktif: ${data.semester.name}` : 'Belum ada semester aktif. Hubungi Super Admin.'}>
	{#snippet actions()}<Button href="/app/lecturer/import">Impor nilai</Button>{/snippet}
</PageHeader>

<section aria-labelledby="courses-heading" class="mb-10">
	<h2 id="courses-heading" class="mb-3 text-lg font-semibold">Kelas saya</h2>
	<CourseCards rows={data.rows} courseBase="/app/lecturer/courses" importHref="/app/lecturer/import" />
</section>

<section aria-labelledby="imports-heading">
	<div class="mb-3 flex items-center justify-between"><h2 id="imports-heading" class="text-lg font-semibold">Impor terbaru</h2><Button variant="outline" size="sm" href="/app/lecturer/imports">Semua impor</Button></div>
	{#if data.imports.length === 0}
		<EmptyState title="Belum ada impor" description="Unggah berkas nilai kelas Anda untuk mulai." actionLabel="Impor nilai kelas" actionHref="/app/lecturer/import" />
	{:else}
		<ul class="divide-y rounded-lg border bg-card">
			{#each data.imports as batch (batch.id)}
				<li class="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
					<a class="max-w-72 truncate font-medium text-primary underline-offset-4 hover:underline" href={`/app/lecturer/imports/${batch.id}`} title={batch.fileName}>{batch.fileName}</a>
					<span class="flex items-center gap-2"><span class="text-xs text-muted-foreground">{stamp.format(new Date(batch.createdAt))}</span><StatusBadge status={batchStatusTone[batch.status] ?? 'neutral'} label={batchStatusLabel[batch.status] ?? batch.status} /></span>
				</li>
			{/each}
		</ul>
	{/if}
</section>
