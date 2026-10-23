<script lang="ts">
	import LandingPage from '#lib/features/landing/components/LandingPage.svelte';
	import { landingCopy } from '#lib/features/landing/landing.copy.ts';
</script>

<svelte:head>
	<title>{landingCopy.brand}</title>
	<meta name="description" content={landingCopy.subtitle} />
</svelte:head>

<LandingPage />
