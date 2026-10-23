export type PostgresFailure = { code: string | null; constraint: string | null };

export function postgresFailureOf(error: unknown): PostgresFailure {
	const cause = ((error as { cause?: unknown })?.cause ?? error) as { code?: string; constraint_name?: string } | null;
	return { code: cause?.code ?? null, constraint: cause?.constraint_name ?? null };
}

export const isUniqueViolation = (error: unknown, constraint?: string) => {
	const failure = postgresFailureOf(error);
	return failure.code === '23505' && (constraint === undefined || failure.constraint === constraint);
};

export const isForeignKeyViolation = (error: unknown) => postgresFailureOf(error).code === '23503';
