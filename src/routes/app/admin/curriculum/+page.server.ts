import { curriculumIndexActions, curriculumIndexLoad } from '#lib/features/curriculum/index.server.ts';
import { db } from '#lib/shared/db/index.server.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => curriculumIndexLoad(db, event);

export const actions: Actions = curriculumIndexActions(db);
