<script lang="ts">
	import { StudentProfileView } from '#lib/features/students/components/index.ts';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<StudentProfileView profile={data.profile} backHref={data.backHref} />
