import { readFileSync } from 'node:fs';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { createDb } from '#lib/shared/db/client.server.ts';
import { ValidationError } from '#lib/shared/http/errors.ts';
import { createAuth } from '#lib/features/auth/auth.factory.server.ts';
import { user } from '#lib/features/auth/auth.schema.ts';
import { createLecturerAccount } from '#lib/features/lecturers/index.server.ts';

function required(name: string): string {
	const value = process.env[name];
	if (!value) {
		console.error(`Variabel lingkungan ${name} belum diatur`);
		process.exit(1);
	}
	return value;
}

function option(name: string): string {
	const index = process.argv.indexOf(name);
	const value = index >= 0 ? process.argv[index + 1] : undefined;
	if (!value) {
		console.error(`Opsi ${name} wajib diisi`);
		process.exit(1);
	}
	return value;
}

const roster = z.array(z.object({ name: z.string(), email: z.string() })).min(1);
const people = roster.parse(JSON.parse(readFileSync(option('--file'), 'utf8')));
const password = required('LECTURER_SEED_PASSWORD');
const actorEmail = option('--actor').toLowerCase();

const { client, db } = createDb(required('DATABASE_URL'));
const auth = createAuth({ db, secret: required('BETTER_AUTH_SECRET'), baseURL: required('ORIGIN'), rateLimitEnabled: false });

try {
	const [actor] = await db
		.select({ id: user.id, role: user.role })
		.from(user)
		.where(and(eq(user.email, actorEmail), eq(user.role, 'super_admin')))
		.limit(1);
	if (!actor) {
		console.error('Akun Super Admin untuk --actor tidak ditemukan');
		process.exit(1);
	}

	let created = 0;
	let existing = 0;
	let failed = 0;
	for (const person of people) {
		try {
			await createLecturerAccount({ auth, db }, { id: actor.id, role: String(actor.role) }, person, { password });
			created += 1;
		} catch (error) {
			if (error instanceof ValidationError && error.fieldErrors.email?.includes('Email sudah terdaftar')) {
				existing += 1;
			} else {
				failed += 1;
				const detail = error instanceof ValidationError ? JSON.stringify(error.fieldErrors) : String(error);
				console.error(`Gagal membuat ${person.email}: ${detail}`);
			}
		}
	}
	console.log(`Akun dosen: dibuat ${created}, sudah ada ${existing}, gagal ${failed}. Seluruh akun wajib mengganti kata sandi saat masuk pertama.`);
	if (failed > 0) process.exitCode = 1;
} finally {
	await client.end();
}
