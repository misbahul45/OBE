import { describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { ZodError } from 'zod';
import { ensureSuperAdmin } from '#lib/features/auth/superadmin.service.server.ts';
import { auditLogs, user } from '#lib/shared/db/schema.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { buildAuth, signInViaHandler, strongPassword } from '../../support/auth.ts';

const ctx = useIsolatedDatabase('auth_seed');
const input = { email: 'Kaprodi@Uji.Invalid', name: 'Kaprodi Uji', password: strongPassword };

describe('ensureSuperAdmin', () => {
	test('membuat Super Admin pertama, email dinormalisasi, dan dapat login', async () => {
		const auth = buildAuth(ctx.db);
		const result = await ensureSuperAdmin({ auth, db: ctx.db }, input);
		expect(result.status).toBe('created');
		const [stored] = await ctx.db.select().from(user).where(eq(user.id, result.userId));
		expect(stored.email).toBe('kaprodi@uji.invalid');
		expect(stored.role).toBe('super_admin');
		expect(stored.mustChangePassword).toBe(false);
		expect((await signInViaHandler(auth, 'kaprodi@uji.invalid', strongPassword)).response.status).toBe(200);
	});

	test('dijalankan ulang bersifat idempotent dan tidak mengganti password', async () => {
		const auth = buildAuth(ctx.db);
		const second = await ensureSuperAdmin({ auth, db: ctx.db }, { ...input, password: 'Password#Lain2026' });
		expect(second.status).toBe('unchanged');
		expect((await ctx.db.select().from(user)).length).toBe(1);
		expect((await signInViaHandler(auth, 'kaprodi@uji.invalid', strongPassword)).response.status).toBe(200);
		expect((await signInViaHandler(auth, 'kaprodi@uji.invalid', 'Password#Lain2026')).response.status).toBe(401);
	});

	test('akun dosen yang dinonaktifkan dipromosikan dan diaktifkan kembali', async () => {
		const auth = buildAuth(ctx.db);
		const { user: lecturer } = await auth.api.createUser({ body: { email: 'promosi@uji.invalid', password: strongPassword, name: 'Calon Admin' } });
		await ctx.db.update(user).set({ banned: true }).where(eq(user.id, lecturer.id));
		const result = await ensureSuperAdmin({ auth, db: ctx.db }, { ...input, email: 'promosi@uji.invalid' });
		expect(result.status).toBe('promoted');
		const [stored] = await ctx.db.select().from(user).where(eq(user.id, lecturer.id));
		expect([stored.role, stored.banned]).toEqual(['super_admin', false]);
	});

	test('input tidak valid ditolak tanpa membocorkan password', async () => {
		const auth = buildAuth(ctx.db);
		const weak = 'lemah';
		const failure = await ensureSuperAdmin({ auth, db: ctx.db }, { email: 'x@uji.invalid', name: 'X Y', password: weak }).catch((error) => error);
		expect(failure).toBeInstanceOf(ZodError);
		expect(JSON.stringify(failure.issues)).toContain('Minimal 10 karakter');
		expect(JSON.stringify(failure.issues)).not.toContain(weak);
		await expect(ensureSuperAdmin({ auth, db: ctx.db }, { ...input, email: 'bukan-email' })).rejects.toBeInstanceOf(ZodError);
	});

	test('pembuatan dan promosi tercatat di audit tanpa password', async () => {
		const logs = await ctx.db.select().from(auditLogs);
		expect(logs.map((log) => log.action).sort()).toEqual(['auth.superadmin.created', 'auth.superadmin.promoted']);
		expect(JSON.stringify(logs)).not.toContain(strongPassword);
	});
});
