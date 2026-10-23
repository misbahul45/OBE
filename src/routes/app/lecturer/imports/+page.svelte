<script lang="ts">
	import { BatchHistory } from '#lib/features/imports/components/index.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import FormMessage from '#lib/shared/ui/FormMessage.svelte';
	import PageHeader from '#lib/shared/ui/PageHeader.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Riwayat impor · OBE Teknik Biomedis</title></svelte:head>

<PageHeader title="Riwayat impor" description="Semua batch yang Anda unggah, lengkap dengan status dan laporan.">
	{#snippet actions()}<Button href="/app/lecturer/import">Impor baru</Button>{/snippet}
</PageHeader>

<div class="mb-4"><FormMessage success={data.cancelled ? 'Impor dibatalkan dan berkas sementara dihapus.' : null} /></div>

<BatchHistory rows={data.rows} total={data.total} page={data.page} pageCount={data.pageCount} search={data.search} status={data.status} basePath="/app/lecturer/imports" />
