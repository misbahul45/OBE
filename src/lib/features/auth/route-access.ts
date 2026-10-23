import { appRoles, homePathByRole, type AppRole } from './auth.roles.ts';

export type AccessDecision = { kind: 'allow' } | { kind: 'redirect'; location: string } | { kind: 'forbidden' };

type AccessUser = { role: AppRole | null; mustChangePassword: boolean } | null;

export const passwordChangePath = '/app/account/password';
export const logoutPath = '/app/logout';

const inSection = (pathname: string, section: string) => pathname === section || pathname.startsWith(`${section}/`);

export function sanitizeNextPath(value: string | null | undefined): string | null {
	if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
	return inSection(value.split('?')[0], '/app') ? value : null;
}

export function evaluateRouteAccess(pathname: string, user: AccessUser): AccessDecision {
	if (!inSection(pathname, '/app')) {
		if (pathname === '/login' && user?.role) return { kind: 'redirect', location: homePathByRole[user.role] };
		return { kind: 'allow' };
	}
	if (!user?.role) return { kind: 'redirect', location: `/login?next=${encodeURIComponent(pathname)}` };
	if (user.mustChangePassword && pathname !== passwordChangePath && pathname !== logoutPath)
		return { kind: 'redirect', location: passwordChangePath };
	if (pathname === '/app') return { kind: 'redirect', location: homePathByRole[user.role] };
	if (inSection(pathname, '/app/admin') && user.role !== appRoles.superAdmin) return { kind: 'forbidden' };
	if (inSection(pathname, '/app/lecturer') && user.role !== appRoles.lecturer) return { kind: 'forbidden' };
	return { kind: 'allow' };
}
