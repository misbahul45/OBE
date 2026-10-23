const sensitiveKey = /password|passwd|token|secret|cookie|authorization|hash|salt|otp/i;
const masked = '[disamarkan]';

export function redactSensitive(value: unknown, depth = 0): unknown {
	if (value === null || value === undefined) return value;
	if (depth > 6) return masked;
	if (Array.isArray(value)) return value.map((item) => redactSensitive(item, depth + 1));
	if (value instanceof Date) return value.toISOString();
	if (typeof value === 'object') {
		const out: Record<string, unknown> = {};
		for (const [key, item] of Object.entries(value as Record<string, unknown>)) out[key] = sensitiveKey.test(key) ? masked : redactSensitive(item, depth + 1);
		return out;
	}
	return value;
}

export function maskNim(nim: string): string {
	if (nim.length <= 4) return '*'.repeat(nim.length);
	return `${'*'.repeat(nim.length - 4)}${nim.slice(-4)}`;
}
