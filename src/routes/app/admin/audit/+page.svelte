<script lang="ts">
	import { AuditTable } from '#lib/features/audit/components/index.ts';
	import PageHeader from '#lib/shared/ui/PageHeader.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Jejak audit · OBE Teknik Biomedis</title></svelte:head>

<PageHeader title="Jejak audit" description="Catatan perubahan data penting. Data sensitif disamarkan sebelum disimpan." />

<AuditTable rows={data.rows} total={data.total} page={data.page} pageCount={data.pageCount} search={data.search} entityType={data.entityType} entities={data.entities} />
