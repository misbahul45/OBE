import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin } from 'better-auth/plugins';
import { adminAc, userAc } from 'better-auth/plugins/admin/access';
import type { BetterAuthPlugin } from 'better-auth';
import { appRoles } from './auth.roles.ts';

export type AuthFactoryConfig = {
	db: Parameters<typeof drizzleAdapter>[0];
	secret: string;
	baseURL: string;
	rateLimitEnabled?: boolean;
	loginRateLimit?: { window: number; max: number };
	plugins?: BetterAuthPlugin[];
};

export function createAuth(config: AuthFactoryConfig) {
	const loginRateLimit = config.loginRateLimit ?? { window: 60, max: 5 };
	return betterAuth({
		baseURL: config.baseURL,
		secret: config.secret,
		trustedOrigins: [config.baseURL],
		database: drizzleAdapter(config.db, { provider: 'pg' }),
		emailAndPassword: {
			enabled: true,
			disableSignUp: true,
			minPasswordLength: 10,
			maxPasswordLength: 128,
			autoSignIn: false,
			revokeSessionsOnPasswordReset: true
		},
		user: {
			additionalFields: {
				mustChangePassword: { type: 'boolean', required: false, defaultValue: false, input: false }
			}
		},
		session: { expiresIn: 60 * 60 * 12, updateAge: 60 * 30 },
		rateLimit: {
			enabled: config.rateLimitEnabled ?? true,
			window: 60,
			max: 120,
			storage: 'database',
			modelName: 'rate_limit',
			customRules: { '/sign-in/email': loginRateLimit }
		},
		plugins: [
			admin({
				defaultRole: appRoles.lecturer,
				adminRoles: [appRoles.superAdmin],
				roles: { [appRoles.superAdmin]: adminAc, [appRoles.lecturer]: userAc },
				bannedUserMessage: 'Akun dinonaktifkan. Hubungi Super Admin.'
			}),
			...(config.plugins ?? [])
		]
	});
}

export type AppAuth = ReturnType<typeof createAuth>;
