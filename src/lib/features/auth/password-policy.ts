const minLength = 10;
const maxLength = 128;
const symbols = '!@#$%*-_=+?';
const lower = 'abcdefghijkmnpqrstuvwxyz';
const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const digits = '23456789';

export function passwordIssues(password: string): string[] {
	const issues: string[] = [];
	if (password.length < minLength) issues.push(`Minimal ${minLength} karakter`);
	if (password.length > maxLength) issues.push(`Maksimal ${maxLength} karakter`);
	if (!/[a-z]/.test(password)) issues.push('Harus memuat huruf kecil');
	if (!/[A-Z]/.test(password)) issues.push('Harus memuat huruf besar');
	if (!/[0-9]/.test(password)) issues.push('Harus memuat angka');
	if (!/[^A-Za-z0-9]/.test(password)) issues.push('Harus memuat simbol');
	return issues;
}

export const isStrongPassword = (password: string) => passwordIssues(password).length === 0;

function pick(alphabet: string, bytes: Uint8Array, index: number): string {
	return alphabet[bytes[index] % alphabet.length];
}

export function generateTemporaryPassword(length = 16): string {
	const size = Math.max(length, 12);
	const bytes = crypto.getRandomValues(new Uint8Array(size * 2));
	const all = lower + upper + digits + symbols;
	const chars = [pick(lower, bytes, 0), pick(upper, bytes, 1), pick(digits, bytes, 2), pick(symbols, bytes, 3)];
	for (let i = 4; i < size; i++) chars.push(pick(all, bytes, i));
	for (let i = chars.length - 1; i > 0; i--) {
		const j = bytes[size + i] % (i + 1);
		[chars[i], chars[j]] = [chars[j], chars[i]];
	}
	return chars.join('');
}
