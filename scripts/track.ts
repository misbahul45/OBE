import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

type Status = 'todo' | 'doing' | 'done' | 'blocked';
type Evidence = { at: string; kind: 'cmd' | 'manual'; cmd?: string; result: 'PASS' | 'FAIL'; summary: string };
type Task = {
	id: string;
	phase: string;
	title: string;
	status: Status;
	deps: string[];
	ac: string[];
	verify: string[];
	notes?: string;
	evidence: Evidence[];
};
type Criterion = { id: string; source: string; text: string };
type Ledger = { project: string; phases: { id: string; name: string }[]; acceptance: Criterion[]; tasks: Task[] };

const root = resolve(import.meta.dir, '..');
const ledgerPath = resolve(root, 'docs/tracking/ledger.json');
const statusPath = resolve(root, 'docs/tracking/STATUS.md');
const logPath = resolve(root, 'docs/tracking/session-log.md');

const load = (): Ledger => JSON.parse(readFileSync(ledgerPath, 'utf8'));
const save = (l: Ledger) => writeFileSync(ledgerPath, JSON.stringify(l, null, '\t') + '\n');
const today = () => new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

function problems(l: Ledger): string[] {
	const out: string[] = [];
	const ids = new Set(l.tasks.map((t) => t.id));
	const acIds = new Set(l.acceptance.map((a) => a.id));
	const phases = new Set(l.phases.map((p) => p.id));
	if (ids.size !== l.tasks.length) out.push('ID task duplikat');
	for (const t of l.tasks) {
		if (!phases.has(t.phase)) out.push(`${t.id}: fase ${t.phase} tidak dikenal`);
		for (const d of t.deps) if (!ids.has(d)) out.push(`${t.id}: dependensi ${d} tidak ada`);
		for (const a of t.ac) if (!acIds.has(a)) out.push(`${t.id}: AC ${a} tidak ada`);
		if (t.status === 'done') {
			const current = new Set(t.verify);
			const last = new Map<string, Evidence>();
			for (const e of t.evidence) if (e.kind === 'manual' || (e.cmd && current.has(e.cmd))) last.set(e.cmd ?? `manual:${e.summary}`, e);
			if (![...last.values()].some((e) => e.result === 'PASS')) out.push(`${t.id}: done tanpa bukti PASS`);
			if ([...last.values()].some((e) => e.kind === 'cmd' && e.result === 'FAIL'))
				out.push(`${t.id}: done tetapi bukti terakhir ada yang FAIL`);
			for (const d of t.deps) {
				const dt = l.tasks.find((x) => x.id === d);
				if (dt && dt.status !== 'done') out.push(`${t.id}: done padahal dependensi ${d} belum done`);
			}
		}
		if (t.status === 'blocked' && !t.notes) out.push(`${t.id}: blocked tanpa alasan`);
	}
	for (const a of l.acceptance) if (!l.tasks.some((t) => t.ac.includes(a.id))) out.push(`${a.id}: tidak punya task (tidak terlacak)`);
	const state = new Map<string, number>();
	const visit = (id: string, path: string[]) => {
		if (state.get(id) === 2) return;
		if (state.get(id) === 1) {
			out.push(`siklus dependensi: ${[...path, id].join(' -> ')}`);
			return;
		}
		state.set(id, 1);
		for (const d of l.tasks.find((t) => t.id === id)?.deps ?? []) if (ids.has(d)) visit(d, [...path, id]);
		state.set(id, 2);
	};
	for (const t of l.tasks) visit(t.id, []);
	return out;
}

function acStatus(l: Ledger, a: Criterion): 'met' | 'partial' | 'open' | 'blocked' {
	const ts = l.tasks.filter((t) => t.ac.includes(a.id));
	if (ts.length && ts.every((t) => t.status === 'done')) return 'met';
	if (ts.some((t) => t.status === 'blocked')) return 'blocked';
	if (ts.some((t) => t.status === 'done')) return 'partial';
	return 'open';
}

const nextTasks = (l: Ledger) =>
	l.tasks.filter((t) => (t.status === 'todo' || t.status === 'doing') && t.deps.every((d) => l.tasks.find((x) => x.id === d)?.status === 'done'));

function render(l: Ledger): string {
	const total = l.tasks.length;
	const done = l.tasks.filter((t) => t.status === 'done').length;
	const pct = total ? Math.round((done / total) * 100) : 0;
	const acs = l.acceptance.map((a) => ({ a, s: acStatus(l, a) }));
	const met = acs.filter((x) => x.s === 'met').length;
	const icon = { todo: '⬜', doing: '🔄', done: '✅', blocked: '⛔' } as const;
	const lines: string[] = [];
	lines.push('# STATUS — dihasilkan otomatis oleh `bun run track status`', '');
	lines.push('> Jangan edit manual. Sumber kebenaran: `docs/tracking/ledger.json`. Loop: Plan → Build → Verify → Record → Next (lihat `docs/process/closed-loop.md`).', '');
	lines.push(`**Task selesai:** ${done}/${total} (${pct}%) · **Acceptance criteria terpenuhi:** ${met}/${acs.length}`, '');
	lines.push('## Per fase', '', '| Fase | Selesai | Doing | Blocked | Todo |', '|---|---|---|---|---|');
	for (const p of l.phases) {
		const ts = l.tasks.filter((t) => t.phase === p.id);
		const c = (s: Status) => ts.filter((t) => t.status === s).length;
		lines.push(`| ${p.id} ${p.name} | ${c('done')}/${ts.length} | ${c('doing')} | ${c('blocked')} | ${c('todo')} |`);
	}
	const nx = nextTasks(l);
	lines.push('', '## Aksi berikutnya (dependensi terpenuhi)', '');
	if (!nx.length) lines.push('_Tidak ada task yang siap._');
	for (const t of nx.slice(0, 12)) lines.push(`- ${icon[t.status]} **${t.id}** ${t.title}${t.verify.length ? ` — verifikasi: \`${t.verify[0]}\`` : ''}`);
	const bl = l.tasks.filter((t) => t.status === 'blocked');
	lines.push('', '## Blocker', '');
	if (!bl.length) lines.push('_Tidak ada._');
	for (const t of bl) lines.push(`- ⛔ **${t.id}** ${t.title} — ${t.notes}`);
	lines.push('', '## Task', '');
	for (const p of l.phases) {
		lines.push(`### ${p.id} — ${p.name}`, '', '| | ID | Task | AC | Bukti terakhir |', '|---|---|---|---|---|');
		for (const t of l.tasks.filter((x) => x.phase === p.id)) {
			const e = t.evidence.at(-1);
			lines.push(`| ${icon[t.status]} | ${t.id} | ${t.title} | ${t.ac.join(', ') || '—'} | ${e ? `${e.result} · ${e.at}` : '—'} |`);
		}
		lines.push('');
	}
	lines.push('## Acceptance criteria (status dihitung dari task)', '', '| AC | Sumber | Kriteria | Status | Task |', '|---|---|---|---|---|');
	for (const { a, s } of acs) {
		const mark = { met: '✅ terpenuhi', partial: '🔄 sebagian', open: '⬜ terbuka', blocked: '⛔ blocked' }[s];
		lines.push(`| ${a.id} | ${a.source} | ${a.text} | ${mark} | ${l.tasks.filter((t) => t.ac.includes(a.id)).map((t) => t.id).join(', ')} |`);
	}
	lines.push('');
	return lines.join('\n');
}

function find(l: Ledger, id: string): Task {
	const t = l.tasks.find((x) => x.id === id);
	if (!t) throw new Error(`Task ${id} tidak ditemukan`);
	return t;
}

const [cmd, ...args] = process.argv.slice(2);
const flag = (n: string) => args.includes(n);

switch (cmd) {
	case 'status': {
		const l = load();
		writeFileSync(statusPath, render(l));
		console.log(`STATUS.md diperbarui (${l.tasks.filter((t) => t.status === 'done').length}/${l.tasks.length} task selesai).`);
		break;
	}
	case 'check': {
		const l = load();
		const p = problems(l);
		const fresh = existsSync(statusPath) && readFileSync(statusPath, 'utf8') === render(l);
		if (!fresh) p.push('STATUS.md basi — jalankan `bun run track status`');
		if (p.length) {
			console.error('LEDGER TIDAK KONSISTEN:\n- ' + p.join('\n- '));
			process.exit(1);
		}
		console.log(`Ledger konsisten: ${l.tasks.length} task, ${l.acceptance.length} AC, STATUS.md mutakhir.`);
		break;
	}
	case 'next': {
		const l = load();
		for (const t of nextTasks(l).slice(0, 10)) console.log(`${t.id}\t${t.status}\t${t.title}`);
		break;
	}
	case 'start': {
		const l = load();
		find(l, args[0]).status = 'doing';
		save(l);
		writeFileSync(statusPath, render(l));
		break;
	}
	case 'block': {
		const l = load();
		const t = find(l, args[0]);
		t.status = 'blocked';
		t.notes = args.slice(1).join(' ');
		save(l);
		writeFileSync(statusPath, render(l));
		break;
	}
	case 'note': {
		const l = load();
		const t = find(l, args[0]);
		const fail = flag('--fail');
		t.evidence.push({ at: today(), kind: 'manual', result: fail ? 'FAIL' : 'PASS', summary: args.slice(1).filter((a) => a !== '--fail').join(' ') });
		save(l);
		writeFileSync(statusPath, render(l));
		break;
	}
	case 'log': {
		appendFileSync(logPath, `\n- ${today()} — ${args.join(' ')}`);
		break;
	}
	case 'verify': {
		const l = load();
		const t = find(l, args[0]);
		const onlyIdx = args.indexOf('--only');
		const only = onlyIdx >= 0 ? Number(args[onlyIdx + 1]) : undefined;
		const cmds = t.verify.filter((_, i) => only === undefined || i === only);
		if (!cmds.length) {
			console.error(`${t.id} tidak punya perintah verify; pakai \`track note\` untuk bukti manual.`);
			process.exit(2);
		}
		let allPass = true;
		for (const c of cmds) {
			console.log(`\n$ ${c}`);
			const r = spawnSync('sh', ['-c', c], { cwd: root, encoding: 'utf8', timeout: 20 * 60_000, env: process.env });
			const out = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n').filter(Boolean);
			const pass = r.status === 0;
			allPass &&= pass;
			console.log(out.slice(-6).join('\n'));
			t.evidence.push({ at: today(), kind: 'cmd', cmd: c, result: pass ? 'PASS' : 'FAIL', summary: (out.at(-1) ?? '').slice(0, 160) });
			t.evidence = t.evidence.slice(-20);
		}
		const everyCmdLatestPass = t.verify.every((c) => t.evidence.filter((e) => e.cmd === c).at(-1)?.result === 'PASS');
		const depsDone = t.deps.every((d) => find(l, d).status === 'done');
		if (allPass && everyCmdLatestPass && depsDone) t.status = 'done';
		else if (t.status === 'done') t.status = 'doing';
		save(l);
		writeFileSync(statusPath, render(l));
		console.log(`\n${t.id} => ${t.status.toUpperCase()}${depsDone ? '' : ' (dependensi belum done)'}`);
		process.exit(allPass ? 0 : 1);
	}
	default:
		console.log('Perintah: status | check | next | start <id> | verify <id> [--only n] | note <id> "<teks>" [--fail] | block <id> "<alasan>" | log "<teks>"');
}
