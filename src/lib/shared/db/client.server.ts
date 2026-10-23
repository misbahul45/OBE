import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.ts';

export function connectionOptionsFor(url: string): postgres.Options<Record<string, postgres.PostgresType>> {
	return new URL(url).hostname.includes('-pooler') ? { prepare: false } : {};
}

export function createDb(url: string, options: postgres.Options<Record<string, postgres.PostgresType>> = {}) {
	const client = postgres(url, options);
	return { client, db: drizzle(client, { schema }) };
}

export type Database = ReturnType<typeof createDb>['db'];
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
export type DbExecutor = Database | Transaction;
