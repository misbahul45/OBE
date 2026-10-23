import { accessibleOfferingIds } from '#lib/features/academic/index.server.ts';
import { requireUser } from '#lib/features/auth/index.server.ts';
import { downloadStudentTranscript, reportResponse } from '#lib/features/reports/index.server.ts';
import { db } from '#lib/shared/db/index.server.ts';
import { orNotFound } from '#lib/shared/http/action.server.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
	const user = requireUser(locals);
	const actor = { id: user.id, role: user.role };
	const scope = await accessibleOfferingIds(db, actor);
	return reportResponse(await orNotFound(() => downloadStudentTranscript(db, actor, scope, params.studentId)));
};
