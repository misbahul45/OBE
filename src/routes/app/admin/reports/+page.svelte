<script lang="ts">
	import { ReportsIndex } from '#lib/features/reports/components/index.ts';
	import PageHeader from '#lib/shared/ui/PageHeader.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Laporan · OBE Teknik Biomedis</title></svelte:head>

<PageHeader title="Laporan" description="Unduh laporan capaian per kelas. Transkrip mahasiswa diunduh dari halaman profil mahasiswa, dan catatan galat impor dari laporan batch." />

<ReportsIndex semesters={data.semesters} semesterId={data.semesterId} search={data.search} rows={data.rows} total={data.total} page={data.page} pageCount={data.pageCount} />
