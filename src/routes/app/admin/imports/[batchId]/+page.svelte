<script lang="ts">
	import { BatchPage } from '#lib/features/imports/components/index.ts';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<BatchPage page={data.page} {form} duplicate={data.duplicate} done={data.done} basePath="/app/admin/imports" />
