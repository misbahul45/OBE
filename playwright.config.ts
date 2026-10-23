import { readFileSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

function readEnvFile(path: string): Record<string, string> {
	const values: Record<string, string> = {};
	for (const line of readFileSync(path, 'utf8').split('\n')) {
		const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
		if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, '');
	}
	return values;
}

const test = readEnvFile('.env.test');
const port = 4173;
const origin = `http://127.0.0.1:${port}`;

export default defineConfig({
	testDir: 'tests/e2e',
	outputDir: 'test-results/e2e',
	fullyParallel: false,
	workers: 1,
	retries: 0,
	timeout: 60_000,
	expect: { timeout: 10_000 },
	reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
	globalSetup: './tests/support/e2e/global-setup.ts',
	use: { baseURL: origin, trace: 'retain-on-failure', screenshot: 'only-on-failure', locale: 'id-ID', timezoneId: 'Asia/Jakarta' },
	webServer: {
		command: 'bun --env-file=.env.test run scripts/e2e-seed.ts && bun run build && bunx vite preview --host 127.0.0.1 --port 4173 --strictPort',
		url: origin,
		timeout: 300_000,
		reuseExistingServer: false,
		env: { DATABASE_URL: test.TEST_DATABASE_URL, TEST_DATABASE_URL: test.TEST_DATABASE_URL, ORIGIN: origin, BETTER_AUTH_SECRET: test.BETTER_AUTH_SECRET, UPLOADTHING_TOKEN: '' }
	},
	projects: [
		{ name: 'flows', testIgnore: /(a11y|responsive)\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
		{ name: 'a11y', testMatch: /a11y\.spec\.ts/, dependencies: ['flows'], use: { ...devices['Desktop Chrome'] } },
		{ name: 'mobile', testMatch: /responsive\.spec\.ts/, dependencies: ['flows'], use: { ...devices['Pixel 7'] } }
	]
});
