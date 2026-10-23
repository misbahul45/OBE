<script lang="ts">
	import { StudentDirectory } from '#lib/features/students/components/index.ts';
	import type { FormState } from '#lib/shared/http/form-state.ts';
	import FormMessage from '#lib/shared/ui/FormMessage.svelte';
	import PageHeader from '#lib/shared/ui/PageHeader.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const state = $derived(form as FormState);
</script>

<svelte:head><title>Mahasiswa · OBE Teknik Biomedis</title></svelte:head>

<PageHeader title="Mahasiswa" description="Direktori mahasiswa dari seluruh impor. Angkatan dapat diisi manual karena tidak selalu ada di berkas Excel." />

<div class="mb-4"><FormMessage message={state?.message} success={state?.success} /></div>

<StudentDirectory rows={data.rows} total={data.total} page={data.page} pageCount={data.pageCount} cohorts={data.cohorts} semesters={data.semesters} courses={data.courses} query={data.query} />
