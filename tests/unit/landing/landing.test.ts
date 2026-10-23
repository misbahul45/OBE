import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { landingCopy } from '#lib/features/landing/landing.copy.ts';

const read = (path: string) => readFileSync(path, 'utf8');
const page = read('src/routes/+page.svelte');
const landing = read('src/lib/features/landing/components/LandingPage.svelte');
const visual = read('src/lib/features/landing/components/OutcomeOrbitVisual.svelte');
const field = read('src/lib/features/landing/components/DotField.svelte');
const paths = read('src/lib/features/landing/components/OrbitPaths.svelte');
const sources = { page, landing, visual, paths, field, copy: read('src/lib/features/landing/landing.copy.ts') };
const markup = `${page}\n${landing}\n${visual}\n${paths}\n${field}`;
const count = (pattern: RegExp, text = markup) => (text.match(pattern) ?? []).length;

describe('struktur judul landing', () => {
	test('tepat satu H1 dan satu H2, tanpa tingkat judul lain', () => {
		expect(count(/<h1[\s>]/g)).toBe(1);
		expect(count(/<h2[\s>]/g)).toBe(1);
		expect(count(/<h[3-6][\s>]/g)).toBe(0);
	});

	test('H1 dan H2 dirender dari satu sumber teks yang konsisten', () => {
		expect(landing).toMatch(/<h1[^>]*>\{landingCopy\.title\}<\/h1>/);
		expect(landing).toMatch(/<h2[^>]*>\{landingCopy\.subtitle\}<\/h2>/);
		expect(landingCopy.subtitle).not.toContain(landingCopy.title);
		expect(landingCopy.title.length).toBeLessThanOrEqual(70);
		expect(landingCopy.title.toLowerCase()).toContain('capaian pembelajaran');
	});

	test('seksi bernama lewat aria-labelledby ke teks yang ada, bukan judul tambahan', () => {
		const labelled = [...landing.matchAll(/aria-labelledby="([^"]+)"/g)].map((m) => m[1]);
		expect(labelled.length).toBeGreaterThanOrEqual(4);
		for (const id of labelled) expect(landing).toContain(`id="${id}"`);
	});
});

describe('tanpa elemen yang dilarang di landing', () => {
	test('tidak ada badge, eyebrow, pill, chip, atau label huruf kapital', () => {
		for (const [name, text] of Object.entries(sources))
			expect(text.match(/badge|eyebrow|\bpill\b|\bchip\b|uppercase|tracking-widest|tracking-wider/i)?.[0] ?? null, name).toBeNull();
	});

	test('tidak ada statistik, logo klien, tabel, daftar bernomor, atau komponen kartu', () => {
		expect(markup.match(/<(table|ul|ol)[\s>]/)?.[0] ?? null).toBeNull();
		expect(markup.match(/<Card|testimon|klien|\b\d+\+?\s*(mahasiswa|dosen|mata kuliah)/i)?.[0] ?? null).toBeNull();
	});

	test('tidak ada pendaftaran publik', () => {
		for (const [name, text] of Object.entries(sources)) expect(text.match(/daftar|\bregister\b|sign[ -]?up|buat akun|\/signup/i)?.[0] ?? null, name).toBeNull();
	});

	test('tidak memakai aset eksternal; satu-satunya gambar adalah logo resmi lokal', () => {
		for (const [name, text] of Object.entries(sources)) expect(text.match(/https?:\/\//)?.[0] ?? null, name).toBeNull();
		const images = [...markup.matchAll(/<img\s[^>]*>/g)].map((m) => m[0]);
		expect(images.length).toBeGreaterThanOrEqual(1);
		for (const image of images) expect(image).toContain('src={landingCopy.logoSrc}');
		expect(landingCopy.logoSrc).toBe('/brand/unair-logo.png');
		expect(landingCopy.logoAlt).toBe('Logo Universitas Airlangga');
	});

	test('berkas logo resmi ada dan berformat PNG persegi', () => {
		const bytes = readFileSync('static/brand/unair-logo.png');
		expect(bytes.subarray(1, 4).toString()).toBe('PNG');
		expect(bytes.readUInt32BE(16)).toBe(bytes.readUInt32BE(20));
	});
});

describe('ajakan bertindak', () => {
	test('semua tombol dan tautan ajakan menuju /login, tanpa tautan jangkar atau keluar', () => {
		expect(landingCopy.loginHref).toBe('/login');
		expect(count(/<Button[\s>]/g, landing)).toBe(1);
		expect(count(/href=\{landingCopy\.loginHref\}/g, landing)).toBe(3);
		const hrefs = [...landing.matchAll(/href=(?:"([^"]*)"|\{([^}]*)\})/g)].map((m) => m[1] ?? m[2]);
		for (const href of hrefs) expect(['/', 'landingCopy.loginHref']).toContain(href);
	});

	test('teks ajakan hero dan penutup berbeda agar nama tautan tidak ambigu', () => {
		expect(landingCopy.cta).toBe('Masuk ke sistem');
		expect(landingCopy.closingCta).not.toContain(landingCopy.cta);
	});
});

describe('animasi dan aksesibilitas visual', () => {
	test('diagram orbit memakai animasi CSS dan SMIL ringan serta menghormati prefers-reduced-motion', () => {
		expect(paths).toContain('@media (prefers-reduced-motion: reduce)');
		expect(paths).toContain('animation: none');
		expect(paths).toContain('<animateMotion');
		expect(paths).toContain('class="tracer-dot"');
		expect(paths).not.toContain('circle:last-child');
		expect(paths).toContain('display: none');
		expect(visual).toContain('motion-reduce:transition-none');
		expect(visual).toContain('@media (prefers-reduced-motion: reduce)');
		expect(visual + paths).not.toMatch(/setInterval|requestAnimationFrame|from 'gsap'/);
	});

	test('halaman memakai GSAP ScrollTrigger dengan konteks yang dibersihkan dan gerak dikurangi dihormati', () => {
		expect(landing).toContain('prefers-reduced-motion: reduce');
		expect(landing).toContain('gsap.context(');
		expect(landing).toContain('context.revert()');
		expect(landing).toContain('scrollTrigger');
	});

	test('Three.js dimuat malas, kanvas dekoratif, dan semua sumber daya WebGL dilepas', () => {
		expect(field).toContain("import('three')");
		expect(field).not.toMatch(/^\s*import .* from 'three'/m);
		expect(field).toContain('aria-hidden="true"');
		expect(field).toContain('prefers-reduced-motion: reduce');
		for (const release of ['geometry.dispose()', 'material.dispose()', 'renderer.dispose()', 'renderer.forceContextLoss()', 'context.revert()', "removeEventListener('resize'", "removeEventListener('pointermove'", 'gsap.ticker.remove(tick)'])
			expect(field, release).toContain(release);
	});

	test('kanvas tidak menangkap pointer dan tidak membuat galat saat WebGL tidak tersedia', () => {
		expect(field).toContain('pointer-events-none');
		expect(field).toContain('webglAvailable()');
		expect(field).toMatch(/getContext\('webgl2'\)/);
	});

	test('diagram adalah kelompok bernama dengan simpul berupa tombol asli, bukan gambar tunggal', () => {
		expect(visual).toContain('role="group"');
		expect(visual).toContain('aria-labelledby="orbit-title"');
		expect(visual).toContain('aria-describedby="orbit-desc"');
		expect(visual).toContain('id="orbit-title"');
		expect(visual).toContain('id="orbit-desc"');
		expect(visual).toMatch(/<button[\s\S]*aria-pressed=\{selected === node\.id\}/);
		expect(visual).toContain('aria-controls="orbit-panel"');
		expect(visual).toContain('aria-label="{detail.label}, tahap {index + 1} dari {orbit.nodes.length}, mengalir ke {nextOf(index).label}"');
		expect(visual).toContain('aria-live="polite"');
		expect(visual).not.toContain('role="img"');
	});

	test('lapisan SVG dekoratif disembunyikan dari teknologi bantu', () => {
		expect(paths).toContain('aria-hidden="true"');
		expect(paths).toContain('focusable="false"');
	});

	test('papan ketik: tombol panah memindahkan fokus dan Esc membatalkan pilihan', () => {
		for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Escape']) expect(visual).toContain(`'${key}'`);
		expect(visual).toContain('focus-visible:ring-4');
	});

	test('rantai MK, CPMK, CPL, CQI muncul sebagai simpul dan sebagai empat langkah', () => {
		expect([...landingCopy.stages]).toEqual(['Mata Kuliah', 'CPMK', 'CPL', 'CQI']);
		expect(landingCopy.steps).toHaveLength(4);
		expect(landingCopy.cycle.map((phase) => phase.key)).toEqual(['Plan', 'Do', 'Check', 'Act']);
	});

	test('dekorasi disembunyikan dari teknologi bantu', () => {
		expect(landing).toContain('aria-hidden="true"');
	});
});

describe('isi landing menjelaskan produk', () => {
	test('menyebut alur, peran, dan modul yang benar-benar ada di aplikasi', () => {
		const copy = JSON.stringify(landingCopy);
		for (const term of ['CPMK', 'CPL', 'CQI', 'Excel', 'Super Admin', 'Dosen', 'transkrip', 'jejak audit']) expect(copy.toLowerCase()).toContain(term.toLowerCase());
		expect(landingCopy.modules).toHaveLength(6);
		expect(landingCopy.audiences).toHaveLength(3);
	});
});
