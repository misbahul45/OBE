<script lang="ts">
	import { Download } from '@lucide/svelte';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Card, CardContent, CardHeader, CardTitle } from '#lib/components/ui/card/index.ts';
	import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#lib/components/ui/table/index.ts';
	import EmptyState from '#lib/shared/ui/EmptyState.svelte';
	import StatusBadge from '#lib/shared/ui/StatusBadge.svelte';
	import { batchStatusLabel, batchStatusTone, severityLabel, severityTone, sheetStatusLabel, sheetStatusTone } from '../imports.labels.ts';

	type Detail = {
		batch: { id: string; fileName: string; status: string; createdAt: Date; finishedAt: Date | null; fileSize: number; studentsInserted: number; studentsReused: number; enrollmentsInserted: number; enrollmentsExisting: number; scoresInserted: number; scoresUpdated: number; scoresUnchanged: number; referencesWritten: number; errorMessage: string | null };
		uploaderName: string;
		sheets: { sheetName: string; status: string; include: boolean; rowCount: number; courseCode: string | null; courseName: string | null; section: string | null; semesterName: string | null }[];
		issueTotals: Partial<Record<'error' | 'warning' | 'info', number>>;
		issues: { id: string; sheetName: string | null; rowNumber: number | null; columnRef: string | null; severity: 'error' | 'warning' | 'info'; code: string; message: string }[];
		affectedStudents: { id: string; nimMasked: string; name: string }[];
		affectedTotal: number;
	};

	let { detail, basePath, expired = false }: { detail: Detail; basePath: string; expired?: boolean } = $props();

	const b = $derived(detail.batch);
	const stamp = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short' });
	const number = new Intl.NumberFormat('id-ID');
	const counters = $derived([
		{ label: 'Mahasiswa baru', value: b.studentsInserted },
		{ label: 'Mahasiswa sudah ada', value: b.studentsReused },
		{ label: 'Pendaftaran kelas baru', value: b.enrollmentsInserted },
		{ label: 'Nilai baru', value: b.scoresInserted },
		{ label: 'Nilai diubah', value: b.scoresUpdated },
		{ label: 'Nilai tidak berubah', value: b.scoresUnchanged },
		{ label: 'Referensi CPMK/CPL', value: b.referencesWritten }
	]);
	const issueCount = $derived((detail.issueTotals.error ?? 0) + (detail.issueTotals.warning ?? 0) + (detail.issueTotals.info ?? 0));
</script>

<div class="space-y-6" data-testid="batch-report">
	<Card>
		<CardHeader>
			<CardTitle class="flex flex-wrap items-center gap-2">
				<h2 class="text-lg font-semibold">{b.fileName}</h2>
				<StatusBadge status={batchStatusTone[b.status] ?? 'neutral'} label={batchStatusLabel[b.status] ?? b.status} />
			</CardTitle>
		</CardHeader>
		<CardContent class="space-y-4">
			<p class="text-sm text-muted-foreground">
				Diunggah oleh {detail.uploaderName} pada {stamp.format(new Date(b.createdAt))}{#if b.finishedAt}, selesai {stamp.format(new Date(b.finishedAt))}{/if} · {number.format(Math.max(1, Math.round(b.fileSize / 1024)))} KB
			</p>
			{#if expired}
				<div class="rounded-md border border-status-warning bg-status-warning-soft p-3 text-sm text-status-warning" role="status">Berkas sementara sudah kedaluwarsa atau dihapus sehingga batch ini tidak dapat dilanjutkan. Unggah ulang berkas untuk mengulang.</div>
			{/if}
			{#if b.errorMessage}<div class="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive" role="alert">{b.errorMessage}</div>{/if}
			<dl class="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
				{#each counters as counter (counter.label)}
					<div class="rounded-md border bg-card p-3">
						<dt class="text-xs text-muted-foreground">{counter.label}</dt>
						<dd class="mt-0.5 text-xl font-semibold tabular-nums">{number.format(counter.value)}</dd>
					</div>
				{/each}
			</dl>
		</CardContent>
	</Card>

	<section aria-labelledby="sheets-heading">
		<h2 id="sheets-heading" class="mb-2 text-base font-semibold">Sheet</h2>
		<div class="overflow-x-auto rounded-lg border bg-card">
			<Table>
				<TableHeader>
					<TableRow><TableHead>Sheet</TableHead><TableHead>Kelas tujuan</TableHead><TableHead>Semester</TableHead><TableHead class="text-right">Mahasiswa</TableHead><TableHead>Status</TableHead></TableRow>
				</TableHeader>
				<TableBody>
					{#each detail.sheets as sheet (sheet.sheetName)}
						<TableRow>
							<TableCell class="font-medium">{sheet.sheetName}</TableCell>
							<TableCell>{#if sheet.courseName}{sheet.courseCode} · {sheet.courseName} (Kelas {sheet.section}){:else}—{/if}</TableCell>
							<TableCell>{sheet.semesterName ?? '—'}</TableCell>
							<TableCell class="text-right tabular-nums">{sheet.rowCount}</TableCell>
							<TableCell><StatusBadge status={sheet.include ? (sheetStatusTone[sheet.status] ?? 'neutral') : 'neutral'} label={sheet.include ? (sheetStatusLabel[sheet.status] ?? sheet.status) : 'Tidak disertakan'} /></TableCell>
						</TableRow>
					{/each}
				</TableBody>
			</Table>
		</div>
	</section>

	<section aria-labelledby="issues-heading">
		<div class="mb-2 flex flex-wrap items-center justify-between gap-2">
			<h2 id="issues-heading" class="text-base font-semibold">Catatan validasi ({issueCount})</h2>
			{#if issueCount > 0}
				<Button variant="outline" size="sm" href={`${basePath}/${b.id}/issues.csv`} download class="gap-1.5"><Download class="size-4" aria-hidden="true" />Unduh CSV</Button>
			{/if}
		</div>
		{#if detail.issues.length === 0}
			<EmptyState title="Tidak ada catatan" description="Validasi tidak menemukan galat maupun peringatan." />
		{:else}
			<ul class="space-y-1.5 rounded-lg border bg-card p-3">
				{#each detail.issues as issue (issue.id)}
					<li class="flex flex-wrap items-start gap-2 text-sm">
						<StatusBadge status={severityTone[issue.severity]} label={severityLabel[issue.severity]} />
						<span class="font-mono text-xs text-muted-foreground">{issue.sheetName ?? ''}{issue.rowNumber ? ` · baris ${issue.rowNumber}` : ''}{issue.columnRef ? ` · ${issue.columnRef}` : ''} · {issue.code}</span>
						<span>{issue.message}</span>
					</li>
				{/each}
			</ul>
			{#if issueCount > detail.issues.length}<p class="mt-2 text-xs text-muted-foreground">Menampilkan {detail.issues.length} catatan teratas. Unduh CSV untuk daftar lengkap.</p>{/if}
		{/if}
	</section>

	{#if b.status === 'committed'}
		<section aria-labelledby="affected-heading">
			<h2 id="affected-heading" class="mb-2 text-base font-semibold">Mahasiswa terdampak ({number.format(detail.affectedTotal)})</h2>
			{#if detail.affectedStudents.length === 0}
				<EmptyState title="Tidak ada nilai yang berubah" description="Semua nilai pada berkas ini sama dengan data yang sudah tersimpan." />
			{:else}
				<div class="overflow-x-auto rounded-lg border bg-card">
					<Table>
						<TableHeader><TableRow><TableHead>NIM</TableHead><TableHead>Nama</TableHead></TableRow></TableHeader>
						<TableBody>
							{#each detail.affectedStudents as student (student.id)}
								<TableRow><TableCell class="font-mono text-xs">{student.nimMasked}</TableCell><TableCell>{student.name}</TableCell></TableRow>
							{/each}
						</TableBody>
					</Table>
				</div>
			{/if}
			{#if detail.affectedTotal > detail.affectedStudents.length}<p class="mt-2 text-xs text-muted-foreground">Menampilkan {detail.affectedStudents.length} pertama berdasarkan nama.</p>{/if}
		</section>
	{/if}
</div>
