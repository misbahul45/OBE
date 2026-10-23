<script lang="ts">
	import { FindingDetail } from '#lib/features/cqi/components/index.ts';
	import type { FormState } from '#lib/shared/http/form-state.ts';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<FindingDetail detail={data.detail} pics={data.pics} form={form as FormState} backHref="/app/admin/cqi" />
