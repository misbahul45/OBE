import { describe, expect, test } from 'bun:test';
import { useIsolatedDatabase } from '../../support/integration.ts';
import { buildAuth, signInViaHandler, strongPassword } from '../../support/auth.ts';

const ctx = useIsolatedDatabase('auth_ratelimit');

describe('pembatasan laju login', () => {
	test('percobaan berulang dari IP yang sama dibatasi setelah ambang', async () => {
		const auth = buildAuth(ctx.db, { rateLimitEnabled: true, loginRateLimit: { window: 60, max: 3 } });
		await auth.api.createUser({ body: { email: 'laju@uji.invalid', password: strongPassword, name: 'Uji Laju' } });
		const headers = { 'x-forwarded-for': '203.0.113.7' };
		const statuses: number[] = [];
		for (let i = 0; i < 5; i++) statuses.push((await signInViaHandler(auth, 'laju@uji.invalid', 'Salah#Password99', headers)).response.status);
		expect(statuses.slice(0, 3).every((status) => status === 401)).toBe(true);
		expect(statuses.slice(3).every((status) => status === 429)).toBe(true);
	});

	test('IP lain tidak ikut terblokir', async () => {
		const auth = buildAuth(ctx.db, { rateLimitEnabled: true, loginRateLimit: { window: 60, max: 3 } });
		const other = await signInViaHandler(auth, 'laju@uji.invalid', strongPassword, { 'x-forwarded-for': '203.0.113.99' });
		expect(other.response.status).toBe(200);
	});
});
