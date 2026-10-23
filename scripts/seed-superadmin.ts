import { ZodError } from 'zod';
import { createDb } from '#lib/shared/db/client.server.ts';
import { createAuth } from '#lib/features/auth/auth.factory.server.ts';
import { ensureSuperAdmin } from '#lib/features/auth/superadmin.service.server.ts';

function required(name: string): string {
	const value = process.env[name];
	if (!value) {
		console.error(`Variabel lingkungan ${name} belum diatur`);
		process.exit(1);
	}
	return value;
}

const { client, db } = createDb(required('DATABASE_URL'));
const auth = createAuth({ db, secret: required('BETTER_AUTH_SECRET'), baseURL: required('ORIGIN'), rateLimitEnabled: false });

try {
	const result = await ensureSuperAdmin(
		{ auth, db },
		{ email: required('SUPERADMIN_EMAIL'), name: process.env.SUPERADMIN_NAME ?? 'Super Admin', password: required('SUPERADMIN_PASSWORD') }
	);
	const messages = { created: 'Super Admin dibuat.', promoted: 'Akun yang ada dipromosikan menjadi Super Admin.', unchanged: 'Super Admin sudah ada; tidak ada perubahan.' };
	console.log(messages[result.status]);
} catch (error) {
	if (error instanceof ZodError) {
		console.error('Input Super Admin tidak valid:');
		for (const issue of error.issues) console.error(`- ${issue.path.join('.') || 'input'}: ${issue.message}`);
		process.exitCode = 1;
	} else {
		throw error;
	}
} finally {
	await client.end();
}
