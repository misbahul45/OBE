import { redirect } from '@sveltejs/kit';
import type { Database } from '#lib/shared/db/client.server.ts';
import { formValues, orNotFound, pageParam, runAction } from '#lib/shared/http/action.server.ts';
import { listOfferings } from '#lib/features/academic/index.server.ts';
import { requireRole } from '#lib/features/auth/index.server.ts';
import type { AppRole, SessionUser } from '#lib/features/auth/index.ts';
import { listCpl } from '#lib/features/curriculum/index.server.ts';
import { listFindings, getFindingDetail, listPicOptions, type FindingFilters } from './cqi.queries.server.ts';
import { addAction, addEvaluation, addEvidence, createFinding, transitionFinding, updateActionStatus, updateFinding } from './cqi.service.server.ts';
import { cqiStatuses } from './cqi.workflow.ts';

type Locals = { user: SessionUser | null };
type Event = { request: Request; locals: Locals; params: { findingId: string } };

const actorOf = (locals: Locals, role: AppRole) => {
	const user = requireRole(locals, role);
	return { id: user.id, role: user.role };
};

export const cqiBasePath = (role: string) => (role === 'super_admin' ? '/app/admin/cqi' : '/app/lecturer/cqi');

export async function cqiListLoad(db: Database, { locals, url }: { locals: Locals; url: URL }, role: AppRole) {
	const actor = actorOf(locals, role);
	const statusParam = url.searchParams.get('status') ?? '';
	const search = url.searchParams.get('cari')?.trim() ?? '';
	const priority = url.searchParams.get('prioritas') ?? '';
	const filters: FindingFilters = {
		status: (cqiStatuses as readonly string[]).includes(statusParam) ? (statusParam as FindingFilters['status']) : undefined,
		priority: priority || undefined,
		search: search || undefined,
		page: pageParam(url),
		pageSize: 15
	};
	const list = await listFindings(db, actor, filters);
	const isAdmin = role === 'super_admin';
	const [offerings, cpl] = isAdmin ? await Promise.all([listOfferings(db, { pageSize: 100 }), listCpl(db)]) : [null, []];
	return {
		...list,
		query: { status: filters.status ?? '', priority, search },
		canCreate: isAdmin,
		offeringOptions: (offerings?.rows ?? []).map((o) => ({ id: o.id, label: `${o.courseCode} · ${o.courseName} — Kelas ${o.section} (${o.semesterName})` })),
		cplOptions: cpl.map((c) => ({ id: c.id, label: `${c.code} · ${c.title}` }))
	};
}

export function cqiListActions(db: Database, role: AppRole) {
	return {
		create: async ({ request, locals }: { request: Request; locals: Locals }) => {
			const actor = actorOf(locals, role);
			const data = await request.formData();
			const result = await runAction(() => createFinding(db, actor, Object.fromEntries(data)), formValues(data, ['title', 'description', 'priority', 'offeringId', 'cplId']));
			if (!result.ok) return result.failure;
			redirect(303, `${cqiBasePath(role)}/${result.value.id}`);
		}
	};
}

export async function cqiDetailLoad(db: Database, { locals, params }: { locals: Locals; params: { findingId: string } }, role: AppRole) {
	const actor = actorOf(locals, role);
	const detail = await orNotFound(() => getFindingDetail(db, actor, params.findingId));
	const pics = detail.canEdit ? await listPicOptions(db) : [];
	return { detail, pics };
}

export function cqiDetailActions(db: Database, role: AppRole) {
	return {
		update: async ({ request, locals, params }: Event) => {
			const actor = actorOf(locals, role);
			const data = await request.formData();
			const result = await runAction(() => updateFinding(db, actor, params.findingId, Object.fromEntries(data)), formValues(data, ['title', 'description', 'priority', 'rootCause']));
			return result.ok ? { success: 'Temuan disimpan.', area: 'finding' } : result.failure;
		},
		transition: async ({ request, locals, params }: Event) => {
			const actor = actorOf(locals, role);
			const data = await request.formData();
			const result = await runAction(() => transitionFinding(db, actor, params.findingId, data.get('to')));
			return result.ok ? { success: 'Status temuan diperbarui.', area: 'status' } : result.failure;
		},
		addAction: async ({ request, locals, params }: Event) => {
			const actor = actorOf(locals, role);
			const data = await request.formData();
			const result = await runAction(() => addAction(db, actor, params.findingId, Object.fromEntries(data)), formValues(data, ['description', 'picUserId', 'dueDate']));
			return result.ok ? { success: 'Tindakan ditambahkan.', area: 'action' } : result.failure;
		},
		actionStatus: async ({ request, locals }: Event) => {
			const actor = actorOf(locals, role);
			const data = await request.formData();
			const result = await runAction(() => updateActionStatus(db, actor, String(data.get('actionId') ?? ''), data.get('status')));
			return result.ok ? { success: 'Status tindakan diperbarui.', area: 'action' } : result.failure;
		},
		addEvidence: async ({ request, locals, params }: Event) => {
			const actor = actorOf(locals, role);
			const data = await request.formData();
			const result = await runAction(() => addEvidence(db, actor, params.findingId, Object.fromEntries(data)), formValues(data, ['title', 'url', 'note', 'actionId']));
			return result.ok ? { success: 'Bukti ditambahkan.', area: 'evidence' } : result.failure;
		},
		addEvaluation: async ({ request, locals, params }: Event) => {
			const actor = actorOf(locals, role);
			const data = await request.formData();
			const result = await runAction(() => addEvaluation(db, actor, params.findingId, Object.fromEntries(data)), formValues(data, ['metricLabel', 'valueBefore', 'valueAfter', 'conclusion']));
			return result.ok ? { success: 'Evaluasi ditambahkan.', area: 'evaluation' } : result.failure;
		}
	};
}
