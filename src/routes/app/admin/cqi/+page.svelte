<script lang="ts">
	import { FindingList } from '#lib/features/cqi/components/index.ts';
	import type { FormState } from '#lib/shared/http/form-state.ts';
	import PageHeader from '#lib/shared/ui/PageHeader.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head><title>Tindak lanjut mutu (CQI) · OBE Teknik Biomedis</title></svelte:head>

<PageHeader title="Tindak lanjut mutu (CQI)" description="Temuan mutu pembelajaran, tindakan perbaikan, bukti, dan evaluasi dampaknya." />

<FindingList rows={data.rows} total={data.total} page={data.page} pageCount={data.pageCount} query={data.query} canCreate={data.canCreate} offeringOptions={data.offeringOptions} cplOptions={data.cplOptions} basePath="/app/admin/cqi" form={form as FormState} />
