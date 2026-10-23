import { db } from '#lib/shared/db/index.server.ts';
import { historyLoad } from '#lib/features/imports/index.server.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => historyLoad(db, event, 'lecturer');
