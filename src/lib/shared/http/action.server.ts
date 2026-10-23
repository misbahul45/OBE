import { error as httpError, fail, type ActionFailure } from '@sveltejs/kit';
import { ConflictError, NotFoundError, ValidationError, type FieldErrors } from './errors.ts';

export type FormFailure = { message?: string; fieldErrors?: FieldErrors; values?: Record<string, string> };

export type ActionOutcome<T> = { ok: true; value: T } | { ok: false; failure: ActionFailure<FormFailure> };

export async function runAction<T>(work: () => Promise<T>, values?: Record<string, string>): Promise<ActionOutcome<T>> {
	try {
		return { ok: true, value: await work() };
	} catch (error) {
		if (error instanceof ValidationError) return { ok: false, failure: fail(400, { message: error.message, fieldErrors: error.fieldErrors, values }) };
		if (error instanceof NotFoundError) return { ok: false, failure: fail(404, { message: error.message, values }) };
		if (error instanceof ConflictError) return { ok: false, failure: fail(409, { message: error.message, values }) };
		throw error;
	}
}

export function formValues(data: FormData, names: string[]): Record<string, string> {
	return Object.fromEntries(names.map((name) => [name, String(data.get(name) ?? '')]));
}

export function pageParam(url: URL, name = 'halaman'): number {
	const value = Number(url.searchParams.get(name));
	return Number.isInteger(value) && value > 0 ? value : 1;
}

export async function orNotFound<T>(work: () => Promise<T>): Promise<T> {
	try {
		return await work();
	} catch (error) {
		if (error instanceof NotFoundError) throw httpError(404, error.message);
		throw error;
	}
}
