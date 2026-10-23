<script lang="ts">
	import { CourseCards } from '#lib/features/dashboard/components/index.ts';
	import PageHeader from '#lib/shared/ui/PageHeader.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Kelas saya · OBE Teknik Biomedis</title></svelte:head>

<PageHeader title="Kelas saya" description={data.semester ? `Kelas yang ditugaskan kepada Anda pada ${data.semester.name}.` : 'Belum ada semester aktif. Hubungi Super Admin.'} />

<CourseCards rows={data.rows} courseBase="/app/lecturer/courses" importHref="/app/lecturer/import" />
