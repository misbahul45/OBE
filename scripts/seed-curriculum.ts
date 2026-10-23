import { createDb } from '#lib/shared/db/client.server.ts';
import { seedCourseCatalog } from '#lib/features/academic/index.server.ts';
import { seedProgramBlueprint } from '#lib/features/profiles/index.server.ts';

const url = process.env.DATABASE_URL;
if (!url) {
	console.error('Variabel lingkungan DATABASE_URL belum diatur');
	process.exit(1);
}

const overwrite = process.argv.includes('--overwrite');
const { client, db } = createDb(url);

try {
	const blueprint = await seedProgramBlueprint(db, { overwrite });
	const catalog = await seedCourseCatalog(db, { overwrite });
	const line = (label: string, value: { created: number; existing: number }) => console.log(`${label.padEnd(24)} dibuat ${value.created}, sudah ada ${value.existing}`);
	console.log(overwrite ? 'Kurikulum dimuat (mode timpa).' : 'Kurikulum dimuat (data yang sudah ada dipertahankan).');
	line('CPL', blueprint.cpl);
	line('Profil lulusan', blueprint.profiles);
	line('Bidang kerja', blueprint.fields);
	line('Tautan CPL-profil', blueprint.cplProfileLinks);
	line('Tautan profil-bidang', blueprint.profileFieldLinks);
	line('Mata kuliah', catalog);
	if (overwrite) console.log(`Mata kuliah diperbarui: ${catalog.updated}`);
} finally {
	await client.end();
}
