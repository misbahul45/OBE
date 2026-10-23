<script lang="ts">
	import { glossaryGroups } from '#lib/shared/help/glossary.ts';
	import { graduateAttributeNames, knowledgeProfileNames } from '#lib/shared/help/accreditation-codes.ts';
	import PageHeader from '#lib/shared/ui/PageHeader.svelte';
</script>

<svelte:head><title>Panduan istilah · OBE Teknik Biomedis</title></svelte:head>

<PageHeader title="Panduan istilah" description="Arti istilah dan singkatan yang dipakai di seluruh aplikasi, dikelompokkan menurut alur kerja." />

<nav aria-label="Kelompok istilah" class="mb-8 flex flex-wrap gap-2">
	{#each glossaryGroups as group (group.id)}
		<a href={`#kelompok-${group.id}`} class="rounded-full border px-3 py-1 text-sm hover:bg-primary-soft">{group.title}</a>
	{/each}
	<a href="#kode-akreditasi" class="rounded-full border px-3 py-1 text-sm hover:bg-primary-soft">Kode WA dan WK</a>
</nav>

<div class="space-y-10">
	{#each glossaryGroups as group (group.id)}
		<section id={`kelompok-${group.id}`} aria-labelledby={`judul-${group.id}`} class="scroll-mt-20">
			<h2 id={`judul-${group.id}`} class="mb-3 text-lg font-semibold">{group.title}</h2>
			<dl class="grid gap-3 md:grid-cols-2">
				{#each group.entries as entry (entry.id)}
					<div id={entry.id} class="scroll-mt-20 rounded-lg border bg-card p-4">
						<dt class="font-semibold">{entry.term} <span class="font-normal text-muted-foreground">· {entry.expansion}</span></dt>
						<dd class="mt-1 text-sm text-muted-foreground">{entry.meaning}</dd>
					</div>
				{/each}
			</dl>
		</section>
	{/each}

	<section id="kode-akreditasi" aria-labelledby="judul-kode" class="scroll-mt-20">
		<h2 id="judul-kode" class="mb-1 text-lg font-semibold">Kode WA dan WK</h2>
		<p class="mb-3 text-sm text-muted-foreground">Nama baku mengikuti Washington Accord dan IABEE.</p>
		<div class="grid gap-4 md:grid-cols-2">
			<div class="rounded-lg border bg-card p-4">
				<h3 class="mb-2 text-sm font-semibold">Atribut lulusan (WA)</h3>
				<ul class="space-y-1 text-sm">{#each Object.entries(graduateAttributeNames) as [code, name] (code)}<li><span class="font-mono">{code}</span> <span class="text-muted-foreground">{name}</span></li>{/each}</ul>
			</div>
			<div class="rounded-lg border bg-card p-4">
				<h3 class="mb-2 text-sm font-semibold">Profil pengetahuan (WK)</h3>
				<ul class="space-y-1 text-sm">{#each Object.entries(knowledgeProfileNames) as [code, name] (code)}<li><span class="font-mono">{code}</span> <span class="text-muted-foreground">{name}</span></li>{/each}</ul>
			</div>
		</div>
	</section>
</div>
