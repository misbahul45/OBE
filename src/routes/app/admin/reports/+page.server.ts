import { reportsPageLoad } from '#lib/features/reports/index.server.ts';
import { db } from '#lib/shared/db/index.server.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => reportsPageLoad(db, event);
