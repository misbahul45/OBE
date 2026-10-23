import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const [feature, ...flags] = process.argv.slice(2);

if (!feature) {
	console.error('Pemakaian: bun run test:feature <fitur> [--e2e]');
	process.exit(1);
}

const kinds = ['unit', 'integration', ...(flags.includes('--e2e') ? ['e2e'] : [])];
let failed = 0;

for (const kind of kinds) {
	const dir = `tests/${kind}/${feature}`;
	if (!existsSync(dir)) {
		console.log(`[${kind}] ${feature}: tidak ada tes`);
		continue;
	}
	console.log(`\n=== ${kind.toUpperCase()} · ${feature} ===`);
	const command = kind === 'e2e' ? ['bunx', 'playwright', 'test', dir] : ['bun', 'test', dir];
	const result = spawnSync(command[0], command.slice(1), { stdio: 'inherit' });
	if (result.status !== 0) failed++;
}

process.exit(failed ? 1 : 0);
