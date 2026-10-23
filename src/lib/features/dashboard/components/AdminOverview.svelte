<script lang="ts">
	import { Alert, AlertDescription } from '#lib/components/ui/alert/index.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Card, CardContent } from '#lib/components/ui/card/index.ts';
	import { BarChart, Heatmap, formatValue } from '#lib/shared/charts/index.ts';
	import type { ProgramAnalytics } from '#lib/features/outcomes/index.ts';
	import EmptyState from '#lib/shared/ui/EmptyState.svelte';
	import StatusBadge from '#lib/shared/ui/StatusBadge.svelte';
	import { batchStatusLabel, batchStatusTone } from '#lib/features/imports/index.ts';
	import type { SetupStep } from '../dashboard.setup.ts';
	import SetupChecklist from './SetupChecklist.svelte';

	type Imports = { id: string; fileName: string; status: string; createdAt: Date }[];

	let { program, imports, setup }: { program: ProgramAnalytics; imports: Imports; setup: SetupStep[] } = $props();

	const stamp = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
	const kpis = $derived([
		{ label: 'Kelas semester aktif', value: program.totals.offerings, definition: 'Jumlah penawaran kelas pada semester aktif.' },
		{ label: 'Dosen bertugas', value: program.totals.lecturers, definition: 'Dosen berbeda yang ditugaskan pada kelas semester aktif.' },
		{ label: 'Mahasiswa', value: program.totals.students, definition: 'Mahasiswa berbeda yang terdaftar pada kelas semester aktif.' },
		{ label: 'Kelas dengan hasil CPL', value: `${program.totals.offeringsWithResults} / ${program.totals.offerings}`, definition: 'Kelas yang sudah memiliki hasil CPL terhitung.' },
		{ label: 'Impor tersimpan', value: program.totals.committedImports, definition: 'Batch impor dengan status tersimpan, seluruh waktu.' },
		{ label: 'Impor belum selesai', value: program.totals.openImports, definition: 'Batch yang diunggah tetapi belum disimpan atau dibatalkan.' }
	]);
	const offeringKeys = $derived(
		[...new Map(program.cpl.flatMap((c) => c.offerings).map((o) => [o.offeringId, `${o.courseCode} · ${o.courseName} (${o.section})`])).entries()]
	);
	const heatmapCells = $derived(offeringKeys.map(([offeringId]) => program.cpl.map((c) => ({ value: c.offerings.find((o) => o.offeringId === offeringId)?.mean ?? null }))));
	const aggregated = $derived(program.cpl.map((c) => ({ label: c.code, value: c.aggregate.value, note: c.aggregate.status === 'not_configured' ? 'agregasi belum diatur' : `${c.aggregate.used} dari ${c.aggregate.entries} kelas` })));
	const distinctTargets = $derived([...new Set(program.cpl.map((c) => c.target).filter((t): t is number => t !== null))]);
	const aggregationLabel = $derived({ not_configured: 'belum diatur', simple_mean: 'rata-rata sederhana antar kelas', credit_weighted_mean: 'rata-rata tertimbang SKS' }[program.policy?.aggregation ?? 'not_configured']);
</script>

<SetupChecklist steps={setup} />

{#if !program.semester}
	<Alert role="status" class="mb-4"><AlertDescription>Belum ada semester aktif. Aktifkan semester pada menu Tahun akademik agar dashboard menampilkan data.</AlertDescription></Alert>
{:else}
	<p class="mb-4 text-sm text-muted-foreground">Semester aktif: <span class="font-medium text-foreground">{program.semester.name}</span></p>
{/if}

<dl class="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
	{#each kpis as kpi (kpi.label)}
		<div class="rounded-md border bg-card p-3">
			<dt class="text-xs text-muted-foreground">{kpi.label}</dt>
			<dd class="mt-0.5 text-2xl font-semibold tabular-nums">{kpi.value}</dd>
			<dd class="mt-1 text-[11px] leading-tight text-muted-foreground">{kpi.definition}</dd>
		</div>
	{/each}
</dl>

<section aria-labelledby="cpl-heading" class="mb-10 space-y-4">
	<h2 id="cpl-heading" class="text-lg font-semibold">Capaian pembelajaran lulusan</h2>
	{#if !program.policy}
		<Alert role="status"><AlertDescription>Belum ada kebijakan OBE aktif. Tetapkan ambang, target, dan metode agregasi pada menu Kurikulum.</AlertDescription></Alert>
	{/if}
	{#if program.cpl.length === 0}
		<EmptyState title="Belum ada hasil CPL" description="Hasil muncul setelah nilai diimpor, komponen dipetakan ke CPMK, dan CPMK dipetakan ke CPL." actionLabel="Impor nilai kelas" actionHref="/app/admin/imports" />
	{:else}
		<Heatmap title="Rata-rata CPL per kelas" description="Setiap sel adalah rata-rata nilai CPL mahasiswa yang datanya lengkap pada kelas tersebut. Kotak bergaris putus-putus berarti belum ada nilai." rows={offeringKeys.map(([, label]) => label)} columns={program.cpl.map((c) => c.code)} cells={heatmapCells} />
		{#if aggregated.some((a) => a.value !== null)}
			<BarChart title="CPL tingkat program" description={`Metode agregasi antar kelas: ${aggregationLabel}.`} items={aggregated} max={100} target={distinctTargets.length === 1 ? distinctTargets[0] : null} targetLabel="Target" emptyText="Belum ada data CPL." />
		{:else}
			<Alert role="status"><AlertDescription>Metode agregasi CPL antar kelas belum diatur pada kebijakan aktif, sehingga angka tingkat program tidak ditampilkan agar tidak menyesatkan. Peta panas di atas tetap menunjukkan capaian per kelas.</AlertDescription></Alert>
		{/if}
	{/if}
</section>

<div class="grid gap-6 lg:grid-cols-2">
	<section aria-labelledby="attention-heading">
		<h2 id="attention-heading" class="mb-3 text-lg font-semibold">Perlu perhatian</h2>
		{#if program.attention.length === 0}
			<EmptyState title="Tidak ada kelas bermasalah" description="Semua kelas semester aktif memiliki dosen, nilai, dan hasil CPL." />
		{:else}
			<ul class="space-y-2">
				{#each program.attention as item (item.offeringId)}
					<li class="rounded-md border bg-card p-3 text-sm"><a class="font-medium text-primary underline-offset-4 hover:underline" href={`/app/admin/offerings/${item.offeringId}`}>{item.label}</a><p class="text-muted-foreground">{item.reason}</p></li>
				{/each}
			</ul>
		{/if}
	</section>

	<section aria-labelledby="imports-heading">
		<div class="mb-3 flex items-center justify-between"><h2 id="imports-heading" class="text-lg font-semibold">Impor terbaru</h2><Button variant="outline" size="sm" href="/app/admin/imports">Semua impor</Button></div>
		{#if imports.length === 0}
			<EmptyState title="Belum ada impor" description="Unggah berkas nilai untuk mulai mengisi data." actionLabel="Impor nilai kelas" actionHref="/app/admin/imports" />
		{:else}
			<Card>
				<CardContent class="p-0">
					<ul class="divide-y">
						{#each imports as batch (batch.id)}
							<li class="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
								<a class="max-w-60 truncate font-medium text-primary underline-offset-4 hover:underline" href={`/app/admin/imports/${batch.id}`} title={batch.fileName}>{batch.fileName}</a>
								<span class="flex items-center gap-2"><span class="text-xs text-muted-foreground">{stamp.format(new Date(batch.createdAt))}</span><StatusBadge status={batchStatusTone[batch.status] ?? 'neutral'} label={batchStatusLabel[batch.status] ?? batch.status} /></span>
							</li>
						{/each}
					</ul>
				</CardContent>
			</Card>
		{/if}
	</section>
</div>
