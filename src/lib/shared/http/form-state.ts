import type { FieldErrors } from './errors.ts';

export type FormState = {
	success?: string;
	message?: string;
	fieldErrors?: FieldErrors;
	values?: Record<string, string>;
	temporaryPassword?: string;
	temporaryEmail?: string;
} | null | undefined;

export const errorsOf = (form: FormState, field: string): string[] => form?.fieldErrors?.[field] ?? [];
