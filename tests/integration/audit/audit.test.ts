import { describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { auditLogs } from '#lib/shared/db/schema.ts';
import { listAuditLogs, recordAudit } from '#lib/features/audit/index.server.ts';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { createUser } from '../../support/factories.ts';

const ctx = useIsolatedDatabase('audit_service');

describe('recordAudit', () => {
	test('menyimpan sebelum/sesudah dengan data sensitif disamarkan', async () => {
		const actor = await createUser(ctx.db, { name: 'Admin Uji' });
		await recordAudit(ctx.db, {
			actorId: actor.id,
			actorRole: 'super_admin',
			action: 'user.update',
			entityType: 'user',
			entityId: 'u-1',
			summary: 'Ubah akun',
			before: { email: 'a@uji.invalid', password: 'rahasia-lama', nested: { sessionToken: 'abc' } },
			after: { email: 'b@uji.invalid', passwordHash: 'xyz' }
		});
		const [row] = await ctx.db.select().from(auditLogs).where(eq(auditLogs.action, 'user.update'));
		expect(row.before).toEqual({ email: 'a@uji.invalid', password: '[disamarkan]', nested: { sessionToken: '[disamarkan]' } });
		expect(row.after).toEqual({ email: 'b@uji.invalid', passwordHash: '[disamarkan]' });
		expect(JSON.stringify(row)).not.toContain('rahasia-lama');
	});

	test('aktor sistem (tanpa pengguna) diperbolehkan', async () => {
		await recordAudit(ctx.db, { actorId: null, actorRole: 'system', action: 'system.seed', entityType: 'system', summary: 'Seed' });
		const [row] = await ctx.db.select().from(auditLogs).where(eq(auditLogs.action, 'system.seed'));
		expect(row.actorId).toBeNull();
		expect(row.before).toBeNull();
	});

	test('dapat berjalan di dalam transaksi dan ikut dibatalkan bersamanya', async () => {
		const failing = ctx.db.transaction(async (tx) => {
			await recordAudit(tx, { actorId: null, action: 'tx.rollback', entityType: 'system', summary: 'harus hilang' });
			throw new Error('batal');
		});
		await expect(failing).rejects.toThrow('batal');
		expect((await ctx.db.select().from(auditLogs).where(eq(auditLogs.action, 'tx.rollback'))).length).toBe(0);
	});
});

describe('listAuditLogs', () => {
	test('paginasi sisi server, urutan terbaru dulu, dan total akurat', async () => {
		const actor = await createUser(ctx.db, { name: 'Pelaku Daftar' });
		for (let i = 1; i <= 7; i++) await recordAudit(ctx.db, { actorId: actor.id, action: 'list.item', entityType: 'demo', entityId: String(i), summary: `Entri ${i}` });
		const first = await listAuditLogs(ctx.db, { action: 'list.item', pageSize: 3, page: 1 });
		const last = await listAuditLogs(ctx.db, { action: 'list.item', pageSize: 3, page: 3 });
		expect(first).toMatchObject({ total: 7, pageCount: 3, pageSize: 3 });
		expect(first.rows.map((r) => r.entityId)).toEqual(['7', '6', '5']);
		expect(last.rows.map((r) => r.entityId)).toEqual(['1']);
		expect(first.rows[0].actorName).toBe('Pelaku Daftar');
	});

	test('filter entitas, aktor, dan pencarian teks yang aman terhadap karakter wildcard', async () => {
		const a = await createUser(ctx.db);
		const b = await createUser(ctx.db);
		await recordAudit(ctx.db, { actorId: a.id, action: 'x.a', entityType: 'alpha', summary: 'diskon 100% penuh' });
		await recordAudit(ctx.db, { actorId: b.id, action: 'x.b', entityType: 'beta', summary: 'diskon 100 penuh' });
		expect((await listAuditLogs(ctx.db, { entityType: 'alpha' })).rows.map((r) => r.action)).toEqual(['x.a']);
		expect((await listAuditLogs(ctx.db, { actorId: b.id })).rows.map((r) => r.action)).toEqual(['x.b']);
		expect((await listAuditLogs(ctx.db, { search: '100%' })).rows.map((r) => r.action)).toEqual(['x.a']);
		expect((await listAuditLogs(ctx.db, { search: '%' })).total).toBe(1);
	});

	test('ukuran halaman dibatasi dan halaman tidak valid dinormalisasi', async () => {
		const result = await listAuditLogs(ctx.db, { pageSize: 100000, page: -5 });
		expect(result.pageSize).toBe(100);
		expect(result.page).toBe(1);
	});
});
