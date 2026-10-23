import { requireRole } from '#lib/features/auth/index.server.ts';
import { downloadClassReport, reportResponse } from '#lib/features/reports/index.server.ts';
import { db } from '#lib/shared/db/index.server.ts';
import { orNotFound } from '#lib/shared/http/action.server.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
	const user = requireRole(locals, 'super_admin');
	return reportResponse(await orNotFound(() => downloadClassReport(db, { id: user.id, role: user.role }, params.offeringId)));
};
