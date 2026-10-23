import { ORIGIN, BETTER_AUTH_SECRET, AUTH_RATE_LIMIT_ENABLED } from '$app/env/private';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { db } from '#lib/shared/db/index.server.ts';
import { createAuth } from './auth.factory.server.ts';

export const auth = createAuth({
	db,
	secret: BETTER_AUTH_SECRET,
	baseURL: ORIGIN,
	rateLimitEnabled: AUTH_RATE_LIMIT_ENABLED,
	plugins: [sveltekitCookies(getRequestEvent)]
});
