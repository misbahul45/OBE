import { UPLOADTHING_TOKEN } from '$app/env/private';
import { createImportUploadHandler } from '#lib/features/imports/index.server.ts';
import type { RequestHandler } from './$types';

const respond: RequestHandler = (event) => {
	if (!UPLOADTHING_TOKEN) return new Response('Unggahan lewat penyimpanan tidak diaktifkan.', { status: 404 });
	const handler = createImportUploadHandler({ token: UPLOADTHING_TOKEN, authenticate: () => event.locals.user });
	return handler(event.request);
};

export const GET = respond;
export const POST = respond;
