import type { SessionInfo, SessionUser } from '#lib/features/auth/auth.types.ts';

declare global {
	namespace App {
		interface Locals {
			user: SessionUser | null;
			session: SessionInfo | null;
		}
	}
}

export {};
