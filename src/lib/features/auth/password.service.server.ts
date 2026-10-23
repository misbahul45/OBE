import { eq } from 'drizzle-orm';
import { APIError } from 'better-auth/api';
import type { Database } from '#lib/shared/db/client.server.ts';
import { recordAudit } from '#lib/features/audit/index.server.ts';
import type { AppAuth } from './auth.factory.server.ts';
import { user } from './auth.schema.ts';
import type { SessionUser } from './auth.types.ts';
import { changePasswordSchema, fieldErrorsOf, type FieldErrors } from './auth.validation.ts';

export type ChangePasswordResult =
	| { status: 'success' }
	| { status: 'invalid_input'; fieldErrors: FieldErrors }
	| { status: 'wrong_current' }
	| { status: 'error' };

export async function changeOwnPassword(deps: { auth: AppAuth; db: Database }, actor: SessionUser, rawInput: unknown, headers: Headers): Promise<ChangePasswordResult> {
	const parsed = changePasswordSchema.safeParse(rawInput);
	if (!parsed.success) return { status: 'invalid_input', fieldErrors: fieldErrorsOf(parsed.error) };
	try {
		await deps.auth.api.changePassword({
			body: { currentPassword: parsed.data.currentPassword, newPassword: parsed.data.newPassword, revokeOtherSessions: true },
			headers
		});
	} catch (error) {
		if (error instanceof APIError) return { status: error.statusCode === 400 || error.statusCode === 401 ? 'wrong_current' : 'error' };
		return { status: 'error' };
	}
	await deps.db.update(user).set({ mustChangePassword: false }).where(eq(user.id, actor.id));
	await recordAudit(deps.db, {
		actorId: actor.id,
		actorRole: actor.role,
		action: 'auth.password.change',
		entityType: 'user',
		entityId: actor.id,
		summary: 'Pengguna mengganti password sendiri',
		before: { mustChangePassword: actor.mustChangePassword },
		after: { mustChangePassword: false }
	});
	return { status: 'success' };
}
