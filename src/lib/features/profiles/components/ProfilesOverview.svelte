<script lang="ts">
	import { Check, TriangleAlert } from '@lucide/svelte';
	import { Alert, AlertDescription, AlertTitle } from '#lib/components/ui/alert/index.ts';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#lib/components/ui/card/index.ts';
	import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#lib/components/ui/table/index.ts';
	import CodeChips from '#lib/shared/ui/CodeChips.svelte';
	import EmptyState from '#lib/shared/ui/EmptyState.svelte';
	import { relevanceLabels } from '../profiles.blueprint.ts';
	import type { ProgramBlueprintView } from '../profiles.types.ts';

	let { blueprint }: { blueprint: ProgramBlueprintView } = $props();
</script>

{#if blueprint.profiles.length === 0}
	<EmptyState
		title="Profil lulusan belum dimuat"
		description="Jalankan `bun run seed:curriculum` untuk memuat 4 profil lulusan, 7 bidang kerja, dan pemetaannya ke CPL dari dokumen kurikulum. Perintah ini aman diulang."
		actionLabel="Buka CPL dan CPMK"
		actionHref="/app/admin/curriculum"
	/>
{:else}
	{#if blueprint.unmappedCpl.length}
		<Alert role="status" class="mb-6">
			<TriangleAlert aria-hidden="true" />
			<AlertTitle>{blueprint.unmappedCpl.join(', ')} belum terkait dengan profil lulusan</AlertTitle>
			<AlertDescription>CPL ini tidak ikut membentuk kesesuaian profil lulusan. Periksa apakah ini disengaja pada dokumen kurikulum.</AlertDescription>
		</Alert>
	{/if}

	<section aria-labelledby="profiles-heading" class="mb-10 space-y-4">
		<div>
			<h2 id="profiles-heading" class="text-lg font-semibold">Profil lulusan</h2>
			<p class="text-sm text-muted-foreground">Peran yang disiapkan program studi. Setiap profil dibentuk oleh CPL kunci dan mengarah ke bidang kerja.</p>
		</div>
		<div class="grid gap-4 md:grid-cols-2">
			{#each blueprint.profiles as profile (profile.id)}
				<Card>
					<CardHeader>
						<CardTitle>
							<h3 class="text-base font-semibold"><span class="mr-2 font-mono text-sm text-muted-foreground">{profile.code}</span>{profile.name}</h3>
						</CardTitle>
						{#if profile.summary}<CardDescription>{profile.summary}</CardDescription>{/if}
					</CardHeader>
					<CardContent class="space-y-4 text-sm">
						{#if profile.creditEstimate}<p><span class="text-muted-foreground">Estimasi beban studi:</span> {profile.creditEstimate}</p>{/if}
						<div>
							<p class="mb-1 font-medium">CPL kunci</p>
							{#if profile.cpl.length}
								<ul class="space-y-1">
									{#each profile.cpl as cpl (cpl.code)}<li><span class="font-mono">{cpl.code}</span> <span class="text-muted-foreground">{cpl.title}</span></li>{/each}
								</ul>
							{:else}
								<p class="text-muted-foreground">Belum ada CPL yang dihubungkan.</p>
							{/if}
						</div>
						<div>
							<p class="mb-1 font-medium">Bidang kerja</p>
							{#if profile.fields.length}
								<ul class="space-y-1">
									{#each profile.fields as field (field.code)}
										<li><span class="font-mono">{field.code}</span> {field.name} <span class="text-muted-foreground">({relevanceLabels[field.relevance]})</span></li>
									{/each}
								</ul>
							{:else}
								<p class="text-muted-foreground">Belum ada bidang kerja.</p>
							{/if}
						</div>
					</CardContent>
				</Card>
			{/each}
		</div>
	</section>

	<section aria-labelledby="matrix-heading" class="mb-10 space-y-3">
		<div>
			<h2 id="matrix-heading" class="text-lg font-semibold">Matriks CPL dan profil lulusan</h2>
			<p class="text-sm text-muted-foreground">Tanda centang berarti CPL itu membentuk profil. Kolom WA dan WK menunjukkan atribut lulusan dan profil pengetahuan standar akreditasi untuk CPL tersebut.</p>
		</div>
		<div class="overflow-x-auto rounded-lg border bg-card">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>CPL</TableHead>
						{#each blueprint.profiles as profile (profile.id)}<TableHead class="text-center" title={profile.name}>{profile.code}</TableHead>{/each}
						<TableHead>WA</TableHead>
						<TableHead>WK</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{#each blueprint.cpl as row (row.id)}
						<TableRow>
							<TableCell class="min-w-72 whitespace-normal"><span class="font-mono text-sm">{row.code}</span> <span class="text-muted-foreground">{row.title}</span></TableCell>
							{#each blueprint.profiles as profile (profile.id)}
								<TableCell class="text-center">
									{#if row.profileCodes.includes(profile.code)}
										<Check class="mx-auto size-4 text-primary" aria-hidden="true" /><span class="sr-only">Terkait</span>
									{:else}
										<span aria-hidden="true" class="text-muted-foreground">–</span><span class="sr-only">Tidak terkait</span>
									{/if}
								</TableCell>
							{/each}
							<TableCell><CodeChips codes={row.graduateAttributes} kind="WA" label={`Atribut lulusan ${row.code}`} /></TableCell>
							<TableCell><CodeChips codes={row.knowledgeProfiles} kind="WK" label={`Profil pengetahuan ${row.code}`} /></TableCell>
						</TableRow>
					{/each}
				</TableBody>
			</Table>
		</div>
	</section>

	<section aria-labelledby="fields-heading" class="space-y-3">
		<div>
			<h2 id="fields-heading" class="text-lg font-semibold">Bidang kerja</h2>
			<p class="text-sm text-muted-foreground">Profil utama adalah jalur langsung menuju bidang kerja; profil pendukung memberi keterampilan tambahan.</p>
		</div>
		<div class="overflow-x-auto rounded-lg border bg-card">
			<Table>
				<TableHeader><TableRow><TableHead>Kode</TableHead><TableHead>Bidang kerja</TableHead><TableHead>Profil utama</TableHead><TableHead>Profil pendukung</TableHead></TableRow></TableHeader>
				<TableBody>
					{#each blueprint.fields as field (field.id)}
						{@const primary = field.profiles.filter((p) => p.relevance === 3)}
						{@const supporting = field.profiles.filter((p) => p.relevance < 3)}
						<TableRow>
							<TableCell class="font-mono text-sm">{field.code}</TableCell>
							<TableCell class="whitespace-normal font-medium">{field.name}</TableCell>
							<TableCell class="whitespace-normal">{primary.map((p) => `${p.code} ${p.name}`).join(', ') || '–'}</TableCell>
							<TableCell class="whitespace-normal text-muted-foreground">{supporting.map((p) => `${p.code} ${p.name}`).join(', ') || '–'}</TableCell>
						</TableRow>
					{/each}
				</TableBody>
			</Table>
		</div>
	</section>
{/if}
