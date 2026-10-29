<script lang="ts">
	import { enhance } from '$app/forms';
	import { Alert, AlertDescription } from '#lib/components/ui/alert/index.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#lib/components/ui/table/index.ts';
	import { BarChart, LinkMatrix, StackedShare, formatValue } from '#lib/shared/charts/index.ts';
	import EmptyState from '#lib/shared/ui/EmptyState.svelte';
	import NativeSelect from '#lib/shared/ui/NativeSelect.svelte';
	import Pager from '#lib/shared/ui/Pager.svelte';
	import StatusBadge from '#lib/shared/ui/StatusBadge.svelte';
	import { keeratanLabel, keeratanValues, type TracerOverview } from './../tracer.types.ts';

	type Query = { search: string; status: string; pageSize: number };

	let { overview, query }: { overview: TracerOverview; query: Query } = $props();

	const summary = $derived(overview.summary);
	const predicted = $derived(overview.predicted);
	const notRecorded = $derived(summary.students - summary.recorded);
	const sizes = [10, 20, 50, 100] as const;
	const linearLabels = { achieved: 'Linear', notAchieved: 'Tidak linear', insufficient: 'Belum ada data' };

	const shares = $derived([
		{ label: 'Prediksi dari nilai CPL', achieved: predicted.linear, notAchieved: predicted.notLinear, insufficient: predicted.notAssessable, ratio: predicted.linearPercent, meets: null },
		{ label: 'Nyata (diisi manual)', achieved: summary.actualLinear, notAchieved: summary.recorded - summary.actualLinear, insufficient: notRecorded, ratio: summary.actualPercent, meets: null }
	]);
	const fieldOptions = $derived(overview.fields.map((f) => ({ value: f.code, label: `${f.code} · ${f.name}` })));
	const keeratanOptions = keeratanValues.map((value) => ({ value, label: keeratanLabel[value] }));
	const linearOptions = [
		{ value: 'ya', label: 'Linear' },
		{ value: 'tidak', label: 'Tidak linear' }
	];
	const statusOptions = [
		{ value: 'belum', label: 'Belum diisi' },
		{ value: 'linear', label: 'Nyata linear' },
		{ value: 'tidak', label: 'Nyata tidak linear' }
	];
	const matrix = $derived(summary.matrix);

	const build = (changes: Partial<{ cari: string; status: string; ukuran: string; halaman: string }>) => {
		const merged = { cari: query.search, status: query.status, ukuran: query.pageSize === 20 ? '' : String(query.pageSize), halaman: '', ...changes };
		const params = new URLSearchParams();
		for (const [key, value] of Object.entries(merged)) if (value) params.set(key, value);
		const text = params.toString();
		return text ? `?${text}` : '?';
	};
	const pageHref = (target: number) => build({ halaman: target > 1 ? String(target) : '' });
	const sizeHref = (size: number) => build({ ukuran: size === 20 ? '' : String(size), halaman: '' });
	const percent = (value: number | null) => (value === null ? '—' : `${formatValue(value)}%`);
</script>

{#if !overview.ready}
	<Alert role="status" class="mb-4"><AlertDescription>Prediksi belum dapat dihitung karena belum ada ambang nilai CPL, baik dari kebijakan OBE aktif maupun dari ambang pada berkas Excel yang diimpor. Data nyata tetap dapat diisi.</AlertDescription></Alert>
{:else}
	<p class="mb-4 text-sm text-muted-foreground">Ambang nilai CPL berasal dari {overview.targetSource === 'policy' ? 'kebijakan OBE aktif' : 'berkas Excel yang diimpor'}. Sebuah bidang kerja diprediksi linear bila kecocokan berbobotnya (F) minimal {overview.threshold}.</p>
{/if}

<section aria-labelledby="stat-heading" class="mb-8 space-y-4">
	<h2 id="stat-heading" class="text-lg font-semibold">Statistik linearitas</h2>
	<dl class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
		<div class="rounded-md border bg-card p-3"><dt class="text-xs text-muted-foreground">Prediksi linear</dt><dd class="mt-0.5 text-2xl font-semibold tabular-nums">{predicted.linear}</dd><dd class="text-xs text-muted-foreground">{percent(predicted.linearPercent)} dari {predicted.assessed} yang dapat dinilai</dd></div>
		<div class="rounded-md border bg-card p-3"><dt class="text-xs text-muted-foreground">Prediksi tidak linear</dt><dd class="mt-0.5 text-2xl font-semibold tabular-nums">{predicted.notLinear}</dd><dd class="text-xs text-muted-foreground">{predicted.assessed ? percent(100 - (predicted.linearPercent ?? 0)) : '—'} dari yang dapat dinilai</dd></div>
		<div class="rounded-md border bg-card p-3"><dt class="text-xs text-muted-foreground">Belum dapat dinilai</dt><dd class="mt-0.5 text-2xl font-semibold tabular-nums">{predicted.notAssessable}</dd><dd class="text-xs text-muted-foreground">belum ada nilai CPL atau ambang</dd></div>
		<div class="rounded-md border bg-card p-3"><dt class="text-xs text-muted-foreground">Nyata linear</dt><dd class="mt-0.5 text-2xl font-semibold tabular-nums">{summary.actualLinear}</dd><dd class="text-xs text-muted-foreground">{percent(summary.actualPercent)} dari {summary.recorded} yang diisi</dd></div>
		<div class="rounded-md border bg-card p-3"><dt class="text-xs text-muted-foreground">Nyata tidak linear</dt><dd class="mt-0.5 text-2xl font-semibold tabular-nums">{summary.recorded - summary.actualLinear}</dd><dd class="text-xs text-muted-foreground">belum diisi: {notRecorded}</dd></div>
		<div class="rounded-md border bg-card p-3"><dt class="text-xs text-muted-foreground">Prediksi sesuai nyata</dt><dd class="mt-0.5 text-2xl font-semibold tabular-nums">{percent(summary.agreementPercent)}</dd><dd class="text-xs text-muted-foreground">dari {summary.comparable} yang dapat dibandingkan</dd></div>
	</dl>

	<div class="grid gap-4 xl:grid-cols-2">
		<StackedShare title="Linear dan tidak linear" description="Prediksi memakai bidang kerja dengan kecocokan tertinggi; nyata adalah isian manual. Persen di ujung baris adalah persen linear." items={shares} labels={linearLabels} ratioLabel="persen linear" />
		<LinkMatrix title="Prediksi dibanding nyata" description="Jumlah mahasiswa yang punya isian nyata beserta bidang kerjanya. Diagonal (kiri atas dan kanan bawah) adalah prediksi yang tepat." rows={['Prediksi linear', 'Prediksi tidak linear']} columns={['Nyata linear', 'Nyata tidak linear']} cells={[[matrix.predictedLinear.actualLinear, matrix.predictedLinear.actualNotLinear], [matrix.predictedNotLinear.actualLinear, matrix.predictedNotLinear.actualNotLinear]]} digits={0} showZero emptyText="Belum ada isian nyata dengan bidang kerja untuk dibandingkan." />
	</div>

	<div class="grid gap-4 xl:grid-cols-2">
		<div class="overflow-x-auto rounded-lg border bg-card xl:col-span-2">
			<Table>
				<TableHeader><TableRow><TableHead>Bidang kerja</TableHead><TableHead class="text-right">Prediksi linear</TableHead><TableHead class="text-right">Tidak linear</TableHead><TableHead class="text-right">Rata-rata F</TableHead><TableHead class="text-right">Nyata linear</TableHead><TableHead class="text-right">Nyata tidak</TableHead></TableRow></TableHeader>
				<TableBody>
					{#each overview.fieldStats as field (field.code)}
						<TableRow>
							<TableCell><span class="font-medium">{field.code}</span> <span class="text-muted-foreground">{field.name}</span></TableCell>
							<TableCell class="text-right tabular-nums">{field.predictedLinear}</TableCell>
							<TableCell class="text-right tabular-nums">{field.predictedNotLinear}</TableCell>
							<TableCell class="text-right tabular-nums">{formatValue(field.meanFit)}</TableCell>
							<TableCell class="text-right tabular-nums">{field.recordedLinear}</TableCell>
							<TableCell class="text-right tabular-nums">{field.recordedNotLinear}</TableCell>
						</TableRow>
					{/each}
				</TableBody>
			</Table>
		</div>
		<BarChart title="Keeratan bidang studi dengan pekerjaan" description="Skala lima tingkat yang sama dengan kuesioner Tracer Study UNAIR; jumlah isian per tingkat." items={overview.keeratanCounts.map((k) => ({ label: keeratanLabel[k.value], value: k.count }))} unit=" orang" emptyText="Belum ada isian keeratan." />
	</div>

	<details class="rounded-lg border bg-card p-4 text-sm">
		<summary class="cursor-pointer font-medium">Cara menghitung</summary>
		<ol class="mt-3 list-decimal space-y-1.5 pl-5 text-muted-foreground">
			<li>Nilai CPL mahasiswa adalah rata-rata nilai CPL antar mata kuliah (hasil hitung sistem bila lengkap, kolom Excel bila tidak). Capaian CPL = MIN(nilai ÷ ambang, 1).</li>
			<li>Kecocokan bidang kerja F = Σ(r × MIN(nilai ÷ R, 1)) ÷ Σ r × 100. Bobot r = Σ(relevansi bidang–profil × keterkaitan profil–CPL), dan R = ambang CPL. Hanya CPL yang punya nilai ikut dihitung.</li>
			<li>Prediksi linear bila F bidang kerja terbaik ≥ {overview.parameters.linearThreshold}. Pada isian nyata yang menyebut bidang kerja, prediksi dihitung untuk bidang itu.</li>
			<li>Skor profil P, cakupan Cov, dan indeks IKP = {overview.parameters.alpha} × P + {1 - overview.parameters.alpha} × Cov dipakai untuk jalur lewat profil. Kategori: sangat sesuai ≥ {overview.parameters.veryFit}, sesuai ≥ {overview.parameters.fit}, cukup ≥ {overview.parameters.enough}.</li>
			<li>Persen linear nyata = jumlah nyata linear ÷ jumlah yang sudah diisi. Prediksi sesuai nyata = prediksi sama dengan isian, dari yang punya isian dan bidang kerja.</li>
			<li>Ambang 70, α 0,7, dan kategori berasal dari contoh dokumen OBE prodi dan merupakan asumsi yang perlu ditetapkan prodi; UNAIR sendiri mengukur kesesuaian lewat penilaian alumni (keeratan lima tingkat).</li>
		</ol>
	</details>
</section>

<section aria-labelledby="list-heading" class="space-y-3">
	<h2 id="list-heading" class="text-lg font-semibold">Isian nyata per mahasiswa</h2>
	<form method="GET" class="grid gap-2 md:grid-cols-4" role="search">
		<Input name="cari" type="search" placeholder="Cari NIM atau nama" value={query.search} aria-label="Cari mahasiswa" class="md:col-span-2" autocomplete="off" />
		<NativeSelect id="t-status" name="status" label="Saring berdasarkan status isian" value={query.status} placeholder="Semua status" options={statusOptions} />
		{#if query.pageSize !== 20}<input type="hidden" name="ukuran" value={query.pageSize} />{/if}
		<div class="md:col-span-4"><Button type="submit" variant="secondary">Terapkan filter</Button> <Button variant="ghost" href="?">Atur ulang</Button></div>
	</form>

	{#if overview.rows.length === 0}
		<EmptyState title="Tidak ada mahasiswa" description="Ubah kata kunci atau status, atau impor nilai terlebih dahulu." actionLabel="Atur ulang pencarian" actionHref="?" />
	{:else}
		<div class="overflow-x-auto rounded-lg border bg-card">
			<Table>
				<TableHeader><TableRow><TableHead>Mahasiswa</TableHead><TableHead>Prediksi</TableHead><TableHead>Isian nyata</TableHead></TableRow></TableHeader>
				<TableBody>
					{#each overview.rows as row (row.studentId)}
						<TableRow>
							<TableCell class="align-top">
								<a class="font-medium text-primary underline-offset-4 hover:underline" href={`/app/students/${row.studentId}`}>{row.name}</a>
								<p class="font-mono text-xs text-muted-foreground">{row.nim}</p>
							</TableCell>
							<TableCell class="align-top text-sm">
								{#if row.bestFields.length === 0}
									<StatusBadge status="neutral" label="Belum dapat dinilai" />
									<p class="mt-1 text-xs text-muted-foreground">{row.cplWithData} CPL bernilai</p>
								{:else}
									<StatusBadge status={row.predictedLinear ? 'success' : 'warning'} label={row.predictedLinear ? 'Prediksi linear' : 'Prediksi tidak linear'} />
									<ul class="mt-1 space-y-0.5 text-xs text-muted-foreground">
										{#each row.bestFields as field (field.code)}<li>{field.code} {field.name}: <span class="tabular-nums">{formatValue(field.fit)}</span></li>{/each}
									</ul>
								{/if}
							</TableCell>
							<TableCell class="align-top">
								<form method="POST" action="?/save" use:enhance={() => async ({ update }) => update({ reset: false })} class="grid gap-1.5 md:grid-cols-4">
									<input type="hidden" name="studentId" value={row.studentId} />
									<NativeSelect id={`l-${row.studentId}`} name="linear" label={`Linear atau tidak untuk ${row.name}`} value={row.record ? (row.record.isLinear ? 'ya' : 'tidak') : ''} placeholder="Belum diisi" options={linearOptions} required />
									<NativeSelect id={`f-${row.studentId}`} name="careerFieldCode" label={`Bidang kerja ${row.name}`} value={row.record?.careerFieldCode ?? ''} placeholder="Bidang kerja" options={fieldOptions} />
									<NativeSelect id={`k-${row.studentId}`} name="keeratan" label={`Keeratan bidang studi ${row.name}`} value={row.record?.keeratan ?? ''} placeholder="Keeratan" options={keeratanOptions} />
									<div class="flex gap-1.5"><Button type="submit" size="sm" variant="secondary">Simpan</Button>{#if row.record}<Button type="submit" size="sm" variant="ghost" formaction="?/clear" formnovalidate>Hapus</Button>{/if}</div>
								</form>
								{#if row.record && row.record.predictedForField !== null}
									<p class="mt-1 text-xs text-muted-foreground">Untuk bidang {row.record.careerFieldCode}: prediksi {row.record.predictedForField ? 'linear' : 'tidak linear'} (F {formatValue(row.record.fieldFit)}), isian {row.record.isLinear ? 'linear' : 'tidak linear'} — {row.record.predictedForField === row.record.isLinear ? 'sesuai' : 'berbeda'}.</p>
								{/if}
							</TableCell>
						</TableRow>
					{/each}
				</TableBody>
			</Table>
		</div>
		<Pager page={overview.page} pageCount={overview.pageCount} total={overview.total} pageSize={overview.pageSize} shown={overview.rows.length} href={pageHref} pageSizes={sizes} {sizeHref} />
	{/if}
</section>
