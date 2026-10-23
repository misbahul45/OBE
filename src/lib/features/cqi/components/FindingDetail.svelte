<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Card, CardContent, CardHeader, CardTitle } from '#lib/components/ui/card/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Textarea } from '#lib/components/ui/textarea/index.ts';
	import { formatValue } from '#lib/shared/charts/index.ts';
	import { errorsOf, type FormState } from '#lib/shared/http/form-state.ts';
	import ConfirmForm from '#lib/shared/ui/ConfirmForm.svelte';
	import EmptyState from '#lib/shared/ui/EmptyState.svelte';
	import Field from '#lib/shared/ui/Field.svelte';
	import FormMessage from '#lib/shared/ui/FormMessage.svelte';
	import NativeSelect from '#lib/shared/ui/NativeSelect.svelte';
	import PageHeader from '#lib/shared/ui/PageHeader.svelte';
	import StatusBadge from '#lib/shared/ui/StatusBadge.svelte';
	import { actionStatusTone, priorityTone, statusTone } from '../cqi.labels.ts';
	import { priorities, priorityLabels } from '../cqi.validation.ts';
	import { actionStatusLabels, allowedActionTransitions, isFinal, statusLabels, cqiStatuses, type CqiActionStatus, type CqiStatus } from '../cqi.workflow.ts';

	type Detail = {
		finding: { id: string; code: string; title: string; description: string; priority: string; status: CqiStatus; rootCause: string | null; closedAt: Date | null };
		links: { offering: string | null; semester: string | null; cpl: string | null; cpmk: string | null };
		actions: { id: string; description: string; picName: string; dueDate: string; status: CqiActionStatus; overdue: boolean; canUpdate: boolean; completedAt: Date | null }[];
		evidence: { id: string; title: string; url: string | null; note: string | null; addedByName: string; createdAt: Date; actionId: string | null }[];
		evaluations: { id: string; metricLabel: string; valueBefore: number | null; valueAfter: number | null; conclusion: string; evaluatedByName: string; evaluatedAt: Date }[];
		transitions: { to: CqiStatus; blockers: string[] }[];
		canEdit: boolean;
		canAddEvidence: boolean;
	};

	let { detail, pics, form, backHref }: { detail: Detail; pics: { id: string; name: string; role: string | null }[]; form: FormState; backHref: string } = $props();

	const f = $derived(detail.finding);
	const stamp = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
	const dateFormat = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' });
	const day = (iso: string) => dateFormat.format(new Date(`${iso}T00:00:00`));
	const priorityOptions = priorities.map((value) => ({ value, label: priorityLabels[value] }));
	const picOptions = $derived(pics.map((p) => ({ value: p.id, label: `${p.name}${p.role === 'super_admin' ? ' (Kaprodi)' : ''}` })));
	const actionOptions = $derived(detail.actions.map((a) => ({ value: a.id, label: a.description.slice(0, 60) })));
	const stepIndex = $derived(cqiStatuses.indexOf(f.status));
	const steps = cqiStatuses.filter((s) => s !== 'cancelled');
	const locked = $derived(isFinal(f.status));
	const evaluationOpen = $derived(f.status === 'evaluating');
</script>

<svelte:head><title>{f.code} · CQI</title></svelte:head>

<PageHeader title={f.title} description={`${f.code}${detail.links.semester ? ` · ${detail.links.semester}` : ''}`}>
	{#snippet actions()}<Button variant="outline" href={backHref}>Kembali ke daftar</Button>{/snippet}
</PageHeader>

<div class="mb-4"><FormMessage message={form?.fieldErrors?.status ? null : form?.message} success={form?.success} /></div>
{#if form?.fieldErrors?.status}<ul class="mb-4 list-disc space-y-1 rounded-md border border-destructive/40 bg-destructive/5 p-3 pl-8 text-sm text-destructive" role="alert">{#each form.fieldErrors.status as message (message)}<li>{message}</li>{/each}</ul>{/if}

<ol class="mb-6 flex flex-wrap gap-2" aria-label="Tahapan CQI">
	{#each steps as step, i (step)}
		<li class="rounded-md border px-3 py-1 text-xs {f.status === step ? 'border-primary bg-primary text-primary-foreground' : i < stepIndex && f.status !== 'cancelled' ? 'bg-status-success-soft text-status-success' : 'text-muted-foreground'}" aria-current={f.status === step ? 'step' : undefined}>{i + 1}. {statusLabels[step]}</li>
	{/each}
	{#if f.status === 'cancelled'}<li class="rounded-md border border-primary bg-primary px-3 py-1 text-xs text-primary-foreground" aria-current="step">Dibatalkan</li>{/if}
</ol>

<div class="grid gap-6 lg:grid-cols-[1fr_20rem]">
	<div class="space-y-6">
		<Card>
			<CardHeader><CardTitle class="flex flex-wrap items-center gap-2"><h2 class="text-base font-semibold">Temuan</h2><StatusBadge status={statusTone[f.status]} label={statusLabels[f.status]} /><StatusBadge status={priorityTone[f.priority] ?? 'neutral'} label={priorityLabels[f.priority as keyof typeof priorityLabels] ?? f.priority} /></CardTitle></CardHeader>
			<CardContent class="space-y-4">
				<dl class="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
					{#if detail.links.offering}<dt class="text-muted-foreground">Kelas</dt><dd>{detail.links.offering}</dd>{/if}
					{#if detail.links.cpl}<dt class="text-muted-foreground">CPL</dt><dd>{detail.links.cpl}</dd>{/if}
					{#if detail.links.cpmk}<dt class="text-muted-foreground">CPMK</dt><dd>{detail.links.cpmk}</dd>{/if}
					{#if f.closedAt}<dt class="text-muted-foreground">Ditutup</dt><dd>{stamp.format(new Date(f.closedAt))}</dd>{/if}
				</dl>
				{#if detail.canEdit && !locked}
					<form method="POST" action="?/update" use:enhance={() => async ({ update }) => update({ reset: false })} class="grid gap-3">
						<Field id="e-title" label="Judul" errors={errorsOf(form, 'title')}>{#snippet children({ describedBy, invalid })}<Input id="e-title" name="title" required value={f.title} aria-invalid={invalid} aria-describedby={describedBy} />{/snippet}</Field>
						<Field id="e-desc" label="Deskripsi" errors={errorsOf(form, 'description')}>{#snippet children({ describedBy, invalid })}<Textarea id="e-desc" name="description" rows={3} required value={f.description} aria-invalid={invalid} aria-describedby={describedBy} />{/snippet}</Field>
						<Field id="e-priority" label="Prioritas" errors={errorsOf(form, 'priority')}>{#snippet children({ describedBy, invalid })}<NativeSelect id="e-priority" name="priority" options={priorityOptions} value={f.priority} {invalid} {describedBy} />{/snippet}</Field>
						<Field id="e-root" label="Akar masalah" errors={errorsOf(form, 'rootCause')} hint="Wajib terisi sebelum rencana tindakan.">{#snippet children({ describedBy, invalid })}<Textarea id="e-root" name="rootCause" rows={3} value={f.rootCause ?? ''} aria-invalid={invalid} aria-describedby={describedBy} />{/snippet}</Field>
						<div><Button type="submit">Simpan temuan</Button></div>
					</form>
				{:else}
					<p class="whitespace-pre-line text-sm">{f.description}</p>
					<div><h3 class="text-sm font-medium">Akar masalah</h3><p class="text-sm text-muted-foreground">{f.rootCause ?? 'Belum dianalisis.'}</p></div>
				{/if}
			</CardContent>
		</Card>

		<section aria-labelledby="actions-heading" class="space-y-3">
			<h2 id="actions-heading" class="text-lg font-semibold">Tindakan perbaikan ({detail.actions.length})</h2>
			{#if detail.actions.length === 0}
				<EmptyState title="Belum ada tindakan" description="Tambahkan tindakan dengan penanggung jawab dan tenggat." />
			{:else}
				<ul class="space-y-2">
					{#each detail.actions as action (action.id)}
						<li class="rounded-lg border bg-card p-3" data-action={action.id}>
							<div class="flex flex-wrap items-start justify-between gap-2">
								<div class="min-w-0"><p class="text-sm font-medium">{action.description}</p><p class="text-xs text-muted-foreground">PJ {action.picName} · tenggat {day(action.dueDate)}</p></div>
								<span class="flex flex-wrap items-center gap-1.5"><StatusBadge status={actionStatusTone[action.status]} label={actionStatusLabels[action.status]} />{#if action.overdue}<StatusBadge status="danger" label="Terlambat" />{/if}</span>
							</div>
							{#if action.canUpdate && !locked && allowedActionTransitions(action.status).length}
								<div class="mt-2 flex flex-wrap gap-2">
									{#each allowedActionTransitions(action.status) as next (next)}
										<form method="POST" action="?/actionStatus" use:enhance><input type="hidden" name="actionId" value={action.id} /><input type="hidden" name="status" value={next} /><Button type="submit" size="sm" variant="outline">{actionStatusLabels[next]}</Button></form>
									{/each}
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
			{#if detail.canEdit && !locked}
				<form method="POST" action="?/addAction" use:enhance class="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4">
					<div class="md:col-span-4"><Field id="a-desc" label="Tindakan baru" errors={errorsOf(form, 'description')}>{#snippet children({ describedBy, invalid })}<Input id="a-desc" name="description" required value={form?.values?.description ?? ''} aria-invalid={invalid} aria-describedby={describedBy} />{/snippet}</Field></div>
					<div class="md:col-span-2"><Field id="a-pic" label="Penanggung jawab" errors={errorsOf(form, 'picUserId')}>{#snippet children({ describedBy, invalid })}<NativeSelect id="a-pic" name="picUserId" options={picOptions} placeholder="Pilih penanggung jawab" required {invalid} {describedBy} />{/snippet}</Field></div>
					<Field id="a-due" label="Tenggat" errors={errorsOf(form, 'dueDate')}>{#snippet children({ describedBy, invalid })}<Input id="a-due" name="dueDate" type="date" required aria-invalid={invalid} aria-describedby={describedBy} />{/snippet}</Field>
					<div class="flex items-end"><Button type="submit">Tambah tindakan</Button></div>
				</form>
			{/if}
		</section>

		<section aria-labelledby="evidence-heading" class="space-y-3">
			<h2 id="evidence-heading" class="text-lg font-semibold">Bukti tindak lanjut ({detail.evidence.length})</h2>
			{#if detail.evidence.length === 0}
				<EmptyState title="Belum ada bukti" description="Lampirkan tautan atau catatan sebagai bukti pelaksanaan tindakan." />
			{:else}
				<ul class="space-y-2">
					{#each detail.evidence as item (item.id)}
						<li class="rounded-lg border bg-card p-3 text-sm"><p class="font-medium">{item.title}</p>{#if item.url}<a class="break-all text-primary underline-offset-4 hover:underline" href={item.url} rel="noopener noreferrer" target="_blank">{item.url}</a>{/if}{#if item.note}<p class="text-muted-foreground">{item.note}</p>{/if}<p class="mt-1 text-xs text-muted-foreground">{item.addedByName} · {stamp.format(new Date(item.createdAt))}</p></li>
					{/each}
				</ul>
			{/if}
			{#if detail.canAddEvidence && !locked}
				<form method="POST" action="?/addEvidence" use:enhance class="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-2">
					<Field id="v-title" label="Judul bukti" errors={errorsOf(form, 'title')}>{#snippet children({ describedBy, invalid })}<Input id="v-title" name="title" required aria-invalid={invalid} aria-describedby={describedBy} />{/snippet}</Field>
					<Field id="v-url" label="Tautan (http/https)" errors={errorsOf(form, 'url')}>{#snippet children({ describedBy, invalid })}<Input id="v-url" name="url" type="url" placeholder="https://" aria-invalid={invalid} aria-describedby={describedBy} />{/snippet}</Field>
					<div class="md:col-span-2"><Field id="v-note" label="Catatan" errors={errorsOf(form, 'note')}>{#snippet children({ describedBy, invalid })}<Textarea id="v-note" name="note" rows={2} aria-invalid={invalid} aria-describedby={describedBy} />{/snippet}</Field></div>
					<Field id="v-action" label="Terkait tindakan (opsional)" errors={errorsOf(form, 'actionId')}>{#snippet children({ describedBy, invalid })}<NativeSelect id="v-action" name="actionId" options={actionOptions} placeholder="Tidak spesifik" {invalid} {describedBy} />{/snippet}</Field>
					<div class="flex items-end"><Button type="submit">Tambah bukti</Button></div>
				</form>
			{/if}
		</section>

		<section aria-labelledby="evaluation-heading" class="space-y-3">
			<h2 id="evaluation-heading" class="text-lg font-semibold">Evaluasi dampak ({detail.evaluations.length})</h2>
			{#if detail.evaluations.length === 0}
				<EmptyState title="Belum ada evaluasi" description={evaluationOpen ? 'Catat indikator sebelum dan sesudah tindakan.' : 'Evaluasi dicatat setelah semua tindakan selesai dan temuan masuk tahap Evaluasi.'} />
			{:else}
				<ul class="space-y-2">
					{#each detail.evaluations as item (item.id)}
						<li class="rounded-lg border bg-card p-3 text-sm"><p class="font-medium">{item.metricLabel}</p><p class="tabular-nums">Sebelum {formatValue(item.valueBefore)} → sesudah {formatValue(item.valueAfter)}</p><p class="text-muted-foreground">{item.conclusion}</p><p class="mt-1 text-xs text-muted-foreground">{item.evaluatedByName} · {stamp.format(new Date(item.evaluatedAt))}</p></li>
					{/each}
				</ul>
			{/if}
			{#if detail.canEdit && evaluationOpen}
				<form method="POST" action="?/addEvaluation" use:enhance class="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-3">
					<div class="md:col-span-3"><Field id="ev-metric" label="Indikator" errors={errorsOf(form, 'metricLabel')}>{#snippet children({ describedBy, invalid })}<Input id="ev-metric" name="metricLabel" required placeholder="Mis. Rasio ketercapaian CPMK-2" aria-invalid={invalid} aria-describedby={describedBy} />{/snippet}</Field></div>
					<Field id="ev-before" label="Nilai sebelum" errors={errorsOf(form, 'valueBefore')}>{#snippet children({ describedBy, invalid })}<Input id="ev-before" name="valueBefore" inputmode="decimal" aria-invalid={invalid} aria-describedby={describedBy} />{/snippet}</Field>
					<Field id="ev-after" label="Nilai sesudah" errors={errorsOf(form, 'valueAfter')}>{#snippet children({ describedBy, invalid })}<Input id="ev-after" name="valueAfter" inputmode="decimal" aria-invalid={invalid} aria-describedby={describedBy} />{/snippet}</Field>
					<div class="md:col-span-3"><Field id="ev-conclusion" label="Kesimpulan" errors={errorsOf(form, 'conclusion')}>{#snippet children({ describedBy, invalid })}<Textarea id="ev-conclusion" name="conclusion" rows={2} required aria-invalid={invalid} aria-describedby={describedBy} />{/snippet}</Field></div>
					<div><Button type="submit">Tambah evaluasi</Button></div>
				</form>
			{/if}
		</section>
	</div>

	{#if detail.canEdit}
		<aside aria-labelledby="flow-heading" class="space-y-3 lg:sticky lg:top-4 lg:self-start">
			<h2 id="flow-heading" class="text-lg font-semibold">Ubah status</h2>
			{#if detail.transitions.length === 0}
				<p class="text-sm text-muted-foreground">Status akhir; tidak dapat diubah lagi.</p>
			{:else}
				<ul class="space-y-2">
					{#each detail.transitions as step (step.to)}
						<li class="rounded-lg border bg-card p-3">
							<p class="text-sm font-medium">{statusLabels[step.to]}</p>
							{#if step.blockers.length}
								<ul class="mt-1 list-disc pl-5 text-xs text-muted-foreground">{#each step.blockers as blocker (blocker)}<li>{blocker}</li>{/each}</ul>
							{/if}
							<div class="mt-2">
								{#if step.to === 'cancelled'}
									<ConfirmForm action="?/transition" fields={{ to: step.to }} triggerLabel="Batalkan temuan" tone="destructive" title="Batalkan temuan ini?" description="Status Dibatalkan bersifat final dan temuan tidak dapat diubah lagi." confirmLabel="Batalkan temuan" />
								{:else}
									<form method="POST" action="?/transition" use:enhance><input type="hidden" name="to" value={step.to} /><Button type="submit" size="sm" variant={step.blockers.length ? 'outline' : 'default'}>Pindah ke {statusLabels[step.to]}</Button></form>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</aside>
	{/if}
</div>
