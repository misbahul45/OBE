<script lang="ts">
	import { TracerDirectory } from '#lib/features/tracer/components/index.ts';
	import type { FormState } from '#lib/shared/http/form-state.ts';
	import FormMessage from '#lib/shared/ui/FormMessage.svelte';
	import PageHeader from '#lib/shared/ui/PageHeader.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const state = $derived(form as FormState);
</script>

<svelte:head><title>Tracer alumni · OBE Teknik Biomedis</title></svelte:head>

<PageHeader title="Tracer alumni dan linearitas" description="Prediksi linearitas dari nilai CPL, dibandingkan dengan data nyata alumni yang Anda isi manual. Data nyata dapat diisi kapan saja setelah tersedia." />

<div class="mb-4"><FormMessage message={state?.message} success={state?.success} /></div>

<TracerDirectory overview={data} query={data.query} />
