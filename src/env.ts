import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	DATABASE_URL: { description: 'Connection string PostgreSQL.' },
	ORIGIN: { description: 'Origin publik aplikasi, misalnya http://127.0.0.1:5173.' },
	BETTER_AUTH_SECRET: { description: 'Secret penanda token Better Auth. Produksi: minimal 32 karakter acak.' },
	UPLOADTHING_TOKEN: {
		description: 'Token UploadThing untuk unggah berkas langsung dari browser. Kosong berarti unggahan memakai jalur langsung ke server.',
		schema: (value) => (value === undefined || value.trim().length < 20 ? undefined : value.trim())
	},
	AUTH_RATE_LIMIT_ENABLED: {
		description: 'Aktifkan pembatasan laju login. Default true.',
		schema: (value) => value === undefined || value === '' || value === 'true'
	}
});
