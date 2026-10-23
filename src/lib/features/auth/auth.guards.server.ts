import { error } from '@sveltejs/kit';
import type { AppRole } from './auth.roles.ts';
import type { SessionUser } from './auth.types.ts';

type LocalsWithUser = { user: SessionUser | null };

export function requireUser(locals: LocalsWithUser): SessionUser {
	if (!locals.user) error(401, 'Sesi tidak ditemukan. Silakan masuk.');
	return locals.user;
}

export function requireRole(locals: LocalsWithUser, ...roles: AppRole[]): SessionUser {
	const current = requireUser(locals);
	if (!roles.includes(current.role)) error(403, 'Anda tidak memiliki akses ke halaman ini.');
	return current;
}
