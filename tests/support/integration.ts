import { afterAll, beforeAll } from 'bun:test';
import { createDb, type Database } from '#lib/shared/db/client.server.ts';
import { cloneTemplateDatabase, type IsolatedDatabase } from '#lib/shared/db/test-database.server.ts';

export function requireTestDatabaseUrl(): string {
	const url = process.env.TEST_DATABASE_URL;
	if (!url) throw new Error('TEST_DATABASE_URL belum diatur (dimuat dari .env.test oleh bun test)');
	return url;
}

export function useIsolatedDatabase(suite: string) {
	let isolated: IsolatedDatabase | undefined;
	let connection: ReturnType<typeof createDb> | undefined;

	beforeAll(async () => {
		isolated = await cloneTemplateDatabase(requireTestDatabaseUrl(), suite);
		connection = createDb(isolated.url, { max: 5, onnotice: () => {} });
	});

	afterAll(async () => {
		await connection?.client.end();
		await isolated?.drop();
	});

	const ready = () => {
		if (!connection || !isolated) throw new Error('database suite belum siap; akses setelah beforeAll');
		return { connection, isolated };
	};

	return {
		get db(): Database {
			return ready().connection.db;
		},
		get url(): string {
			return ready().isolated.url;
		},
		get name(): string {
			return ready().isolated.name;
		}
	};
}
