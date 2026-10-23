import { cqiListActions, cqiListLoad } from '#lib/features/cqi/index.server.ts';
import { db } from '#lib/shared/db/index.server.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => cqiListLoad(db, event, 'lecturer');

export const actions: Actions = cqiListActions(db, 'lecturer');
