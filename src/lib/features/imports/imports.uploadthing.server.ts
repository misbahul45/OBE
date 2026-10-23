import { createRouteHandler, createUploadthing, UploadThingError, UTFiles, type FileRouter } from 'uploadthing/server';
import { newFileRef } from './imports.storage.ts';

export type UploadActor = { id: string; role: string; mustChangePassword: boolean };

export type UploadAuthenticator = () => UploadActor | null | Promise<UploadActor | null>;

const allowedName = /\.(xlsx|csv)$/i;

export function createImportUploadHandler(options: { token: string; authenticate: UploadAuthenticator }) {
	const f = createUploadthing();
	const router = {
		importWorkbook: f({ blob: { maxFileSize: '16MB', maxFileCount: 1 } }, { awaitServerData: false })
			.middleware(async ({ files }) => {
				const actor = await options.authenticate();
				if (!actor || actor.mustChangePassword) throw new UploadThingError({ code: 'FORBIDDEN', message: 'Anda tidak berhak mengunggah berkas.' });
				if (files.some((file) => !allowedName.test(file.name))) throw new UploadThingError({ code: 'BAD_REQUEST', message: 'Hanya berkas .xlsx atau .csv yang diterima.' });
				return { [UTFiles]: files.map((file) => ({ ...file, customId: newFileRef(actor.id, crypto.randomUUID()) })) };
			})
			.onUploadComplete(() => undefined)
	} satisfies FileRouter;
	return createRouteHandler({ router, config: { token: options.token } });
}
