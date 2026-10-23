import { error, redirect } from '@sveltejs/kit';
import { sequence, type Handle } from '@sveltejs/kit/hooks';
import { building } from '$app/env';
import { ORIGIN } from '$app/env/private';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { auth } from '#lib/features/auth/auth.server.ts';
import { isAppRole } from '#lib/features/auth/auth.roles.ts';
import { evaluateRouteAccess } from '#lib/features/auth/route-access.ts';
import { applySecurityHeaders } from '#lib/shared/http/security-headers.ts';

const handleSession: Handle = async ({ event, resolve }) => {
	event.locals.user = null;
	event.locals.session = null;
	const result = await auth.api.getSession({ headers: event.request.headers });
	if (result && !result.user.banned && isAppRole(result.user.role)) {
		event.locals.user = {
			id: result.user.id,
			name: result.user.name,
			email: result.user.email,
			role: result.user.role,
			mustChangePassword: Boolean(result.user.mustChangePassword)
		};
		event.locals.session = { id: result.session.id, expiresAt: result.session.expiresAt };
	}
	return resolve(event);
};

const handleAccess: Handle = ({ event, resolve }) => {
	const decision = evaluateRouteAccess(event.url.pathname, event.locals.user);
	if (decision.kind === 'redirect') redirect(303, decision.location);
	if (decision.kind === 'forbidden') error(403, 'Anda tidak memiliki akses ke halaman ini.');
	return resolve(event);
};

const handleAuthApi: Handle = ({ event, resolve }) => svelteKitHandler({ event, resolve, auth, building });

const handleHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	applySecurityHeaders(response.headers, { secure: ORIGIN.startsWith('https://') });
	return response;
};

export const handle: Handle = sequence(handleHeaders, handleSession, handleAccess, handleAuthApi);
