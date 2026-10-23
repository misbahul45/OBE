<script lang="ts">
	import { Check } from '@lucide/svelte';

	type StepKey = 'upload' | 'configure' | 'validate' | 'commit';

	let { current }: { current: StepKey } = $props();

	const steps: { key: StepKey; title: string; hint: string }[] = [
		{ key: 'upload', title: 'Unggah', hint: 'Pilih berkas Excel atau CSV berisi nilai kelas.' },
		{ key: 'configure', title: 'Atur sheet', hint: 'Pilih kelas tujuan dan periksa kolom yang terdeteksi.' },
		{ key: 'validate', title: 'Validasi', hint: 'Simulasi lengkap. Tidak ada data yang berubah.' },
		{ key: 'commit', title: 'Simpan', hint: 'Data tersimpan setelah Anda mengonfirmasi.' }
	];
	const currentIndex = $derived(steps.findIndex((step) => step.key === current));
</script>

<ol class="grid gap-2 sm:grid-cols-4" aria-label="Tahapan impor nilai">
	{#each steps as step, index (step.key)}
		{@const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'next'}
		<li class="rounded-md border p-3 {state === 'current' ? 'border-primary bg-primary-soft' : 'bg-card'}" aria-current={state === 'current' ? 'step' : undefined}>
			<p class="flex items-center gap-2 text-sm font-medium">
				<span class="grid size-5 shrink-0 place-items-center rounded-full border text-xs {state === 'done' ? 'border-primary bg-primary text-primary-foreground' : state === 'current' ? 'border-primary text-primary' : 'text-muted-foreground'}" aria-hidden="true">
					{#if state === 'done'}<Check class="size-3" />{:else}{index + 1}{/if}
				</span>
				<span>{step.title}</span>
				<span class="sr-only">{state === 'done' ? '(selesai)' : state === 'current' ? '(langkah saat ini)' : '(berikutnya)'}</span>
			</p>
			<p class="mt-1 text-xs {state === 'current' ? 'text-secondary-foreground' : 'text-muted-foreground'}">{step.hint}</p>
		</li>
	{/each}
</ol>
