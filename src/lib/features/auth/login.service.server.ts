import { APIError } from 'better-auth/api';
import type { Database } from '#lib/shared/db/client.server.ts';
import type { AppAuth } from './auth.factory.server.ts';
import { isAppRole, type AppRole } from './auth.roles.ts';
import { fieldErrorsOf, loginInputSchema, type FieldErrors } from './auth.validation.ts';
import { checkLoginRateLimit, defaultLoginRateLimit, type LoginRateLimitConfig } from './login-rate-limit.server.ts';

export type LoginResult =
	| { status: 'success'; role: AppRole; mustChangePassword: boolean }
	| { status: 'invalid_input'; fieldErrors: FieldErrors }
	| { status: 'invalid_credentials' }
	| { status: 'disabled'; message: string }
	| { status: 'rate_limited'; retryAfterSeconds: number }
	| { status: 'error' };

export type LoginContext = {
	headers: Headers;
	ip: string | null;
	rateLimit?: LoginRateLimitConfig | false;
};

export async function attemptLogin(deps: { auth: AppAuth; db: Database }, rawInput: unknown, context: LoginContext): Promise<LoginResult> {
	const parsed = loginInputSchema.safeParse(rawInput);
	if (!parsed.success) return { status: 'invalid_input', fieldErrors: fieldErrorsOf(parsed.error) };

	if (context.rateLimit !== false) {
		const limit = await checkLoginRateLimit(deps.db, context.ip, parsed.data.email, context.rateLimit ?? defaultLoginRateLimit);
		if (!limit.allowed) return { status: 'rate_limited', retryAfterSeconds: limit.retryAfterSeconds };
	}

	try {
		const result = await deps.auth.api.signInEmail({ body: parsed.data, headers: context.headers });
		const role = (result.user as { role?: string | null }).role;
		if (!isAppRole(role)) return { status: 'invalid_credentials' };
		return { status: 'success', role, mustChangePassword: Boolean((result.user as { mustChangePassword?: boolean }).mustChangePassword) };
	} catch (error) {
		if (error instanceof APIError) {
			if (error.statusCode === 429) return { status: 'rate_limited', retryAfterSeconds: 60 };
			const code = (error.body as { code?: string } | undefined)?.code;
			if (code === 'BANNED_USER' || error.statusCode === 403) return { status: 'disabled', message: 'Akun dinonaktifkan. Hubungi Super Admin.' };
			return { status: 'invalid_credentials' };
		}
		return { status: 'error' };
	}
}
