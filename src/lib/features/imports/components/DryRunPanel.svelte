<script lang="ts">
	import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#lib/components/ui/table/index.ts';
	import StatusBadge from '#lib/shared/ui/StatusBadge.svelte';
	import { actionLabel, componentTypeLabel, severityLabel, severityTone } from '../imports.labels.ts';
	import type { DryRunView } from '../imports.view.ts';

	let { result }: { result: DryRunView } = $props();

	const s = $derived(result.summary);
	const stats = $derived([
		{ label: 'Baris valid', value: s.rowsValid },
		{ label: 'Baris peringatan', value: s.rowsWarning },
		{ label: 'Baris ditolak', value: s.rowsRejected },
		{ label: 'Mahasiswa baru', value: s.studentsNew },
		{ label: 'Mahasiswa sudah ada', value: s.studentsExisting },
		{ label: 'Pendaftaran kelas baru', value: s.enrollmentsNew },
		{ label: 'Nilai baru', value: s.scoresNew },
		{ label: 'Nilai diubah', value: s.scoresUpdated },
		{ label: 'Nilai tidak berubah', value: s.scoresUnchanged },
		{ label: 'Referensi CPMK/CPL baru', value: s.referencesNew },
		{ label: 'Komponen baru', value: s.componentsNew },
		{ label: 'Bobot berubah', value: s.weightChanges },
		{ label: 'Sel nilai kosong', value: s.blankCells },
		{ label: 'Konflik nama', value: s.nameConflicts }
	]);
	const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
</script>

<section aria-labelledby="dryrun-heading" class="space-y-5" data-testid="dry-run-result">
	<h3 id="dryrun-heading" class="text-base font-semibold">Hasil validasi (belum ada data yang disimpan)</h3>

	{#if result.blockers.length}
		<div class="rounded-md border border-destructive/40 bg-destructive/5 p-4" role="alert">
			<p class="mb-2 text-sm font-medium text-destructive">Penyimpanan ditahan oleh {result.blockers.length} hal berikut:</p>
			<ul class="list-disc space-y-1 pl-5 text-sm">
				{#each result.blockers as blocker, i (i)}<li>{blocker.message}</li>{/each}
			</ul>
		</div>
	{:else}
		<div class="rounded-md border bg-status-success-soft p-3 text-sm text-status-success" role="status">Tidak ada penghalang. Periksa ringkasan di bawah, lalu simpan.</div>
	{/if}

	<dl class="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
		{#each stats as stat (stat.label)}
			<div class="rounded-md border bg-card p-3">
				<dt class="text-xs text-muted-foreground">{stat.label}</dt>
				<dd class="mt-0.5 text-xl font-semibold tabular-nums">{number.format(stat.value)}</dd>
			</div>
		{/each}
	</dl>

	{#each result.sheets.filter((sheet) => sheet.included) as sheet (sheet.name)}
		<details class="rounded-md border" open={result.sheets.length === 1}>
			<summary class="cursor-pointer px-3 py-2 text-sm font-medium">
				Sheet {sheet.name} · {sheet.summary.rowsValid + sheet.summary.rowsWarning} baris diterima · {sheet.summary.rowsRejected} ditolak · {sheet.issueCount} catatan
			</summary>
			<div class="space-y-4 border-t p-3">
				{#if sheet.components.length}
					<div class="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow><TableHead>Komponen</TableHead><TableHead>Jenis</TableHead><TableHead class="text-right">Bobot</TableHead><TableHead class="text-right">Maks</TableHead><TableHead>Tindakan</TableHead></TableRow>
							</TableHeader>
							<TableBody>
								{#each sheet.components as component (component.code)}
									<TableRow>
										<TableCell>{component.name} <span class="font-mono text-xs text-muted-foreground">({component.code})</span></TableCell>
										<TableCell>{componentTypeLabel[component.type]}</TableCell>
										<TableCell class="text-right tabular-nums">{component.weightPercent ?? '—'}{component.weightPercent !== null ? '%' : ''}</TableCell>
										<TableCell class="text-right tabular-nums">{component.maxScore}</TableCell>
										<TableCell>
											{#if component.action === 'create'}<StatusBadge status="info" label="Komponen baru" />
											{:else if component.action === 'weight_change'}<StatusBadge status="warning" label={`Bobot ${component.existingWeightPercent ?? '—'}% → ${component.weightPercent ?? '—'}%`} />
											{:else}<StatusBadge status="neutral" label="Sudah ada" />{/if}
										</TableCell>
									</TableRow>
								{/each}
							</TableBody>
						</Table>
					</div>
				{/if}

				{#if sheet.sampleRows.length}
					<div>
						<p class="mb-1 text-sm font-medium">Contoh baris ({sheet.sampleRows.length} pertama, NIM disamarkan)</p>
						<div class="overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow><TableHead>Baris</TableHead><TableHead>NIM</TableHead><TableHead>Nama</TableHead><TableHead>Mahasiswa</TableHead><TableHead>Perubahan nilai</TableHead></TableRow>
								</TableHeader>
								<TableBody>
									{#each sheet.sampleRows as row (row.row)}
										<TableRow>
											<TableCell class="tabular-nums">{row.row}</TableCell>
											<TableCell class="font-mono text-xs">{row.nimMasked}</TableCell>
											<TableCell>{row.name}{#if row.nameConflict} <StatusBadge status="warning" label="Nama beda dari master" />{/if}</TableCell>
											<TableCell>{row.student === 'create' ? 'Baru' : 'Sudah ada'}</TableCell>
											<TableCell class="text-xs">
												{#each row.scores as score (score.code)}
													<span class="mr-2 inline-block whitespace-nowrap">{score.code}: {score.action === 'update' ? `${score.oldValue} → ${score.newValue}` : score.newValue} <span class="text-muted-foreground">({actionLabel[score.action]})</span></span>
												{/each}
												{#if row.blank.length}<span class="text-muted-foreground">kosong: {row.blank.join(', ')}</span>{/if}
											</TableCell>
										</TableRow>
									{/each}
								</TableBody>
							</Table>
						</div>
					</div>
				{/if}

				{#if sheet.issues.length}
					<div>
						<p class="mb-1 text-sm font-medium">Catatan validasi ({sheet.issues.length} dari {sheet.issueCount} ditampilkan; daftar lengkap ada di laporan)</p>
						<ul class="space-y-1">
							{#each sheet.issues as issue, i (i)}
								<li class="flex flex-wrap items-start gap-2 text-sm">
									<StatusBadge status={severityTone[issue.severity]} label={severityLabel[issue.severity]} />
									<span class="font-mono text-xs text-muted-foreground">{issue.row ? `baris ${issue.row}` : 'sheet'}{issue.column ? ` · ${issue.column}` : ''} · {issue.code}</span>
									<span>{issue.message}</span>
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
		</details>
	{/each}
</section>
