import { studentDirectoryActions, studentDirectoryLoad } from '#lib/features/students/index.server.ts';
import { db } from '#lib/shared/db/index.server.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => studentDirectoryLoad(db, event);

export const actions: Actions = studentDirectoryActions(db);
