<script lang="ts">
	import { FindingList } from '#lib/features/cqi/components/index.ts';
	import type { FormState } from '#lib/shared/http/form-state.ts';
	import PageHeader from '#lib/shared/ui/PageHeader.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head><title>Tindak lanjut CQI · OBE Teknik Biomedis</title></svelte:head>

<PageHeader title="Tindak lanjut CQI" description="Temuan di kelas Anda dan tindakan yang ditugaskan kepada Anda." />

<FindingList rows={data.rows} total={data.total} page={data.page} pageCount={data.pageCount} query={data.query} canCreate={data.canCreate} offeringOptions={data.offeringOptions} cplOptions={data.cplOptions} basePath="/app/lecturer/cqi" form={form as FormState} />
