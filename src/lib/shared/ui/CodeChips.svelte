<script lang="ts">
	import { graduateAttributeNames, knowledgeProfileNames } from '#lib/shared/help/accreditation-codes.ts';

	let { codes, kind, label }: { codes: string[]; kind: 'WA' | 'WK'; label: string } = $props();

	const names = $derived(kind === 'WA' ? graduateAttributeNames : knowledgeProfileNames);
</script>

{#if codes.length}
	<ul class="flex flex-wrap gap-1" aria-label={label}>
		{#each codes as code (code)}
			<li><a href={`/app/help#${kind.toLowerCase()}`} title={names[code] ?? code} class="inline-block rounded-md border bg-secondary px-1.5 py-0.5 font-mono text-xs text-secondary-foreground hover:bg-primary-soft">{code}</a></li>
		{/each}
	</ul>
{:else}
	<span class="text-xs text-muted-foreground">Belum diisi</span>
{/if}
