import PDFDocument from 'pdfkit';
import type { OfferingAnalytics, RosterRow } from '#lib/features/outcomes/index.ts';
import type { StudentProfile } from '#lib/features/students/index.ts';
import { unairLogoPng } from '#lib/shared/brand/unair-logo.data.ts';

type Doc = InstanceType<typeof PDFDocument>;

export type PdfOptions = { compress?: boolean; generatedAt?: Date };

const ink = '#0f172a';
const muted = '#64748b';
const line = '#cbd5e1';
const unairBlue = '#14487f';
const headFill = '#eaf0f7';
const margin = 48;
const logo = Buffer.from(unairLogoPng, 'base64');

const num = (value: number | null | undefined, digits = 1) =>
	value === null || value === undefined || !Number.isFinite(value) ? '-' : new Intl.NumberFormat('id-ID', { maximumFractionDigits: digits }).format(value);

const dateTime = (date: Date) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(date);

function open(options: PdfOptions): { doc: Doc; done: Promise<Uint8Array> } {
	const doc = new PDFDocument({ size: 'A4', margin, bufferPages: true, compress: options.compress ?? true, info: { Title: 'Laporan OBE Teknik Biomedis', Producer: 'OBE Teknik Biomedis' } });
	const chunks: Buffer[] = [];
	doc.on('data', (chunk: Buffer) => chunks.push(chunk));
	const done = new Promise<Uint8Array>((resolve, reject) => {
		doc.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))));
		doc.on('error', reject);
	});
	return { doc, done };
}

function letterhead(doc: Doc) {
	const size = 56;
	const textX = margin + size + 14;
	doc.image(logo, margin, margin, { width: size, height: size });
	doc.moveTo(margin + size + 7, margin + 2).lineTo(margin + size + 7, margin + size - 2).strokeColor(unairBlue).lineWidth(0.5).stroke();
	doc.font('Helvetica').fontSize(7.5).fillColor(unairBlue).text('KEMENTERIAN PENDIDIKAN TINGGI, SAINS, DAN TEKNOLOGI', textX, margin + 1, { lineBreak: false });
	doc.font('Helvetica-Bold').fontSize(18).fillColor(unairBlue).text('UNIVERSITAS AIRLANGGA', textX, margin + 12, { lineBreak: false });
	doc.font('Helvetica').fontSize(10).fillColor(unairBlue).text('Fakultas Sains dan Teknologi', textX, margin + 33, { lineBreak: false });
	doc.font('Helvetica-Bold').fontSize(8).fillColor(unairBlue).text('Program Studi S1 Teknik Biomedis | Sistem Informasi OBE', textX, margin + 47, { lineBreak: false });
	const y = margin + size + 8;
	doc.moveTo(margin, y).lineTo(doc.page.width - margin, y).strokeColor(unairBlue).lineWidth(1.4).stroke();
	doc.x = margin;
	doc.y = y + 14;
}

function header(doc: Doc, title: string, subtitle: string, generatedAt: Date) {
	letterhead(doc);
	const width = doc.page.width - margin * 2;
	doc.font('Helvetica-Bold').fontSize(15).fillColor(ink).text(title, margin, doc.y, { width, align: 'center' });
	doc.moveDown(0.25).font('Helvetica').fontSize(9.5).fillColor(muted).text(subtitle, margin, doc.y, { width, align: 'center' });
	doc.moveDown(0.25).fontSize(8).text(`Dihasilkan ${dateTime(generatedAt)} dari data tersimpan. Nilai CPMK dan CPL berasal dari hasil hitung sistem atau, bila belum ada, dari kolom Excel yang diimpor.`, margin, doc.y, { width, align: 'center' });
	doc.moveDown(0.8);
}

function ensureSpace(doc: Doc, needed: number) {
	if (doc.y + needed > doc.page.height - margin - 20) doc.addPage();
}

function heading(doc: Doc, text: string, size = 11) {
	ensureSpace(doc, 70);
	doc.x = margin;
	doc.moveDown(0.3).font('Helvetica-Bold').fontSize(size).fillColor(unairBlue).text(text, margin, doc.y, { width: doc.page.width - margin * 2 });
	doc.moveDown(0.25);
}

function note(doc: Doc, text: string) {
	doc.font('Helvetica-Oblique').fontSize(8).fillColor(muted).text(text, margin, doc.y, { width: doc.page.width - margin * 2 }).moveDown(0.3);
}

type Column = { title: string; width: number; align?: 'left' | 'right' | 'center' };

const cellPadding = 4;
const cellFont = 8.5;

function table(doc: Doc, columns: Column[], rows: string[][]) {
	const total = columns.reduce((sum, c) => sum + c.width, 0);
	const scale = (doc.page.width - margin * 2) / total;
	const widths = columns.map((c) => c.width * scale);
	const measure = (cells: string[], bold: boolean) => Math.max(...cells.map((cell, i) => doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(cellFont).heightOfString(cell, { width: widths[i] - cellPadding * 2 }))) + cellPadding * 2;
	const drawRow = (cells: string[], bold: boolean) => {
		const rowHeight = measure(cells, bold);
		const y = doc.y;
		let x = margin;
		cells.forEach((cell, i) => {
			doc.rect(x, y, widths[i], rowHeight).lineWidth(0.5);
			if (bold) doc.fillAndStroke(headFill, line);
			else doc.stroke(line);
			doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(cellFont).fillColor(ink).text(cell, x + cellPadding, y + cellPadding, { width: widths[i] - cellPadding * 2, align: bold ? 'center' : (columns[i].align ?? 'left') });
			x += widths[i];
		});
		doc.x = margin;
		doc.y = y + rowHeight;
	};
	const titles = columns.map((c) => c.title);
	const usable = doc.page.height - margin * 2 - 20;
	const whole = measure(titles, true) + rows.reduce((sum, row) => sum + measure(row, false), 0) + 4;
	ensureSpace(doc, whole <= usable ? whole : measure(titles, true) + (rows[0] ? measure(rows[0], false) : 0) + 4);
	drawRow(titles, true);
	for (const row of rows) {
		if (doc.y + measure(row, false) > doc.page.height - margin - 20) {
			doc.addPage();
			drawRow(titles, true);
		}
		drawRow(row, false);
	}
	doc.moveDown(0.7);
}

function keyValues(doc: Doc, pairs: [string, string][]) {
	const rows: string[][] = [];
	for (let i = 0; i < pairs.length; i += 2) rows.push([pairs[i][0], pairs[i][1], pairs[i + 1]?.[0] ?? '', pairs[i + 1]?.[1] ?? '']);
	const total = doc.page.width - margin * 2;
	const widths = [total * 0.2, total * 0.3, total * 0.2, total * 0.3];
	for (const cells of rows) {
		const height = Math.max(...cells.map((cell, i) => doc.font(i % 2 === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(cellFont).heightOfString(cell, { width: widths[i] - cellPadding * 2 }))) + cellPadding * 2;
		ensureSpace(doc, height + 4);
		const y = doc.y;
		let x = margin;
		cells.forEach((cell, i) => {
			doc.rect(x, y, widths[i], height).lineWidth(0.5);
			if (i % 2 === 0) doc.fillAndStroke(headFill, line);
			else doc.stroke(line);
			doc.font(i % 2 === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(cellFont).fillColor(ink).text(cell, x + cellPadding, y + cellPadding, { width: widths[i] - cellPadding * 2 });
			x += widths[i];
		});
		doc.x = margin;
		doc.y = y + height;
	}
	doc.moveDown(0.7);
}

function footer(doc: Doc, label: string) {
	const range = doc.bufferedPageRange();
	for (let i = 0; i < range.count; i++) {
		doc.switchToPage(range.start + i);
		doc.font('Helvetica').fontSize(8).fillColor(muted).text(`${label}  |  Halaman ${i + 1} dari ${range.count}`, margin, doc.page.height - margin - 12, { width: doc.page.width - margin * 2, align: 'center', lineBreak: false });
	}
}

const targetSourceLabel = { policy: 'kebijakan OBE', excel: 'ambang pada berkas Excel' } as const;

export async function renderStudentTranscript(profile: StudentProfile, options: PdfOptions = {}): Promise<Uint8Array> {
	const { doc, done } = open(options);
	const generatedAt = options.generatedAt ?? new Date();
	header(doc, 'Capaian Pembelajaran Lulusan', `${profile.student.name} | NIM ${profile.student.nim}`, generatedAt);
	if (profile.scopeLimited) note(doc, 'Dokumen ini hanya memuat mata kuliah dalam cakupan pengguna yang mengunduhnya.');

	heading(doc, 'Identitas Mahasiswa');
	keyValues(doc, [
		['Nama', profile.student.name],
		['NIM', profile.student.nim],
		['Angkatan', profile.student.cohortYear ? String(profile.student.cohortYear) : '-'],
		['Program Studi', 'S1 Teknik Biomedis'],
		['Jumlah Mata Kuliah', String(profile.enrollments.length)],
		['Tanggal Cetak', dateTime(generatedAt)]
	]);

	const achieved = profile.cplSummary.filter((c) => c.achievement === 'tercapai');
	const assessed = profile.cplSummary.filter((c) => c.achievement === 'tercapai' || c.achievement === 'belum_tercapai').length;
	heading(doc, 'CPL yang Telah Dicapai');
	if (profile.cplSummary.length === 0) {
		note(doc, 'Belum ada nilai CPL pada cakupan ini.');
	} else {
		const sources = [...new Set(profile.cplSummary.map((c) => c.targetSource).filter((x): x is 'policy' | 'excel' => x !== null))];
		const method = profile.cplSummary.some((c) => c.assumedMethod) ? 'rata-rata sederhana antar mata kuliah' : profile.policy?.aggregation === 'credit_weighted_mean' ? 'rata-rata tertimbang SKS' : 'rata-rata sederhana antar mata kuliah';
		note(doc, `${achieved.length} dari ${profile.cplSummary.length} CPL tercapai${assessed < profile.cplSummary.length ? ` (${profile.cplSummary.length - assessed} belum dapat dinilai)` : ''}. Nilai gabungan: ${method}. Ambang: ${sources.length ? sources.map((x) => targetSourceLabel[x]).join(' dan ') : 'belum ditetapkan'}.`);
		if (achieved.length === 0) {
			doc.font('Helvetica').fontSize(10).fillColor(muted).text('Belum ada CPL yang mencapai ambang.', margin, doc.y);
		} else {
			table(
				doc,
				[{ title: 'No', width: 1, align: 'center' }, { title: 'CPL', width: 2 }, { title: 'Capaian Pembelajaran Lulusan', width: 7 }, { title: 'Nilai', width: 2, align: 'right' }, { title: 'Ambang', width: 2, align: 'right' }, { title: 'Mata Kuliah Pendukung', width: 3, align: 'right' }],
				achieved.map((c, i) => [String(i + 1), c.code, c.title, num(c.aggregate.value), num(c.target), String(c.aggregate.used)])
			);
		}
	}
	footer(doc, 'Capaian pembelajaran lulusan');
	doc.end();
	return done;
}

export async function renderClassReport(analytics: OfferingAnalytics, roster: RosterRow[], options: PdfOptions = {}): Promise<Uint8Array> {
	const { doc, done } = open(options);
	const generatedAt = options.generatedAt ?? new Date();
	const o = analytics.offering;
	header(doc, 'Laporan Capaian Kelas', `${o.courseName} (${o.courseCode}) | Kelas ${o.section} | ${o.credits} SKS | ${o.semesterName}`, generatedAt);
	doc.font('Helvetica').fontSize(9).fillColor(ink).text(`Mahasiswa: ${analytics.studentCount} | Rata-rata nilai akhir: ${num(analytics.finalScore.mean)} (${analytics.finalScore.complete} lengkap, ${analytics.finalScore.incomplete} belum lengkap)`);
	if (analytics.policy) doc.text(`Kebijakan aktif: ${analytics.policy.name} | Ambang CPMK: ${num(analytics.policy.threshold)} | Rasio kelas: ${num(analytics.policy.classRatio)}%`);
	for (const warning of analytics.warnings) doc.fillColor('#b45309').text(`Catatan: ${warning}`);
	doc.fillColor(ink);

	if (analytics.components.length) {
		heading(doc, 'Komponen penilaian');
		table(doc, [{ title: 'Komponen', width: 4 }, { title: 'Bobot', width: 2, align: 'right' }, { title: 'Terisi', width: 2, align: 'right' }, { title: 'Kosong', width: 2, align: 'right' }, { title: 'Rata-rata', width: 2, align: 'right' }, { title: 'Min', width: 2, align: 'right' }, { title: 'Maks', width: 2, align: 'right' }], analytics.components.map((c) => [`${c.name} (${c.code})`, c.weightPercent === null ? '-' : `${num(c.weightPercent, 2)}%`, String(c.scored), String(c.blank), num(c.mean), num(c.min), num(c.max)]));
	}
	for (const group of [{ label: 'CPMK', rows: analytics.cpmk }, { label: 'CPL', rows: analytics.cpl }]) {
		if (!group.rows.length) continue;
		heading(doc, `Ketercapaian ${group.label}`);
		table(doc, [{ title: group.label, width: 2 }, { title: 'Rata-rata', width: 2, align: 'right' }, { title: 'Target', width: 2, align: 'right' }, { title: 'Tercapai', width: 2, align: 'right' }, { title: 'Belum', width: 2, align: 'right' }, { title: 'Data kurang', width: 2, align: 'right' }, { title: 'Rasio', width: 2, align: 'right' }], group.rows.map((r) => [r.code, num(r.mean), num(r.target), String(r.distribution.achieved), String(r.distribution.notAchieved), String(r.distribution.insufficient), r.distribution.ratioAchieved === null ? '-' : `${num(r.distribution.ratioAchieved)}%`]));
	}
	if (roster.length) {
		heading(doc, 'Daftar mahasiswa');
		table(doc, [{ title: 'NIM', width: 3 }, { title: 'Nama', width: 6 }, { title: 'Nilai akhir', width: 2, align: 'right' }, { title: 'Status', width: 4 }], roster.map((r) => [r.nim, r.name, num(r.finalScore), r.status === 'complete' ? 'Lengkap' : r.status === 'incomplete' ? `Kurang: ${r.missing.join(', ')}` : 'Bobot belum lengkap']));
	}
	footer(doc, `Laporan kelas ${o.courseCode}`);
	doc.end();
	return done;
}
