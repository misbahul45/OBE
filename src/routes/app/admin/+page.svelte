<script lang="ts">
	import { AdminOverview } from '#lib/features/dashboard/components/index.ts';
	import PageHeader from '#lib/shared/ui/PageHeader.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Dashboard prodi · OBE Teknik Biomedis</title></svelte:head>

<PageHeader title="Dashboard program studi" description="Ringkasan semester aktif. Semua angka dihitung dari data tersimpan, bukan nilai statis." />

<AdminOverview program={data.program} imports={data.imports} setup={data.setup} />
