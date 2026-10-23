<script lang="ts">
	import { UploadForm } from '#lib/features/imports/components/index.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import PageHeader from '#lib/shared/ui/PageHeader.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head><title>Impor nilai · OBE Teknik Biomedis</title></svelte:head>

<PageHeader title="Impor nilai" description="Unggah berkas Excel nilai kelas Anda. Sistem mendeteksi header, komponen, dan bobot, lalu Anda memeriksanya sebelum menyimpan.">
	{#snippet actions()}<Button variant="outline" href="/app/lecturer/imports">Riwayat impor</Button>{/snippet}
</PageHeader>

<UploadForm message={form?.message} mode={data.uploadMode} />
