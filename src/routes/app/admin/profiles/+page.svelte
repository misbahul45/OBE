<script lang="ts">
	import { ProfilesOverview } from '#lib/features/profiles/components/index.ts';
	import PageHeader from '#lib/shared/ui/PageHeader.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Profil lulusan · OBE Teknik Biomedis</title></svelte:head>

<PageHeader title="Profil lulusan dan bidang kerja" description="Hubungan antara CPL, profil lulusan, dan bidang kerja program studi. Halaman ini hanya menampilkan data kurikulum." />

<ProfilesOverview blueprint={data.blueprint} />
