<script lang="ts">
	import ProfileView from '#lib/features/auth/components/ProfileView.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Profil akun · OBE Teknik Biomedis</title>
</svelte:head>

<ProfileView profile={data.profile} {form} />
