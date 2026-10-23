import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '#lib/shared/db/client.server.ts';
import { recordAudit } from '#lib/features/audit/index.server.ts';
import type { AppAuth } from './auth.factory.server.ts';
import { appRoles } from './auth.roles.ts';
import { user } from './auth.schema.ts';
import { passwordIssues } from './password-policy.ts';

export const superAdminInputSchema = z.object({
	email: z.email().transform((value) => value.trim().toLowerCase()),
	name: z.string().trim().min(2).max(120),
	password: z.string().superRefine((value, ctx) => {
		for (const message of passwordIssues(value)) ctx.addIssue({ code: 'custom', message });
	})
});

export type EnsureSuperAdminResult = { status: 'created' | 'promoted' | 'unchanged'; userId: string };

export async function ensureSuperAdmin(deps: { auth: AppAuth; db: Database }, rawInput: unknown): Promise<EnsureSuperAdminResult> {
	const input = superAdminInputSchema.parse(rawInput);
	const [existing] = await deps.db.select().from(user).where(eq(user.email, input.email)).limit(1);

	if (!existing) {
		const created = await deps.auth.api.createUser({
			body: { email: input.email, password: input.password, name: input.name, role: appRoles.superAdmin, data: { mustChangePassword: false } }
		});
		await recordAudit(deps.db, {
			actorId: null,
			actorRole: 'system',
			action: 'auth.superadmin.created',
			entityType: 'user',
			entityId: created.user.id,
			summary: 'Super Admin pertama dibuat lewat seed server-side',
			after: { email: input.email, role: appRoles.superAdmin }
		});
		return { status: 'created', userId: created.user.id };
	}

	if (existing.role !== appRoles.superAdmin || existing.banned) {
		await deps.db.update(user).set({ role: appRoles.superAdmin, banned: false, banReason: null, banExpires: null }).where(eq(user.id, existing.id));
		await recordAudit(deps.db, {
			actorId: null,
			actorRole: 'system',
			action: 'auth.superadmin.promoted',
			entityType: 'user',
			entityId: existing.id,
			summary: 'Akun yang ada dipromosikan menjadi Super Admin lewat seed server-side',
			before: { role: existing.role, banned: existing.banned },
			after: { role: appRoles.superAdmin, banned: false }
		});
		return { status: 'promoted', userId: existing.id };
	}

	return { status: 'unchanged', userId: existing.id };
}
