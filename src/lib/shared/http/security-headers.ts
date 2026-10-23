export type SecurityHeaderOptions = { secure: boolean };

export function securityHeaders({ secure }: SecurityHeaderOptions): Record<string, string> {
	const headers: Record<string, string> = {
		'X-Content-Type-Options': 'nosniff',
		'X-Frame-Options': 'DENY',
		'Referrer-Policy': 'strict-origin-when-cross-origin',
		'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
		'Cross-Origin-Opener-Policy': 'same-origin',
		'Cross-Origin-Resource-Policy': 'same-origin'
	};
	if (secure) headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
	return headers;
}

export function applySecurityHeaders(headers: Headers, options: SecurityHeaderOptions): void {
	for (const [name, value] of Object.entries(securityHeaders(options))) if (!headers.has(name)) headers.set(name, value);
}
