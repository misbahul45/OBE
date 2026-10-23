<script lang="ts">
	import { Alert, AlertDescription, AlertTitle } from '#lib/components/ui/alert/index.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import PageHeader from '#lib/shared/ui/PageHeader.svelte';
	import BatchReport from './BatchReport.svelte';
	import ImportWizard from './ImportWizard.svelte';

	type Page = { mode: 'wizard' | 'report'; wizard?: import('../imports.view.ts').WizardBatch; offerings?: import('../imports.view.ts').OfferingOption[]; detail: Parameters<typeof BatchReport>[1]['detail'] };

	let { page, form, duplicate, done, basePath }: { page: Page; form: unknown; duplicate: boolean; done: string | null; basePath: string } = $props();

	const committed = $derived(page.detail.batch.status === 'committed');
	const expired = $derived(page.mode === 'report' && !['committed', 'cancelled'].includes(page.detail.batch.status));
</script>

<svelte:head><title>{page.detail.batch.fileName} · Impor nilai</title></svelte:head>

<PageHeader title={page.mode === 'wizard' ? 'Impor nilai' : 'Laporan impor'} description={page.mode === 'wizard' ? 'Periksa pemetaan, jalankan validasi, lalu simpan. Tidak ada data yang berubah sebelum konfirmasi.' : undefined}>
	{#snippet actions()}<Button variant="outline" href={basePath}>Kembali ke riwayat</Button>{/snippet}
</PageHeader>

{#if done && committed}
	<div class="mb-4">
		<Alert role="status">
			<AlertTitle>Impor tersimpan</AlertTitle>
			<AlertDescription>{done === 'hitung' ? 'Data tersimpan, tetapi perhitungan ulang CPMK/CPL gagal. Jalankan perhitungan ulang dari halaman kelas.' : 'Data tersimpan dan hasil CPMK/CPL kelas terkait sudah dihitung ulang.'}</AlertDescription>
		</Alert>
	</div>
{/if}

{#if page.mode === 'wizard' && page.wizard && page.offerings}
	<ImportWizard wizard={page.wizard} offerings={page.offerings} form={form as never} {duplicate} canOpenClasses={basePath.startsWith('/app/admin')} />
{:else}
	<BatchReport detail={page.detail} {basePath} {expired} />
{/if}
