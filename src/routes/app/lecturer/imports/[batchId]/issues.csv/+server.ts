import { db } from '#lib/shared/db/index.server.ts';
import { issuesCsvResponse } from '#lib/features/imports/index.server.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = (event) => issuesCsvResponse(db, event, 'lecturer');
