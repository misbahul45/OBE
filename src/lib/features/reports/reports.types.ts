export type ReportKind = 'import_issues' | 'student_transcript' | 'class_transcript' | 'class_scores';

export type ReportFile = {
	fileName: string;
	contentType: string;
	body: Uint8Array | string;
};

export const reportContentTypes = {
	csv: 'text/csv; charset=utf-8',
	pdf: 'application/pdf'
} as const;

export function safeReportFileName(parts: string[], extension: 'csv' | 'pdf'): string {
	const stem = parts
		.map((part) => part.normalize('NFKD').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, ''))
		.filter(Boolean)
		.join('-')
		.slice(0, 120);
	return `${stem || 'laporan'}.${extension}`;
}
