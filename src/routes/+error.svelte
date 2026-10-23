<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '#lib/components/ui/button/index.ts';

	const copy: Record<number, { title: string; body: string }> = {
		401: { title: 'Perlu masuk', body: 'Sesi Anda tidak ditemukan atau sudah berakhir. Silakan masuk kembali.' },
		403: { title: 'Akses ditolak', body: 'Anda tidak memiliki izin untuk membuka halaman ini.' },
		404: { title: 'Halaman tidak ditemukan', body: 'Halaman yang Anda cari tidak ada atau Anda tidak berhak melihatnya.' },
		429: { title: 'Terlalu banyak permintaan', body: 'Coba lagi beberapa saat lagi.' }
	};

	const status = $derived(page.status);
	const message = $derived(copy[status] ?? { title: 'Terjadi kesalahan', body: 'Permintaan tidak dapat diproses. Coba lagi beberapa saat.' });
</script>

<svelte:head>
	<title>{status} · {message.title}</title>
</svelte:head>

<main class="grid min-h-svh place-items-center px-4">
	<div class="max-w-md space-y-4 text-center">
		<p class="text-5xl font-semibold tabular-nums text-primary" aria-hidden="true">{status}</p>
		<h1 class="text-2xl font-semibold tracking-tight">{message.title}</h1>
		<p class="text-muted-foreground">{message.body}</p>
		<div class="flex justify-center gap-3 pt-2">
			{#if status === 401}
				<Button href="/login">Masuk</Button>
			{:else}
				<Button href="/app" variant="default">Kembali ke beranda</Button>
			{/if}
		</div>
	</div>
</main>
