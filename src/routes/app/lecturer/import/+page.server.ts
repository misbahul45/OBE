import { UPLOADTHING_TOKEN } from '$app/env/private';
import { db } from '#lib/shared/db/index.server.ts';
import { importStorage, uploadActions, uploadModeOf } from '#lib/features/imports/index.server.ts';
import type { Actions, PageServerLoad } from './$types';

const storage = importStorage(UPLOADTHING_TOKEN);

export const load: PageServerLoad = () => ({ uploadMode: uploadModeOf(storage) });

export const actions: Actions = uploadActions(db, 'lecturer', storage);
