<script lang="ts">
	import { BatchHistory, UploadForm } from '#lib/features/imports/components/index.ts';
	import FormMessage from '#lib/shared/ui/FormMessage.svelte';
	import PageHeader from '#lib/shared/ui/PageHeader.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head><title>Impor nilai · OBE Teknik Biomedis</title></svelte:head>

<PageHeader title="Impor nilai" description="Unggah berkas Excel untuk kelas mana pun. Super Admin dapat memilih kelas tujuan dari semester aktif." />

<div class="mb-4"><FormMessage success={data.cancelled ? 'Impor dibatalkan dan berkas sementara dihapus.' : null} /></div>

<div class="mb-8"><UploadForm message={form?.message} mode={data.uploadMode} /></div>

<h2 class="mb-3 text-lg font-semibold">Riwayat impor</h2>
<BatchHistory rows={data.rows} total={data.total} page={data.page} pageCount={data.pageCount} search={data.search} status={data.status} basePath="/app/admin/imports" showUploader />
