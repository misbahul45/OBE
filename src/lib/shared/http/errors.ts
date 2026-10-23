export type FieldErrors = Record<string, string[]>;

export class ValidationError extends Error {
	constructor(
		readonly fieldErrors: FieldErrors,
		message = 'Input tidak valid.'
	) {
		super(message);
		this.name = 'ValidationError';
	}
}

export class NotFoundError extends Error {
	constructor(message = 'Data tidak ditemukan.') {
		super(message);
		this.name = 'NotFoundError';
	}
}

export class ConflictError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ConflictError';
	}
}
