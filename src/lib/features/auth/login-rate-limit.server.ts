import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { Database } from '#lib/shared/db/client.server.ts';
import { rate_limit } from './auth.schema.ts';

export type RateWindow = { windowSeconds: number; max: number };
export type LoginRateLimitConfig = { perIp: RateWindow; perEmail: RateWindow };

export const defaultLoginRateLimit: LoginRateLimitConfig = {
	perIp: { windowSeconds: 60, max: 20 },
	perEmail: { windowSeconds: 60, max: 5 }
};

export type ConsumeResult = { allowed: boolean; count: number; retryAfterSeconds: number };

export async function consumeRateLimit(db: Database, key: string, window: RateWindow, now = Date.now()): Promise<ConsumeResult> {
	const windowMs = window.windowSeconds * 1000;
	const expired = sql`${rate_limit.lastRequest} < ${now - windowMs}`;
	const [row] = await db
		.insert(rate_limit)
		.values({ id: randomUUID(), key, count: 1, lastRequest: now })
		.onConflictDoUpdate({
			target: rate_limit.key,
			set: {
				count: sql`case when ${expired} then 1 else ${rate_limit.count} + 1 end`,
				lastRequest: sql`case when ${expired} then ${now}::bigint else ${rate_limit.lastRequest} end`
			}
		})
		.returning({ count: rate_limit.count, lastRequest: rate_limit.lastRequest });
	return {
		allowed: row.count <= window.max,
		count: row.count,
		retryAfterSeconds: Math.max(1, Math.ceil((row.lastRequest + windowMs - now) / 1000))
	};
}

export async function checkLoginRateLimit(db: Database, ip: string | null, email: string, config: LoginRateLimitConfig): Promise<ConsumeResult> {
	const byEmail = await consumeRateLimit(db, `login:email:${email}`, config.perEmail);
	const byIp = ip ? await consumeRateLimit(db, `login:ip:${ip}`, config.perIp) : { allowed: true, count: 0, retryAfterSeconds: 0 };
	return byEmail.allowed && byIp.allowed ? byEmail : { allowed: false, count: Math.max(byEmail.count, byIp.count), retryAfterSeconds: Math.max(byEmail.retryAfterSeconds, byIp.retryAfterSeconds) };
}
