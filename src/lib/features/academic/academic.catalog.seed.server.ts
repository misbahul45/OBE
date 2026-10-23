import { eq } from 'drizzle-orm';
import type { Database } from '#lib/shared/db/client.server.ts';
import { catalogDescription, courseCatalog } from './academic.course-catalog.ts';
import { courses } from './academic.schema.ts';

export type CatalogSeedResult = { created: number; existing: number; updated: number };

export async function seedCourseCatalog(db: Database, options: { overwrite?: boolean } = {}): Promise<CatalogSeedResult> {
	const overwrite = options.overwrite ?? false;
	return db.transaction(async (tx) => {
		const present = new Map((await tx.select({ code: courses.code, id: courses.id }).from(courses)).map((row) => [row.code, row.id]));
		let created = 0;
		let existing = 0;
		let updated = 0;
		for (const entry of courseCatalog) {
			const values = { code: entry.code, name: entry.name, credits: entry.credits, description: catalogDescription(entry) };
			const id = present.get(entry.code);
			if (!id) {
				await tx.insert(courses).values(values);
				created += 1;
			} else if (overwrite) {
				await tx.update(courses).set({ name: values.name, credits: values.credits, description: values.description }).where(eq(courses.id, id));
				updated += 1;
			} else {
				existing += 1;
			}
		}
		return { created, existing, updated };
	});
}
