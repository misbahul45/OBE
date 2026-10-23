import type { AppRole } from './auth.roles.ts';

export type SessionUser = {
	id: string;
	name: string;
	email: string;
	role: AppRole;
	mustChangePassword: boolean;
};

export type SessionInfo = {
	id: string;
	expiresAt: Date;
};

export type OwnProfile = {
	name: string;
	email: string;
	role: AppRole;
	createdAt: Date;
	mustChangePassword: boolean;
	activeSessions: number;
	lecturer: { lecturerCode: string | null; nidn: string | null; activeClasses: number } | null;
};
