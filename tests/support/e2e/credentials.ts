import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type Account = { email: string; password: string; name: string };

export type E2eState = {
	admin: Account;
	lecturerA: Account;
	lecturerB: Account;
	ids: { offeringA: string; offeringB: string; courseA: string; courseB: string };
};

export const stateDirectory = resolve(process.cwd(), '.e2e-state');
export const credentialsPath = resolve(stateDirectory, 'credentials.json');

export const storagePath = (role: 'admin' | 'lecturerA' | 'lecturerB') => resolve(stateDirectory, `${role}.json`);

export const e2eOrigin = 'http://127.0.0.1:4173';

export function readState(): E2eState {
	return JSON.parse(readFileSync(credentialsPath, 'utf8')) as E2eState;
}
