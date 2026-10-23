export type PostgresFailure = { code?: string; constraint?: string; message: string };

export async function expectDatabaseRejection(run: () => PromiseLike<unknown>): Promise<PostgresFailure> {
	try {
		await run();
	} catch (error) {
		const cause = ((error as { cause?: unknown }).cause ?? error) as { code?: string; constraint_name?: string; message?: string };
		return { code: cause.code, constraint: cause.constraint_name, message: String(cause.message ?? error) };
	}
	throw new Error('operasi seharusnya ditolak database tetapi berhasil');
}

export const pgCodes = {
	uniqueViolation: '23505',
	foreignKeyViolation: '23503',
	checkViolation: '23514',
	notNullViolation: '23502'
} as const;
