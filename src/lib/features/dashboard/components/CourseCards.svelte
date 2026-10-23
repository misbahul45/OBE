<script lang="ts">
	import { FileUp } from '@lucide/svelte';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Card, CardContent, CardHeader, CardTitle } from '#lib/components/ui/card/index.ts';
	import { formatValue } from '#lib/shared/charts/index.ts';
	import EmptyState from '#lib/shared/ui/EmptyState.svelte';
	import StatusBadge from '#lib/shared/ui/StatusBadge.svelte';
	import type { CourseSummary } from '../dashboard.types.ts';

	let { rows, courseBase, importHref }: { rows: CourseSummary[]; courseBase: string; importHref: string } = $props();

	const weightLabel = { ok: 'Bobot 100%', incomplete: 'Bobot belum lengkap', mismatch: 'Bobot tidak 100%', none: 'Belum ada komponen' } as const;
	const weightTone = { ok: 'success', incomplete: 'warning', mismatch: 'warning', none: 'neutral' } as const;
</script>

{#if rows.length === 0}
	<EmptyState title="Belum ada kelas" description="Kelas yang ditugaskan kepada Anda pada semester aktif akan muncul di sini. Bila seharusnya sudah ada, hubungi Super Admin untuk memeriksa penugasan dan semester aktif." />
{:else}
	<ul class="grid gap-4 lg:grid-cols-2">
		{#each rows as row (row.offeringId)}
			<li>
				<Card class="h-full" data-offering={row.offeringId}>
					<CardHeader>
						<CardTitle>
							<h3 class="text-base font-semibold">{row.courseName}</h3>
							<p class="mt-0.5 text-sm font-normal text-muted-foreground">{row.courseCode} · Kelas {row.section} · {row.credits} SKS</p>
						</CardTitle>
					</CardHeader>
					<CardContent class="space-y-4">
						<div class="flex flex-wrap gap-2">
							<StatusBadge status="neutral" label={`${row.students} mahasiswa`} />
							<StatusBadge status={weightTone[row.weightsState]} label={weightLabel[row.weightsState]} />
							{#if row.finalMean !== null}<StatusBadge status="info" label={`Rata-rata akhir ${formatValue(row.finalMean)}`} />{/if}
						</div>
						{#if row.cpmk.length}
							<ul class="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Rata-rata CPMK">
								{#each row.cpmk as cpmk (cpmk.code)}
									<li><span class="font-medium">{cpmk.code}</span> <span class="tabular-nums">{formatValue(cpmk.mean)}</span>{#if cpmk.meetsClassRatio === false}<span class="ml-1 text-status-warning">· di bawah rasio</span>{/if}</li>
								{/each}
							</ul>
						{/if}
						{#if row.warnings.length}
							<ul class="space-y-1 text-sm text-status-warning">
								{#each row.warnings.slice(0, 2) as warning (warning)}<li>{warning}</li>{/each}
								{#if row.warnings.length > 2}<li class="text-muted-foreground">dan {row.warnings.length - 2} catatan lain</li>{/if}
							</ul>
						{/if}
						<div class="flex flex-wrap gap-2">
							<Button size="sm" href={`${courseBase}/${row.offeringId}`}>Buka kelas</Button>
							<Button size="sm" variant="outline" href={importHref} class="gap-1.5"><FileUp class="size-4" aria-hidden="true" />Impor nilai</Button>
						</div>
					</CardContent>
				</Card>
			</li>
		{/each}
	</ul>
{/if}
