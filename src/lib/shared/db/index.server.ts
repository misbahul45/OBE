import { DATABASE_URL } from '$app/env/private';
import { connectionOptionsFor, createDb, type Database } from './client.server.ts';

let instance: ReturnType<typeof createDb> | undefined;

export function getDb(): Database {
	instance ??= createDb(DATABASE_URL, connectionOptionsFor(DATABASE_URL));
	return instance.db;
}

export const db: Database = new Proxy({} as Database, {
	get: (_target, prop) => Reflect.get(getDb() as object, prop)
});

export type { Database, DbExecutor, Transaction } from './client.server.ts';
