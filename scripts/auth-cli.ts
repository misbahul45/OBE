import { createAuth } from '../src/lib/features/auth/auth.factory.server.ts';

export const auth = createAuth({
	db: {} as never,
	secret: 'schema-generation-only-secret-0123456789',
	baseURL: 'http://127.0.0.1:5173'
});
