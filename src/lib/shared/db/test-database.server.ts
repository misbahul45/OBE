import postgres from 'postgres';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const loopbackHosts = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
const testDatabaseName = /^[a-z][a-z0-9_]*_test$/;
const suiteNamePattern = /^[a-z][a-z0-9_]{0,24}$/;
const isolatedDatabasePattern = /^obe_[a-z0-9_]+_[0-9a-f]{6}_test$/;
const templateLockKey = 424201;

export const templateDatabaseName = 'obe_template_test';

export class TestDatabaseGuardError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'TestDatabaseGuardError';
	}
}

export type IsolatedDatabase = { name: string; url: string; drop: () => Promise<void> };

export function assertTestDatabaseUrl(url: string): { name: string; adminUrl: string } {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		throw new TestDatabaseGuardError('URL database tidak valid');
	}
	if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:')
		throw new TestDatabaseGuardError('protokol database harus postgres atau postgresql');
	if (!loopbackHosts.has(parsed.hostname)) throw new TestDatabaseGuardError('host database test harus loopback');
	const name = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
	if (!testDatabaseName.test(name)) throw new TestDatabaseGuardError(`nama database "${name}" harus huruf kecil dan berakhiran _test`);
	const admin = new URL(parsed.toString());
	admin.pathname = '/postgres';
	return { name, adminUrl: admin.toString() };
}

export function withDatabaseName(url: string, name: string): string {
	const parsed = new URL(url);
	parsed.pathname = `/${name}`;
	return parsed.toString();
}

function openAdmin(url: string) {
	return postgres(assertTestDatabaseUrl(url).adminUrl, { max: 1, onnotice: () => {} });
}

function listFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		return statSync(path).isDirectory() ? listFiles(path) : [path];
	});
}

export function migrationsFingerprint(migrationsFolder = 'drizzle'): string {
	const dir = resolve(process.cwd(), migrationsFolder);
	if (!existsSync(dir)) return 'none';
	const hash = createHash('sha256');
	for (const file of listFiles(dir).sort()) {
		hash.update(relative(dir, file));
		hash.update(readFileSync(file));
	}
	return hash.digest('hex').slice(0, 16);
}

export async function migrateDatabase(url: string, migrationsFolder = 'drizzle'): Promise<boolean> {
	const folder = resolve(process.cwd(), migrationsFolder);
	if (!existsSync(resolve(folder, 'meta/_journal.json'))) return false;
	const client = postgres(url, { max: 1, onnotice: () => {} });
	try {
		await migrate(drizzle(client), { migrationsFolder: folder });
		return true;
	} finally {
		await client.end();
	}
}

export async function ensureTestDatabase(url: string, migrationsFolder = 'drizzle'): Promise<void> {
	const { name } = assertTestDatabaseUrl(url);
	const admin = openAdmin(url);
	try {
		const rows = await admin`select 1 from pg_database where datname = ${name}`;
		if (rows.length === 0) await admin.unsafe(`CREATE DATABASE "${name}"`);
	} finally {
		await admin.end();
	}
	await migrateDatabase(url, migrationsFolder);
}

export async function resetTestDatabase(url: string, migrationsFolder = 'drizzle'): Promise<void> {
	const { name } = assertTestDatabaseUrl(url);
	const admin = openAdmin(url);
	try {
		await admin.unsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
		await admin.unsafe(`CREATE DATABASE "${name}"`);
	} finally {
		await admin.end();
	}
	await migrateDatabase(url, migrationsFolder);
}

export async function dropDatabaseIfExists(url: string): Promise<void> {
	const { name } = assertTestDatabaseUrl(url);
	const admin = openAdmin(url);
	try {
		await admin.unsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
	} finally {
		await admin.end();
	}
}

async function dropStaleIsolatedDatabases(admin: postgres.Sql): Promise<void> {
	const rows = await admin<{ datname: string }[]>`select datname from pg_database where datname like 'obe\\_%\\_test'`;
	for (const { datname } of rows)
		if (isolatedDatabasePattern.test(datname)) await admin.unsafe(`DROP DATABASE IF EXISTS "${datname}" WITH (FORCE)`);
}

export async function ensureTemplateDatabase(baseUrl: string, migrationsFolder = 'drizzle'): Promise<boolean> {
	const templateUrl = withDatabaseName(baseUrl, templateDatabaseName);
	const fingerprint = migrationsFingerprint(migrationsFolder);
	const admin = openAdmin(templateUrl);
	try {
		await admin`select pg_advisory_lock(${templateLockKey})`;
		try {
			const [row] = await admin<{ comment: string | null }[]>`
				select shobj_description(oid, 'pg_database') as comment from pg_database where datname = ${templateDatabaseName}`;
			if (row?.comment === `fp:${fingerprint}`) return false;
			await dropStaleIsolatedDatabases(admin);
			await admin.unsafe(`DROP DATABASE IF EXISTS "${templateDatabaseName}" WITH (FORCE)`);
			await admin.unsafe(`CREATE DATABASE "${templateDatabaseName}"`);
			await migrateDatabase(templateUrl, migrationsFolder);
			await admin.unsafe(`COMMENT ON DATABASE "${templateDatabaseName}" IS 'fp:${fingerprint}'`);
			return true;
		} finally {
			await admin`select pg_advisory_unlock(${templateLockKey})`;
		}
	} finally {
		await admin.end();
	}
}

export async function cloneTemplateDatabase(baseUrl: string, suite: string, migrationsFolder = 'drizzle'): Promise<IsolatedDatabase> {
	if (!suiteNamePattern.test(suite)) throw new TestDatabaseGuardError(`nama suite "${suite}" tidak valid`);
	await ensureTemplateDatabase(baseUrl, migrationsFolder);
	const name = `obe_${suite}_${randomBytes(3).toString('hex')}_test`;
	const url = withDatabaseName(baseUrl, name);
	const admin = openAdmin(url);
	try {
		await admin`select pg_advisory_lock(${templateLockKey})`;
		try {
			await admin.unsafe(`CREATE DATABASE "${name}" TEMPLATE "${templateDatabaseName}"`);
		} finally {
			await admin`select pg_advisory_unlock(${templateLockKey})`;
		}
	} finally {
		await admin.end();
	}
	return { name, url, drop: () => dropDatabaseIfExists(url) };
}
