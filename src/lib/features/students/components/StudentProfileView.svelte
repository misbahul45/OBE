<script lang="ts">
	import { FileDown } from '@lucide/svelte';
	import { Alert, AlertDescription } from '#lib/components/ui/alert/index.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#lib/components/ui/table/index.ts';
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '#lib/components/ui/tabs/index.ts';
	import { BarChart, LineChart, formatValue } from '#lib/shared/charts/index.ts';
	import EmptyState from '#lib/shared/ui/EmptyState.svelte';
	import PageHeader from '#lib/shared/ui/PageHeader.svelte';
	import StatusBadge from '#lib/shared/ui/StatusBadge.svelte';
	import type { StudentProfile } from '../students.types.ts';

	let { profile, backHref }: { profile: StudentProfile; backHref: string } = $props();

	const stamp = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
	const achievementLabel = { tercapai: 'Tercapai', belum_tercapai: 'Belum tercapai', belum_cukup_data: 'Data belum cukup', target_belum_dikonfigurasi: 'Target belum diatur' } as const;
	const achievementTone = { tercapai: 'success', belum_tercapai: 'warning', belum_cukup_data: 'neutral', target_belum_dikonfigurasi: 'neutral' } as const;
	const changeLabel = { import_initial: 'Impor awal', import_update: 'Pembaruan impor', manual_correction: 'Koreksi manual' } as const;
	const aggregationLabel = $derived({ not_configured: 'belum diatur', simple_mean: 'rata-rata sederhana antar mata kuliah', credit_weighted_mean: 'rata-rata tertimbang SKS' }[profile.policy?.aggregation ?? 'not_configured'] ?? 'belum diatur');
	const hasAggregate = $derived(profile.cplSummary.some((c) => c.aggregate.value !== null));
	const distinctTargets = $derived([...new Set(profile.cplSummary.map((c) => c.target).filter((t): t is number => t !== null))]);
</script>

<svelte:head><title>{profile.student.name} · Profil mahasiswa</title></svelte:head>

<PageHeader title={profile.student.name} description={`NIM ${profile.student.nim}${profile.student.cohortYear ? ` · Angkatan ${profile.student.cohortYear}` : ''}`}>
	{#snippet actions()}
		<Button variant="outline" href={backHref}>Kembali</Button>
		<Button variant="outline" href={`/app/students/${profile.student.id}/transcript.pdf`} download class="gap-1.5"><FileDown class="size-4" aria-hidden="true" />Unduh transkrip PDF</Button>
	{/snippet}
</PageHeader>

{#if profile.scopeLimited}
	<div class="mb-4">
		<Alert role="status"><AlertDescription>Anda melihat hasil dari kelas yang Anda ampu saja. Riwayat di kelas lain hanya tampil bagi Super Admin.</AlertDescription></Alert>
	</div>
{/if}

<Tabs value="ringkasan">
	<TabsList>
		<TabsTrigger value="ringkasan">Ringkasan</TabsTrigger>
		<TabsTrigger value="riwayat">Mata kuliah ({profile.enrollments.length})</TabsTrigger>
		<TabsTrigger value="revisi">Riwayat perubahan ({profile.revisions.length})</TabsTrigger>
	</TabsList>

	<TabsContent value="ringkasan" class="mt-4 space-y-4">
		{#if profile.enrollments.length === 0}
			<EmptyState title="Belum ada riwayat" description="Mahasiswa ini belum memiliki kelas pada cakupan Anda." />
		{:else}
			<LineChart title="Rata-rata nilai akhir per semester" description="Hanya mata kuliah dengan nilai akhir lengkap yang dihitung." categories={profile.semesters.map((s) => s.name)} series={[{ name: 'Rata-rata nilai akhir', values: profile.semesters.map((s) => s.mean) }]} max={100} emptyText="Belum ada nilai akhir yang lengkap." />
			{#if hasAggregate}
				<BarChart
					title="CPL lintas mata kuliah"
					description={`Metode agregasi: ${aggregationLabel}.`}
					items={profile.cplSummary.map((c) => ({ label: c.code, value: c.aggregate.value, note: `${c.aggregate.used} dari ${c.aggregate.entries} mata kuliah` }))}
					max={100}
					target={distinctTargets.length === 1 ? distinctTargets[0] : null}
					targetLabel="Target"
				/>
			{:else if profile.cplSummary.length}
				<Alert role="status"><AlertDescription>Metode agregasi CPL antar mata kuliah belum diatur pada kebijakan aktif, sehingga angka gabungan tidak ditampilkan. Rincian per mata kuliah ada di tabel berikut.</AlertDescription></Alert>
			{/if}
			{#if profile.cplSummary.length}
				<div class="overflow-x-auto rounded-lg border bg-card">
					<Table>
						<TableHeader><TableRow><TableHead>CPL</TableHead><TableHead>Mata kuliah</TableHead><TableHead>Semester</TableHead><TableHead class="text-right">Nilai</TableHead></TableRow></TableHeader>
						<TableBody>
							{#each profile.cplSummary as cpl (cpl.code)}
								{#each cpl.entries as entry, i (cpl.code + i)}
									<TableRow><TableCell class="font-medium">{cpl.code}</TableCell><TableCell>{entry.courseName}</TableCell><TableCell>{entry.semesterName}</TableCell><TableCell class="text-right tabular-nums">{formatValue(entry.value)}</TableCell></TableRow>
								{/each}
							{/each}
						</TableBody>
					</Table>
				</div>
			{/if}
		{/if}
	</TabsContent>

	<TabsContent value="riwayat" class="mt-4 space-y-3">
		{#each profile.enrollments as enrollment (enrollment.enrollmentId)}
			<details class="rounded-lg border bg-card" data-enrollment={enrollment.courseCode}>
				<summary class="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-3">
					<h3 class="font-medium">{enrollment.courseName}</h3>
					<span class="text-sm text-muted-foreground">{enrollment.courseCode} · Kelas {enrollment.section} · {enrollment.semesterName}</span>
					{#if enrollment.final.status === 'complete'}<StatusBadge status="info" label={`Nilai akhir ${formatValue(enrollment.final.value)}`} />
					{:else if enrollment.final.status === 'incomplete'}<StatusBadge status="warning" label={`Belum lengkap: ${enrollment.final.missing.join(', ')}`} />
					{:else}<StatusBadge status="neutral" label="Nilai akhir belum dikonfigurasi" />{/if}
				</summary>
				<div class="space-y-4 border-t p-4">
					<div class="overflow-x-auto">
						<Table>
							<TableHeader><TableRow><TableHead>Komponen</TableHead><TableHead class="text-right">Bobot</TableHead><TableHead class="text-right">Nilai</TableHead><TableHead class="text-right">Maks</TableHead></TableRow></TableHeader>
							<TableBody>
								{#each enrollment.components as component (component.code)}
									<TableRow>
										<TableCell>{component.name} <span class="font-mono text-xs text-muted-foreground">({component.code})</span></TableCell>
										<TableCell class="text-right tabular-nums">{component.weightPercent === null ? '—' : `${formatValue(component.weightPercent, 2)}%`}</TableCell>
										<TableCell class="text-right tabular-nums">{component.score === null ? 'kosong' : formatValue(component.score, 2)}</TableCell>
										<TableCell class="text-right tabular-nums">{formatValue(component.maxScore, 2)}</TableCell>
									</TableRow>
								{/each}
							</TableBody>
						</Table>
					</div>
					{#each [{ label: 'CPMK', rows: enrollment.cpmk }, { label: 'CPL', rows: enrollment.cpl }] as group (group.label)}
						{#if group.rows.length}
							<div class="overflow-x-auto">
								<Table>
									<TableHeader><TableRow><TableHead>{group.label}</TableHead><TableHead class="text-right">Hasil hitung</TableHead><TableHead class="text-right">Target</TableHead><TableHead>Status</TableHead><TableHead class="text-right">Referensi Excel</TableHead><TableHead>Sumber hasil</TableHead></TableRow></TableHeader>
									<TableBody>
										{#each group.rows as row (row.code)}
											<TableRow>
												<TableCell class="font-medium">{row.code}</TableCell>
												<TableCell class="text-right tabular-nums">{row.value === null ? 'belum lengkap' : formatValue(row.value)}</TableCell>
												<TableCell class="text-right tabular-nums">{formatValue(row.target)}</TableCell>
												<TableCell><StatusBadge status={achievementTone[row.achievement]} label={achievementLabel[row.achievement]} /></TableCell>
												<TableCell class="text-right tabular-nums">{formatValue(row.reference)}</TableCell>
												<TableCell class="text-xs text-muted-foreground">{row.computedAt ? `Dihitung sistem (rumus ${row.formulaVersion}) ${stamp.format(new Date(row.computedAt))}` : 'Tidak ada hasil hitung'}</TableCell>
											</TableRow>
										{/each}
									</TableBody>
								</Table>
							</div>
						{/if}
					{/each}
				</div>
			</details>
		{:else}
			<EmptyState title="Belum ada mata kuliah" description="Riwayat muncul setelah nilai mahasiswa ini diimpor." />
		{/each}
	</TabsContent>

	<TabsContent value="revisi" class="mt-4">
		{#if profile.revisions.length === 0}
			<EmptyState title="Belum ada perubahan nilai" description="Setiap impor awal, pembaruan, dan koreksi nilai dicatat di sini." />
		{:else}
			<div class="overflow-x-auto rounded-lg border bg-card">
				<Table>
					<TableHeader><TableRow><TableHead>Waktu</TableHead><TableHead>Mata kuliah</TableHead><TableHead>Komponen</TableHead><TableHead class="text-right">Nilai lama</TableHead><TableHead class="text-right">Nilai baru</TableHead><TableHead>Jenis</TableHead><TableHead>Berkas sumber</TableHead></TableRow></TableHeader>
					<TableBody>
						{#each profile.revisions as revision (revision.id)}
							<TableRow>
								<TableCell class="whitespace-nowrap text-xs">{stamp.format(new Date(revision.at))}</TableCell>
								<TableCell>{revision.courseName}</TableCell>
								<TableCell class="font-mono text-xs">{revision.componentCode}</TableCell>
								<TableCell class="text-right tabular-nums">{revision.oldScore === null ? '—' : formatValue(revision.oldScore, 2)}</TableCell>
								<TableCell class="text-right tabular-nums">{revision.newScore === null ? '—' : formatValue(revision.newScore, 2)}</TableCell>
								<TableCell>{changeLabel[revision.changeType]}</TableCell>
								<TableCell class="max-w-48 truncate text-xs text-muted-foreground" title={revision.batchFileName ?? ''}>{revision.batchFileName ?? '—'}</TableCell>
							</TableRow>
						{/each}
					</TableBody>
				</Table>
			</div>
		{/if}
	</TabsContent>
</Tabs>
