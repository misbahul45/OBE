import { createAuth, type AuthFactoryConfig } from '#lib/features/auth/auth.factory.server.ts';
import type { Database } from '#lib/shared/db/client.server.ts';

export const testOrigin = 'http://127.0.0.1:4173';
export const testSecret = 'test-only-secret-0123456789-abcdefghijklmnopqrstuvwxyz';
export const strongPassword = 'Sintetik#Uji2026';

export function buildAuth(db: Database, overrides: Partial<AuthFactoryConfig> = {}) {
	return createAuth({ db, secret: testSecret, baseURL: testOrigin, rateLimitEnabled: false, ...overrides });
}

export type TestAuth = ReturnType<typeof buildAuth>;

export function jsonRequest(path: string, body: unknown, headers: Record<string, string> = {}): Request {
	return new Request(`${testOrigin}/api/auth${path}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', origin: testOrigin, ...headers },
		body: JSON.stringify(body)
	});
}

export async function signInViaHandler(auth: TestAuth, email: string, password: string, headers: Record<string, string> = {}) {
	const response = await auth.handler(jsonRequest('/sign-in/email', { email, password }, headers));
	const cookie = response.headers
		.getSetCookie()
		.map((entry) => entry.split(';')[0])
		.join('; ');
	return { response, cookie };
}
