<script lang="ts">
	import { enhance } from '$app/forms';
	import { FileUp, LoaderCircle } from '@lucide/svelte';
	import type { FileRouter } from 'uploadthing/types';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#lib/components/ui/card/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import Field from '#lib/shared/ui/Field.svelte';
	import FormMessage from '#lib/shared/ui/FormMessage.svelte';
	import ImportSteps from './ImportSteps.svelte';

	let { message, mode = 'direct' }: { message?: string | null; mode?: 'direct' | 'storage' } = $props();
	let pending = $state(false);
	let percent = $state<number | null>(null);
	let localError = $state<string | null>(null);

	const maxBytes = 10 * 1024 * 1024;
	const action = $derived(mode === 'storage' ? '?/uploadStored' : '?/upload');
</script>

<div class="mb-4"><ImportSteps current="upload" /></div>

<Card>
	<CardHeader>
		<CardTitle>Unggah berkas nilai</CardTitle>
		<CardDescription>Format .xlsx atau .csv, maksimal 10 MB. Satu sheet berisi nilai satu kelas. Berkas diperiksa dulu; tidak ada data yang tersimpan sebelum Anda mengonfirmasi.</CardDescription>
	</CardHeader>
	<CardContent class="space-y-4">
		<FormMessage message={localError ?? message} />
		<form
			method="POST"
			{action}
			enctype="multipart/form-data"
			use:enhance={async ({ formData, cancel }) => {
				localError = null;
				pending = true;
				if (mode === 'storage') {
					const file = formData.get('file');
					if (!(file instanceof File) || file.size === 0) {
						pending = false;
						localError = 'Pilih berkas .xlsx atau .csv terlebih dahulu.';
						cancel();
						return;
					}
					if (file.size > maxBytes) {
						pending = false;
						localError = 'Ukuran berkas melebihi batas 10 MB.';
						cancel();
						return;
					}
					try {
						const { genUploader } = await import('uploadthing/client');
						const { uploadFiles } = genUploader<FileRouter>({ url: '/api/uploadthing' });
						const [uploaded] = await uploadFiles('importWorkbook', { files: [file], onUploadProgress: ({ totalProgress }) => (percent = Math.round(totalProgress)) });
						formData.delete('file');
						formData.set('fileRef', uploaded.customId ?? '');
						formData.set('fileName', file.name);
					} catch {
						pending = false;
						percent = null;
						localError = 'Unggahan ke penyimpanan gagal. Periksa koneksi dan coba lagi.';
						cancel();
						return;
					}
				}
				return async ({ update }) => {
					await update();
					pending = false;
					percent = null;
				};
			}}
			class="flex flex-wrap items-end gap-3"
		>
			<div class="min-w-64 flex-1">
				<Field id="file" label="Berkas Excel atau CSV">
					{#snippet children({ describedBy })}
						<Input id="file" name="file" type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" required aria-describedby={describedBy} />
					{/snippet}
				</Field>
			</div>
			<Button type="submit" disabled={pending} class="gap-2">
				{#if pending}<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />{percent === null ? 'Memproses…' : `Mengunggah ${percent}%`}{:else}<FileUp class="size-4" aria-hidden="true" />Unggah dan periksa{/if}
			</Button>
		</form>
	</CardContent>
</Card>
