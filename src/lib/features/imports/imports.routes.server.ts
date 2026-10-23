import type { Database } from '#lib/shared/db/client.server.ts';
import { orNotFound, pageParam } from '#lib/shared/http/action.server.ts';
import { requireRole } from '#lib/features/auth/index.server.ts';
import type { AppRole, SessionUser } from '#lib/features/auth/index.ts';
import { safeReportFileName } from '#lib/features/reports/reports.types.ts';
import { autoMapAction, cancelAction, commitAction, dryRunAction, loadBatchPage, reanalyzeAction, saveMappingAction, saveSheetAction, uploadAction, uploadStoredAction } from './imports.pages.server.ts';
import { createUploadThingStorage, type FileStorage } from './imports.storage.server.ts';
import { fail } from '@sveltejs/kit';
import { buildIssuesCsv, listBatches } from './imports.queries.server.ts';
import { batchStatusLabel } from './imports.labels.ts';

type Locals = { user: SessionUser | null };
type StatusFilter = NonNullable<NonNullable<Parameters<typeof listBatches>[2]>['status']>;

const actorOf = (locals: Locals, role: AppRole) => {
	const user = requireRole(locals, role);
	return { id: user.id, role: user.role };
};

export async function historyLoad(db: Database, { locals, url }: { locals: Locals; url: URL }, role: AppRole) {
	const actor = actorOf(locals, role);
	const search = url.searchParams.get('cari')?.trim() ?? '';
	const statusParam = url.searchParams.get('status') ?? '';
	const status = statusParam in batchStatusLabel ? (statusParam as StatusFilter) : undefined;
	const list = await listBatches(db, actor, { search: search || undefined, status, page: pageParam(url), pageSize: 15 });
	return { ...list, search, status: status ?? '', cancelled: url.searchParams.get('dibatalkan') === '1' };
}

export function importStorage(token: string | undefined): FileStorage | null {
	return token ? createUploadThingStorage({ token }) : null;
}

export const uploadModeOf = (storage: FileStorage | null) => (storage ? ('storage' as const) : ('direct' as const));

export function uploadActions(db: Database, role: AppRole, storage: FileStorage | null = null) {
	return {
		upload: ({ request, locals }: { request: Request; locals: Locals }) => uploadAction(db, actorOf(locals, role), request),
		uploadStored: ({ request, locals }: { request: Request; locals: Locals }) => {
			const actor = actorOf(locals, role);
			return storage ? uploadStoredAction(db, actor, request, storage) : fail(400, { message: 'Penyimpanan unggahan belum diaktifkan.' });
		}
	};
}

export async function batchPageLoad(db: Database, { locals, params, url }: { locals: Locals; params: { batchId: string }; url: URL }, role: AppRole) {
	const actor = actorOf(locals, role);
	const page = await orNotFound(() => loadBatchPage(db, actor, params.batchId));
	return { page, duplicate: url.searchParams.get('duplikat') === '1', done: url.searchParams.get('selesai') };
}

export function batchPageActions(db: Database, role: AppRole) {
	type Event = { request: Request; locals: Locals; params: { batchId: string } };
	return {
		saveSheet: ({ request, locals, params }: Event) => saveSheetAction(db, actorOf(locals, role), params.batchId, request),
		saveMapping: ({ request, locals, params }: Event) => saveMappingAction(db, actorOf(locals, role), params.batchId, request),
		autoMap: ({ locals, params }: Event) => autoMapAction(db, actorOf(locals, role), params.batchId),
		reanalyze: ({ request, locals, params }: Event) => reanalyzeAction(db, actorOf(locals, role), params.batchId, request),
		dryRun: ({ request, locals, params }: Event) => dryRunAction(db, actorOf(locals, role), params.batchId, request),
		commit: ({ request, locals, params }: Event) => commitAction(db, actorOf(locals, role), params.batchId, request),
		cancel: ({ locals, params }: Event) => cancelAction(db, actorOf(locals, role), params.batchId)
	};
}

export async function issuesCsvResponse(db: Database, { locals, params }: { locals: Locals; params: { batchId: string } }, role: AppRole) {
	const actor = actorOf(locals, role);
	const csv = await orNotFound(() => buildIssuesCsv(db, actor, params.batchId));
	const fileName = safeReportFileName(['catatan-impor', params.batchId.slice(0, 8)], 'csv');
	return new Response(csv, {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="${fileName}"`,
			'cache-control': 'no-store',
			'x-content-type-options': 'nosniff'
		}
	});
}
