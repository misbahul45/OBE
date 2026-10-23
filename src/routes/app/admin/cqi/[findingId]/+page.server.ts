import { cqiDetailActions, cqiDetailLoad } from '#lib/features/cqi/index.server.ts';
import { db } from '#lib/shared/db/index.server.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => cqiDetailLoad(db, event, 'super_admin');

export const actions: Actions = cqiDetailActions(db, 'super_admin');
