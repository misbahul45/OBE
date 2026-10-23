import { db } from '#lib/shared/db/index.server.ts';
import { batchPageActions, batchPageLoad } from '#lib/features/imports/index.server.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => batchPageLoad(db, event, 'super_admin');

export const actions: Actions = batchPageActions(db, 'super_admin');
