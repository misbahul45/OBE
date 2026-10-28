<script lang="ts">
	import { enhance } from '$app/forms';
	import { FileDown, FileUp } from '@lucide/svelte';
	import { Alert, AlertDescription } from '#lib/components/ui/alert/index.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Card, CardContent, CardHeader, CardTitle } from '#lib/components/ui/card/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#lib/components/ui/table/index.ts';
	import { BarChart, Dumbbell, Histogram, LinkMatrix, RadarChart, StackedShare, TraceFlow, formatValue } from '#lib/shared/charts/index.ts';
	import { componentTypes } from '#lib/features/curriculum/index.ts';
	import { componentTypeLabel } from '#lib/features/imports/index.ts';
	import type { OfferingAnalytics, RosterRow } from '#lib/features/outcomes/index.ts';
	import type { FormState } from '#lib/shared/http/form-state.ts';
	import ConfirmForm from '#lib/shared/ui/ConfirmForm.svelte';
	import EmptyState from '#lib/shared/ui/EmptyState.svelte';
	import Field from '#lib/shared/ui/Field.svelte';
	import FormMessage from '#lib/shared/ui/FormMessage.svelte';
	import NativeSelect from '#lib/shared/ui/NativeSelect.svelte';
	import PageHeader from '#lib/shared/ui/PageHeader.svelte';
	import StatusBadge from '#lib/shared/ui/StatusBadge.svelte';
	import ComponentEditor from './ComponentEditor.svelte';

	type Component = { id: string; code: string; name: string; type: string; weightPercent: number | null; maxScore: number; isRequired: boolean; cpmkMappings: { cpmkId: string; coefficient: number }[] };
	type PageForm = (NonNullable<FormState> & { component?: string }) | null | undefined;

	let {
		analytics,
		roster,
		components,
		cpmkOptions,
		form,
		importHref,
		backHref
	}: { analytics: OfferingAnalytics; roster: RosterRow[]; components: Component[]; cpmkOptions: { id: string; code: string }[]; form: PageForm; importHref: string; backHref: string } = $props();

	const o = $derived(analytics.offering);
	const stamp = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
	const typeOptions = componentTypes.map((value) => ({ value, label: componentTypeLabel[value] }));
	const distinctTargets = $derived([...new Set(analytics.cpl.map((c) => c.target).filter((t): t is number => t !== null))]);
	const thresholdText = $derived(analytics.thresholds.studentScore === null ? 'Ambang ketercapaian belum dikonfigurasi.' : `Garis merah menandai ambang ${formatValue(analytics.thresholds.studentScore)} (${analytics.thresholds.source === 'excel' ? 'dari berkas Excel' : 'dari kebijakan OBE'}).`);
	const toShare = (stat: (typeof analytics.cpmk)[number]) => ({ label: stat.code, achieved: stat.distribution.achieved, notAchieved: stat.distribution.notAchieved, insufficient: stat.distribution.insufficient + stat.distribution.unconfigured, ratio: stat.distribution.ratioAchieved, meets: stat.meetsClassRatio });
	const cpmkShares = $derived(analytics.cpmk.map(toShare));
	const cplShares = $derived(analytics.cpl.map(toShare));
	const reachedCount = (stats: typeof analytics.cpmk) => stats.filter((s) => s.meetsClassRatio === true).length;
	const judgedCount = (stats: typeof analytics.cpmk) => stats.filter((s) => s.meetsClassRatio !== null).length;
	const basisLabel = { calculated: 'Hitung sistem', imported_reference: 'Kolom Excel' } as const;
	const comparisons = $derived([...analytics.cpmk, ...analytics.cpl].filter((s) => s.basis === 'calculated' && s.reference !== null).map((s) => ({ label: s.code, first: s.reference!.mean, second: s.mean })));
	const trace = $derived(analytics.trace);
	const componentRows = $derived(trace ? trace.nodes.filter((n) => n.column === 0) : []);
	const cpmkNodes = $derived(trace ? trace.nodes.filter((n) => n.column === 1) : []);
	const cplNodes = $derived(trace ? trace.nodes.filter((n) => n.column === 2) : []);
	const weightOf = (from: string, to: string) => trace?.links.find((l) => l.from === from && l.to === to)?.display ?? null;
	const generalMessage = $derived(form && !form.component ? form : null);

</script>

<svelte:head><title>{o.courseName} · Kelas {o.section}</title></svelte:head>

<PageHeader title={o.courseName} description={`${o.courseCode} · Kelas ${o.section} · ${o.credits} SKS · ${o.semesterName}`}>
	{#snippet actions()}
		<Button variant="outline" href={backHref}>Kembali</Button>
		<Button variant="outline" href={importHref} class="gap-1.5"><FileUp class="size-4" aria-hidden="true" />Impor nilai</Button>
		<Button variant="outline" href={`${backHref}/${o.id}/report.pdf`} download class="gap-1.5"><FileDown class="size-4" aria-hidden="true" />Laporan PDF</Button>
		<ConfirmForm action="?/recompute" triggerLabel="Hitung ulang hasil" title="Hitung ulang hasil CPMK dan CPL?" description="Hasil dihitung dari nilai komponen, bobot, dan pemetaan saat ini. Proses ini aman diulang." confirmLabel="Hitung ulang" />
	{/snippet}
</PageHeader>

<div class="mb-4 space-y-3">
	<FormMessage message={generalMessage?.message} success={generalMessage?.success} />
	{#each analytics.warnings as warning (warning)}
		<Alert role="status"><AlertDescription>{warning}</AlertDescription></Alert>
	{/each}
</div>

<dl class="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
	<div class="rounded-md border bg-card p-3"><dt class="text-xs text-muted-foreground">Mahasiswa</dt><dd class="mt-0.5 text-2xl font-semibold tabular-nums">{analytics.studentCount}</dd></div>
	<div class="rounded-md border bg-card p-3">
		<dt class="text-xs text-muted-foreground">Komponen dan bobot</dt>
		<dd class="mt-0.5 text-2xl font-semibold tabular-nums">{analytics.weights.count} <span class="text-sm font-normal text-muted-foreground">· {analytics.weights.total === null ? 'bobot belum lengkap' : `${formatValue(analytics.weights.total, 2)}%`}</span></dd>
	</div>
	<div class="rounded-md border bg-card p-3">
		<dt class="text-xs text-muted-foreground">Rata-rata nilai akhir</dt>
		<dd class="mt-0.5 text-2xl font-semibold tabular-nums">{formatValue(analytics.finalScore.mean)}</dd>
		<dd class="text-xs text-muted-foreground">{analytics.finalScore.complete} lengkap · {analytics.finalScore.incomplete} belum lengkap</dd>
	</div>
	<div class="rounded-md border bg-card p-3">
		<dt class="text-xs text-muted-foreground">CPMK memenuhi rasio kelas</dt>
		<dd class="mt-0.5 text-2xl font-semibold tabular-nums">{reachedCount(analytics.cpmk)} <span class="text-sm font-normal text-muted-foreground">dari {judgedCount(analytics.cpmk)}</span></dd>
		<dd class="text-xs text-muted-foreground">{analytics.thresholds.classRatio === null ? 'rasio kelas belum diatur' : `rasio minimal ${formatValue(analytics.thresholds.classRatio)}%`}</dd>
	</div>
	<div class="rounded-md border bg-card p-3">
		<dt class="text-xs text-muted-foreground">CPL memenuhi rasio kelas</dt>
		<dd class="mt-0.5 text-2xl font-semibold tabular-nums">{reachedCount(analytics.cpl)} <span class="text-sm font-normal text-muted-foreground">dari {judgedCount(analytics.cpl)}</span></dd>
		<dd class="text-xs text-muted-foreground">{analytics.thresholds.studentScore === null ? 'ambang belum diatur' : `ambang nilai ${formatValue(analytics.thresholds.studentScore)}`}</dd>
	</div>
	<div class="rounded-md border bg-card p-3"><dt class="text-xs text-muted-foreground">Terakhir dihitung</dt><dd class="mt-1 text-sm font-medium">{analytics.lastRunAt ? stamp.format(new Date(analytics.lastRunAt)) : 'Belum pernah'}</dd></div>
</dl>

<section aria-labelledby="results-heading" class="mb-10 space-y-4">
	<h2 id="results-heading" class="text-lg font-semibold">Hasil capaian</h2>
	<div class="grid gap-4 xl:grid-cols-2">
		<StackedShare title="Sebaran capaian CPMK" description="Berapa mahasiswa yang mencapai ambang pada tiap CPMK, dan apakah rasionya memenuhi syarat kelas." items={cpmkShares} classRatio={analytics.thresholds.classRatio} emptyText="Belum ada hasil CPMK. Impor berkas Excel yang memuat kolom CPMK atau petakan komponen ke CPMK." />
		<StackedShare title="Sebaran capaian CPL" description="Sebaran mahasiswa yang mencapai ambang pada tiap CPL kelas ini." items={cplShares} classRatio={analytics.thresholds.classRatio} emptyText="Belum ada hasil CPL. Impor berkas Excel yang memuat kolom CPL atau petakan CPMK ke CPL." />
		<RadarChart title="Profil CPL kelas" description="Rata-rata nilai tiap CPL dibandingkan ambangnya." axes={analytics.cpl.map((c) => ({ label: c.code, value: c.mean, target: c.target, note: c.basis ? basisLabel[c.basis] : undefined }))} emptyText="Belum ada hasil CPL." />
		<BarChart title="Rata-rata CPMK kelas" description={thresholdText} items={analytics.cpmk.map((c) => ({ label: c.code, value: c.mean, note: c.basis ? basisLabel[c.basis] : undefined }))} max={100} target={analytics.thresholds.studentScore} targetLabel="Ambang" emptyText="Belum ada hasil CPMK." />
		<Histogram title="Sebaran nilai akhir" description="Jumlah mahasiswa pada tiap rentang nilai akhir (hanya yang nilainya lengkap)." bins={analytics.finalScore.bins} emptyText={analytics.finalScore.notConfigured ? 'Nilai akhir belum dapat dihitung karena bobot komponen belum lengkap atau tidak berjumlah 100%.' : 'Belum ada nilai akhir yang lengkap.'} />
		<BarChart title="Rata-rata per komponen" description="Nilai dinormalisasi ke skala 0–100." items={analytics.components.map((c) => ({ label: c.code, value: c.mean, note: `${c.scored} nilai, ${c.blank} kosong` }))} max={100} emptyText="Belum ada komponen penilaian." />
		{#if comparisons.length}
			<Dumbbell title="Nilai Excel dibanding hitung sistem" description="Selisih rata-rata kelas antara kolom CPMK/CPL pada Excel dan hasil hitung sistem." items={comparisons} />
		{/if}
	</div>

	{#each [{ id: 'cpmk', label: 'CPMK', rows: analytics.cpmk }, { id: 'cpl', label: 'CPL', rows: analytics.cpl }] as group (group.id)}
		{#if group.rows.length}
			<Card>
				<CardHeader><CardTitle><h3 class="text-base font-semibold">Ketercapaian {group.label}</h3></CardTitle></CardHeader>
				<CardContent class="overflow-x-auto">
					<Table>
						<TableHeader>
							<TableRow><TableHead>{group.label}</TableHead><TableHead class="text-right">Rata-rata</TableHead><TableHead class="text-right">Ambang</TableHead><TableHead class="text-right">Tercapai</TableHead><TableHead class="text-right">Belum</TableHead><TableHead class="text-right">Data kurang</TableHead><TableHead class="text-right">Rasio</TableHead><TableHead>Status kelas</TableHead><TableHead>Sumber nilai</TableHead></TableRow>
						</TableHeader>
						<TableBody>
							{#each group.rows as row (row.id)}
								<TableRow>
									<TableCell class="font-medium">{row.code}</TableCell>
									<TableCell class="text-right tabular-nums">{formatValue(row.mean)}</TableCell>
									<TableCell class="text-right tabular-nums">{formatValue(row.target)}{#if row.targetSource === 'excel'}<span class="text-xs text-muted-foreground"> (Excel)</span>{/if}</TableCell>
									<TableCell class="text-right tabular-nums">{row.distribution.achieved}</TableCell>
									<TableCell class="text-right tabular-nums">{row.distribution.notAchieved}</TableCell>
									<TableCell class="text-right tabular-nums">{row.distribution.insufficient}</TableCell>
									<TableCell class="text-right tabular-nums">{row.distribution.ratioAchieved === null ? '—' : `${formatValue(row.distribution.ratioAchieved)}%`}</TableCell>
									<TableCell>
										{#if row.target === null}<StatusBadge status="neutral" label="Ambang belum diatur" />
										{:else if row.meetsClassRatio === null}<StatusBadge status="neutral" label="Rasio kelas belum diatur" />
										{:else if row.meetsClassRatio}<StatusBadge status="success" label="Memenuhi rasio kelas" />
										{:else}<StatusBadge status="warning" label="Di bawah rasio kelas" />{/if}
									</TableCell>
									<TableCell class="text-xs">
										{#if row.basis}{basisLabel[row.basis]}{:else}<span class="text-muted-foreground">Belum ada</span>{/if}
										{#if row.reference && row.basis === 'calculated'}<span class="text-muted-foreground"> · {row.reference.differing} berbeda dari Excel</span>{/if}
									</TableCell>
								</TableRow>
							{/each}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		{/if}
	{/each}
</section>

<section aria-labelledby="trace-heading" class="mb-10 space-y-4">
	<h2 id="trace-heading" class="text-lg font-semibold">Jejak capaian: komponen, CPMK, CPL</h2>
	{#if trace}
		<TraceFlow title="Dari komponen penilaian ke CPL" description="Arahkan penunjuk atau fokuskan satu simpul untuk menyorot jalurnya. Warna simpul menunjukkan apakah rasio kelas terpenuhi." nodes={trace.nodes} links={trace.links} sourceLabel={`${trace.source.fileName}, sheet ${trace.source.sheetName}`} />
		<div class="grid gap-4 xl:grid-cols-2">
			<LinkMatrix title="Koefisien komponen terhadap CPMK" description="Baris adalah CPMK, kolom adalah komponen penilaian." rows={cpmkNodes.map((n) => n.code)} columns={componentRows.map((n) => n.code)} cells={cpmkNodes.map((m) => componentRows.map((k) => weightOf(k.id, m.id)))} digits={2} />
			<LinkMatrix title="Bobot CPMK terhadap CPL" description="Baris adalah CPL, kolom adalah CPMK. Bobot yang lebih besar berarti kontribusi CPMK pada CPL lebih besar." rows={cplNodes.map((n) => n.code)} columns={cpmkNodes.map((n) => n.code)} cells={cplNodes.map((l) => cpmkNodes.map((m) => weightOf(m.id, l.id)))} digits={2} />
		</div>
	{:else}
		<EmptyState title="Jejak belum tersedia" description="Jejak dibaca dari matriks CPMK dan CPL pada sheet Excel. Impor berkas nilai kelas ini (atau impor ulang berkas yang sama) agar matriksnya tersimpan." actionLabel="Impor nilai" actionHref={importHref} />
	{/if}
</section>

<section aria-labelledby="components-heading" class="mb-10 space-y-4">
	<h2 id="components-heading" class="text-lg font-semibold">Komponen penilaian dan pemetaan CPMK</h2>
	{#each components as component (component.id)}
		<ComponentEditor {component} {cpmkOptions} {form} />
	{:else}
		<EmptyState title="Belum ada komponen" description="Komponen terbentuk otomatis saat nilai diimpor, atau tambahkan secara manual di bawah." />
	{/each}

	<Card>
		<CardHeader><CardTitle><h3 class="text-base font-semibold">Tambah komponen</h3></CardTitle></CardHeader>
		<CardContent>
			<form method="POST" action="?/saveComponent" use:enhance class="grid gap-3 md:grid-cols-6">
				<Field id="new-code" label="Kode"><Input id="new-code" name="code" required placeholder="TUGAS1" /></Field>
				<div class="md:col-span-2"><Field id="new-name" label="Nama"><Input id="new-name" name="name" required /></Field></div>
				<Field id="new-type" label="Jenis"><NativeSelect id="new-type" name="type" options={typeOptions} value="lainnya" /></Field>
				<Field id="new-weight" label="Bobot (%)"><Input id="new-weight" name="weightPercent" inputmode="decimal" /></Field>
				<div class="flex items-end gap-3"><input type="hidden" name="maxScore" value="100" /><label class="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="isRequired" checked class="size-4 accent-primary" />Wajib</label><Button type="submit" size="sm">Tambah</Button></div>
			</form>
		</CardContent>
	</Card>
</section>

<section aria-labelledby="roster-heading" class="space-y-3">
	<h2 id="roster-heading" class="text-lg font-semibold">Mahasiswa ({roster.length})</h2>
	{#if roster.length === 0}
		<EmptyState title="Belum ada mahasiswa" description="Mahasiswa terdaftar otomatis saat nilai kelas ini diimpor." />
	{:else}
		<div class="overflow-x-auto rounded-lg border bg-card">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>NIM</TableHead><TableHead>Nama</TableHead><TableHead class="text-right">Nilai akhir</TableHead><TableHead>Status</TableHead>
						{#each analytics.cpmk as cpmk (cpmk.id)}<TableHead class="text-right">{cpmk.code}</TableHead>{/each}
					</TableRow>
				</TableHeader>
				<TableBody>
					{#each roster as row (row.enrollmentId)}
						<TableRow>
							<TableCell class="font-mono text-xs">{row.nim}</TableCell>
							<TableCell><a class="font-medium text-primary underline-offset-4 hover:underline" href={`/app/students/${row.studentId}`}>{row.name}</a></TableCell>
							<TableCell class="text-right tabular-nums">{formatValue(row.finalScore)}</TableCell>
							<TableCell>
								{#if row.status === 'complete'}<StatusBadge status="success" label="Lengkap" />
								{:else if row.status === 'incomplete'}<StatusBadge status="warning" label={`Kurang: ${row.missing.join(', ')}`} />
								{:else}<StatusBadge status="neutral" label="Bobot belum lengkap" />{/if}
							</TableCell>
							{#each analytics.cpmk as cpmk (cpmk.id)}<TableCell class="text-right tabular-nums">{formatValue(row.cpmk[cpmk.id])}</TableCell>{/each}
						</TableRow>
					{/each}
				</TableBody>
			</Table>
		</div>
	{/if}
</section>
