import { offeringPageActions, offeringPageLoad } from '#lib/features/dashboard/index.server.ts';
import { db } from '#lib/shared/db/index.server.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => offeringPageLoad(db, event, 'lecturer');

export const actions: Actions = offeringPageActions(db, 'lecturer');
