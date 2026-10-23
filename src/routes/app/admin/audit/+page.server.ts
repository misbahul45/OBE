import { auditPageLoad } from '#lib/features/audit/index.server.ts';
import { db } from '#lib/shared/db/index.server.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => auditPageLoad(db, event);
