import ts from 'typescript';
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';

type Range = { start: number; end: number };
type Problem = { file: string; line: number; rule: string; message: string };

const root = resolve(import.meta.dir, '..');
const fix = process.argv.includes('--fix');
const mode = process.argv.find((a) => a === 'comments' || a === 'structure' || a === 'tests') ?? 'all';

const scanTargets = ['src', 'scripts', 'tests', 'drizzle', 'drizzle.config.ts', 'vite.config.ts', 'playwright.config.ts', 'docker-compose.dev.yml'];
const skipDirs = new Set(['node_modules', '.svelte-kit', 'build', 'dist', 'test-results', 'playwright-report', 'meta']);
const textExt = new Set(['.ts', '.svelte', '.css', '.yml', '.yaml', '.sql', '.js', '.html']);
const allowedLibTop = new Set(['features', 'shared', 'components', 'hooks', 'index.ts', 'utils.ts']);
const serverOnlySpecifiers = [
	/^node:/,
	/^postgres$/,
	/^xlsx$/,
	/^pdfkit$/,
	/^drizzle-orm\/postgres-js/,
	/^better-auth\/(adapters|minimal|api|svelte-kit|plugins)/,
	/^\$app\/env\/private$/,
	/^\$app\/server$/
];

const problems: Problem[] = [];

function walk(path: string, out: string[] = []): string[] {
	if (!existsSync(path)) return out;
	const st = statSync(path);
	if (st.isFile()) {
		out.push(path);
		return out;
	}
	for (const name of readdirSync(path)) {
		if (skipDirs.has(name)) continue;
		walk(join(path, name), out);
	}
	return out;
}

function lineOf(text: string, index: number): number {
	let n = 1;
	for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) n++;
	return n;
}

function tsComments(text: string): Range[] {
	const sf = ts.createSourceFile('f.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	const found = new Map<number, Range>();
	const add = (list?: ts.CommentRange[]) => list?.forEach((r) => found.set(r.pos, { start: r.pos, end: r.end }));
	const visit = (node: ts.Node) => {
		add(ts.getLeadingCommentRanges(text, node.pos));
		add(ts.getTrailingCommentRanges(text, node.end));
		node.getChildren(sf).forEach(visit);
	};
	visit(sf);
	return [...found.values()];
}

function cssComments(text: string): Range[] {
	return [...text.matchAll(/\/\*[\s\S]*?\*\//g)].map((m) => ({ start: m.index!, end: m.index! + m[0].length }));
}

function lineComments(text: string, test: (trimmed: string) => boolean): Range[] {
	const out: Range[] = [];
	let offset = 0;
	for (const line of text.split('\n')) {
		if (test(line.trim())) out.push({ start: offset, end: offset + line.length });
		offset += line.length + 1;
	}
	return out;
}

const svelteBlock = /<(script|style)\b((?:"[^"]*"|'[^']*'|[^>"'])*)>([\s\S]*?)<\/\1>/g;

function svelteComments(text: string): Range[] {
	const out: Range[] = [];
	const blocks: Range[] = [];
	for (const m of text.matchAll(svelteBlock)) {
		const open = `<${m[1]}${m[2]}>`;
		const bodyStart = m.index! + open.length;
		blocks.push({ start: m.index!, end: m.index! + m[0].length });
		const found = m[1] === 'script' ? tsComments(m[3]) : cssComments(m[3]);
		for (const r of found) out.push({ start: bodyStart + r.start, end: bodyStart + r.end });
	}
	const inBlock = (i: number) => blocks.some((b) => i >= b.start && i < b.end);
	for (const m of text.matchAll(/<!--[\s\S]*?-->/g)) if (!inBlock(m.index!)) out.push({ start: m.index!, end: m.index! + m[0].length });
	return out;
}

function commentsOf(file: string, text: string): Range[] {
	const ext = extname(file);
	if (ext === '.ts' || ext === '.js') return tsComments(text);
	if (ext === '.svelte') return svelteComments(text);
	if (ext === '.css') return cssComments(text);
	if (ext === '.html') return [...text.matchAll(/<!--[\s\S]*?-->/g)].map((m) => ({ start: m.index!, end: m.index! + m[0].length }));
	if (ext === '.yml' || ext === '.yaml') return lineComments(text, (t) => t.startsWith('#'));
	if (ext === '.sql') return lineComments(text, (t) => t.startsWith('--') && !t.startsWith('--> statement-breakpoint'));
	return [];
}

function strip(text: string, ranges: Range[]): string {
	let out = text;
	for (const r of [...ranges].sort((a, b) => b.start - a.start)) {
		const lineStart = out.lastIndexOf('\n', r.start - 1) + 1;
		let lineEnd = out.indexOf('\n', r.end);
		if (lineEnd === -1) lineEnd = out.length;
		const before = out.slice(lineStart, r.start);
		const after = out.slice(r.end, lineEnd);
		if (before.trim() === '' && after.trim() === '') out = out.slice(0, lineStart) + out.slice(Math.min(lineEnd + 1, out.length));
		else out = out.slice(0, r.start).replace(/[ \t]+$/, '') + out.slice(r.end);
	}
	return out;
}

function checkComments(files: string[]) {
	for (const file of files) {
		if (!textExt.has(extname(file))) continue;
		const text = readFileSync(file, 'utf8');
		const ranges = commentsOf(file, text);
		if (!ranges.length) continue;
		if (fix) {
			writeFileSync(file, strip(text, ranges));
			continue;
		}
		for (const r of ranges)
			problems.push({ file: relative(root, file), line: lineOf(text, r.start), rule: 'no-comments', message: 'komentar di dalam kode dilarang; pindahkan penjelasan ke docs/' });
	}
}

type ImportRef = { specifier: string; typeOnly: boolean; line: number };

function importsOf(file: string, text: string): ImportRef[] {
	const bodies: { code: string; base: number }[] = [];
	if (extname(file) === '.svelte') {
		for (const m of text.matchAll(svelteBlock)) if (m[1] === 'script') bodies.push({ code: m[3], base: m.index! + `<${m[1]}${m[2]}>`.length });
	} else bodies.push({ code: text, base: 0 });
	const refs: ImportRef[] = [];
	for (const { code, base } of bodies) {
		const sf = ts.createSourceFile('f.ts', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
		const visit = (n: ts.Node) => {
			const line = lineOf(text, base + n.getStart(sf));
			if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier))
				refs.push({ specifier: n.moduleSpecifier.text, typeOnly: !!n.importClause?.isTypeOnly, line });
			else if (ts.isExportDeclaration(n) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier))
				refs.push({ specifier: n.moduleSpecifier.text, typeOnly: n.isTypeOnly, line });
			else if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword && n.arguments[0] && ts.isStringLiteral(n.arguments[0]))
				refs.push({ specifier: n.arguments[0].text, typeOnly: false, line });
			ts.forEachChild(n, visit);
		};
		visit(sf);
	}
	return refs;
}

const isServerFile = (file: string) => /\.server\.(ts|js)$/.test(file);
const isPublicEntry = (path: string) => /(^|\/)index(\.server)?\.ts$/.test(path) || /\.(schema|types)\.ts$/.test(path);

function resolveFeature(file: string, specifier: string): { feature: string; rest: string } | null {
	let abs: string | null = null;
	if (specifier.startsWith('#lib/')) abs = join(root, 'src/lib', specifier.slice(5));
	else if (specifier.startsWith('.')) abs = resolve(dirname(file), specifier);
	if (!abs) return null;
	const rel = relative(join(root, 'src/lib/features'), abs);
	if (rel.startsWith('..')) return null;
	const [feature, ...rest] = rel.split('/');
	return { feature, rest: rest.join('/') };
}

function checkStructure(files: string[]) {
	const libDir = join(root, 'src/lib');
	for (const name of readdirSync(libDir))
		if (!allowedLibTop.has(name))
			problems.push({ file: `src/lib/${name}`, line: 1, rule: 'feature-based', message: 'folder top-level src/lib harus salah satu: features, shared, components/ui, hooks' });
	const componentsDir = join(libDir, 'components');
	if (existsSync(componentsDir))
		for (const name of readdirSync(componentsDir))
			if (name !== 'ui') problems.push({ file: `src/lib/components/${name}`, line: 1, rule: 'feature-based', message: 'komponen domain wajib berada di src/lib/features/<fitur>/components' });

	const featuresRoot = join(libDir, 'features');
	for (const file of files) {
		const ext = extname(file);
		if (ext !== '.ts' && ext !== '.svelte') continue;
		if (!file.startsWith(join(root, 'src/lib/features')) && !file.startsWith(join(root, 'src/lib/shared'))) continue;
		const text = readFileSync(file, 'utf8');
		const rel = relative(root, file);
		const selfFeature = file.startsWith(featuresRoot) ? relative(featuresRoot, file).split('/')[0] : null;
		const server = isServerFile(file) || /\.schema\.ts$/.test(file);
		for (const ref of importsOf(file, text)) {
			if (!server && !ref.typeOnly) {
				if (serverOnlySpecifiers.some((re) => re.test(ref.specifier)))
					problems.push({ file: rel, line: ref.line, rule: 'server-boundary', message: `impor server-only "${ref.specifier}" hanya boleh di berkas *.server.ts` });
				if (/\.server(\.(ts|js))?$/.test(ref.specifier))
					problems.push({ file: rel, line: ref.line, rule: 'server-boundary', message: `berkas non-server mengimpor modul server "${ref.specifier}"` });
			}
			if (!selfFeature) continue;
			const target = resolveFeature(file, ref.specifier);
			if (target && target.feature !== selfFeature && !isPublicEntry(target.rest))
				problems.push({ file: rel, line: ref.line, rule: 'feature-boundary', message: `impor lintas fitur ke "${target.feature}/${target.rest}" harus lewat index.ts, index.server.ts, *.schema.ts, atau *.types.ts` });
		}
	}
}

const testKinds = new Set(['unit', 'integration', 'e2e', 'local']);
const testSupportDirs = new Set(['support', 'fixtures']);
const forbiddenInUnit = [/^postgres$/, /^drizzle-orm\/postgres-js/, /shared\/db\//, /support\/integration/, /^@playwright\//];
const forbiddenInIntegration = [/^@playwright\//, /(^|\/)unit\//, /(^|\/)e2e\//];
const forbiddenInE2e = [/^#lib\//, /^postgres$/, /^drizzle-orm/, /(^|\/)unit\//, /(^|\/)integration\//];

function featureNames(): Set<string> {
	const dir = join(root, 'src/lib/features');
	const names = existsSync(dir) ? readdirSync(dir).filter((n) => statSync(join(dir, n)).isDirectory()) : [];
	return new Set([...names, 'shared']);
}

function checkTests(files: string[]) {
	const testsRoot = join(root, 'tests');
	if (!existsSync(testsRoot)) return;
	const features = featureNames();
	for (const name of readdirSync(testsRoot))
		if (!testKinds.has(name) && !testSupportDirs.has(name))
			problems.push({ file: `tests/${name}`, line: 1, rule: 'test-layout', message: 'folder tests harus salah satu: unit, integration, e2e, local, support, fixtures' });
	for (const file of files) {
		if (!file.startsWith(testsRoot + '/') || extname(file) !== '.ts') continue;
		const rel = relative(testsRoot, file);
		const [kind, feature, ...rest] = rel.split('/');
		if (!testKinds.has(kind)) continue;
		const display = `tests/${rel}`;
		if (rest.length === 0) {
			problems.push({ file: display, line: 1, rule: 'test-layout', message: 'berkas tes harus berada di tests/<jenis>/<fitur>/' });
			continue;
		}
		if (!features.has(feature))
			problems.push({ file: display, line: 1, rule: 'test-layout', message: `folder fitur "${feature}" tidak ada di src/lib/features (atau shared)` });
		const suffix = kind === 'e2e' ? '.spec.ts' : '.test.ts';
		if (!file.endsWith(suffix))
			problems.push({ file: display, line: 1, rule: 'test-layout', message: `tes ${kind} harus berakhiran ${suffix}; helper dipindah ke tests/support` });
		const forbidden = kind === 'unit' ? forbiddenInUnit : kind === 'integration' ? forbiddenInIntegration : kind === 'e2e' ? forbiddenInE2e : [];
		for (const ref of importsOf(file, readFileSync(file, 'utf8')))
			if (forbidden.some((re) => re.test(ref.specifier)))
				problems.push({ file: display, line: ref.line, rule: 'test-isolation', message: `tes ${kind} tidak boleh mengimpor "${ref.specifier}"` });
	}
}

const files = scanTargets.flatMap((t) => walk(join(root, t)));

if (mode === 'all' || mode === 'comments') checkComments(files);
if (mode === 'all' || mode === 'structure') checkStructure(files);
if (mode === 'all' || mode === 'tests') checkTests(files);

if (fix) {
	console.log('komentar dihapus (--fix). Jalankan ulang guard untuk memverifikasi.');
	process.exit(0);
}

if (problems.length) {
	for (const p of problems) console.error(`${p.file}:${p.line} [${p.rule}] ${p.message}`);
	console.error(`\nGUARD GAGAL: ${problems.length} pelanggaran`);
	process.exit(1);
}
console.log(`Guard lulus: ${files.length} berkas dipindai (tanpa komentar, struktur feature-based, batas server/fitur).`);
