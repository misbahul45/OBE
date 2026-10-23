import { profilesIndexLoad } from '#lib/features/profiles/index.server.ts';
import { db } from '#lib/shared/db/index.server.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => profilesIndexLoad(db, event);
