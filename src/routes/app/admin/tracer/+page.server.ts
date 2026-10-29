import { tracerActions, tracerLoad } from '#lib/features/tracer/index.server.ts';
import { db } from '#lib/shared/db/index.server.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => tracerLoad(db, event);

export const actions: Actions = tracerActions(db);
