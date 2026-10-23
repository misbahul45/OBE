import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { defineConfig } from 'drizzle-kit';

const localEnv = existsSync('.env.local') ? parseEnv(readFileSync('.env.local', 'utf8')) : {};
const url = process.env.MIGRATE_DATABASE_URL ?? localEnv.DATABASE_URL ?? process.env.DATABASE_URL;

if (!url) throw new Error('DATABASE_URL atau MIGRATE_DATABASE_URL belum diatur');

export default defineConfig({
	schema: './src/lib/shared/db/schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: { url },
	verbose: true,
	strict: true
});
