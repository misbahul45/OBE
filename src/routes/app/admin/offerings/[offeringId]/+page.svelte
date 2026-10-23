<script lang="ts">
	import { OfferingPage } from '#lib/features/dashboard/components/index.ts';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<OfferingPage analytics={data.analytics} roster={data.roster} components={data.components} cpmkOptions={data.cpmkOptions} {form} importHref="/app/admin/imports" backHref="/app/admin/offerings" />
