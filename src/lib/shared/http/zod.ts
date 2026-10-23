import { z } from 'zod';
import { ValidationError, type FieldErrors } from './errors.ts';

export function fieldErrorsFrom(error: z.ZodError): FieldErrors {
	const out: FieldErrors = {};
	for (const issue of error.issues) (out[String(issue.path[0] ?? 'form')] ??= []).push(issue.message);
	return out;
}

export function parseOrThrow<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
	const parsed = schema.safeParse(input);
	if (!parsed.success) throw new ValidationError(fieldErrorsFrom(parsed.error));
	return parsed.data;
}

export const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max, `Maksimal ${max} karakter`)
		.transform((value) => (value === '' ? null : value))
		.nullish()
		.transform((value) => value ?? null);
