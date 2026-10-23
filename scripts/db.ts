import {
	ensureTemplateDatabase,
	ensureTestDatabase,
	resetTestDatabase,
	TestDatabaseGuardError
} from '#lib/shared/db/test-database.server.ts';

const [command] = process.argv.slice(2);
const url = process.env.TEST_DATABASE_URL;

if (!url) {
	console.error('TEST_DATABASE_URL belum diatur');
	process.exit(1);
}

try {
	if (command === 'test-reset') {
		await resetTestDatabase(url);
		console.log('Database test direset lalu dimigrasi.');
	} else if (command === 'test-ensure') {
		await ensureTestDatabase(url);
		console.log('Database test tersedia dan termigrasi.');
	} else if (command === 'test-template') {
		const rebuilt = await ensureTemplateDatabase(url);
		console.log(rebuilt ? 'Template database tes dibangun ulang.' : 'Template database tes sudah mutakhir.');
	} else {
		console.log('Perintah: test-reset | test-ensure | test-template');
		process.exit(1);
	}
} catch (error) {
	if (error instanceof TestDatabaseGuardError) {
		console.error(`DITOLAK oleh guard database test: ${error.message}`);
		process.exit(2);
	}
	throw error;
}
