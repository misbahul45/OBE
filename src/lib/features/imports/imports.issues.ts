export type IssueSeverity = 'error' | 'warning' | 'info';

export const issueCatalog = {
	HEADER_NOT_FOUND: { severity: 'error', message: 'Baris header dengan kolom NIM tidak ditemukan. Pilih baris header dan kolom NIM secara manual.' },
	NAME_COLUMN_NOT_FOUND: { severity: 'warning', message: 'Kolom nama mahasiswa tidak ditemukan.' },
	NO_STUDENT_ROWS: { severity: 'error', message: 'Tidak ada baris mahasiswa yang dikenali di bawah header.' },
	NO_COMPONENT_COLUMNS: { severity: 'warning', message: 'Tidak ada kolom komponen penilaian yang dikenali.' },
	NIM_EMPTY: { severity: 'error', message: 'NIM kosong.' },
	NIM_INVALID_FORMAT: { severity: 'error', message: 'Format NIM tidak valid (harus 6-15 digit angka tanpa pemisah).' },
	NIM_SCIENTIFIC_AMBIGUOUS: { severity: 'error', message: 'NIM berbentuk notasi ilmiah dan digitnya tidak dapat dipastikan; perbaiki sel menjadi teks.' },
	NIM_DUPLICATE_IN_SHEET: { severity: 'error', message: 'NIM muncul lebih dari satu kali pada sheet ini.' },
	NIM_NUMERIC_SOURCE: { severity: 'warning', message: 'NIM tersimpan sebagai angka di Excel; nol di depan (jika ada) tidak dapat dipulihkan. Konfirmasi bahwa tidak ada NIM yang diawali 0.' },
	NAME_EMPTY: { severity: 'error', message: 'Nama mahasiswa kosong.' },
	NAME_CONFLICT: { severity: 'warning', message: 'Nama pada file berbeda dari data master untuk NIM yang sama; nama master dipertahankan.' },
	SCORE_NOT_NUMERIC: { severity: 'error', message: 'Nilai bukan angka.' },
	SCORE_OUT_OF_RANGE: { severity: 'error', message: 'Nilai di luar rentang yang diizinkan.' },
	SCORE_DATE_FORMAT: { severity: 'error', message: 'Sel nilai berformat tanggal; periksa format regional di Excel.' },
	SCORE_FORMULA_ERROR: { severity: 'error', message: 'Sel nilai berisi galat rumus.' },
	SCORE_FORMULA_NO_CACHE: { severity: 'warning', message: 'Sel berisi rumus tanpa nilai tersimpan (cache); nilai dianggap kosong.' },
	REFERENCE_OUT_OF_RANGE: { severity: 'warning', message: 'Nilai CPMK/CPL referensi di luar rentang 0-100; tidak diimpor.' },
	REFERENCE_NOT_NUMERIC: { severity: 'warning', message: 'Nilai CPMK/CPL referensi bukan angka; tidak diimpor.' },
	CPMK_UNKNOWN: { severity: 'warning', message: 'CPMK pada kolom ini belum didefinisikan untuk mata kuliah; kolom tidak diimpor.' },
	CPL_UNKNOWN: { severity: 'warning', message: 'CPL pada kolom ini belum didefinisikan; kolom tidak diimpor.' },
	WEIGHT_MISSING: { severity: 'warning', message: 'Bobot komponen tidak ditemukan pada header; bobot belum dikonfigurasi.' },
	WEIGHT_TOTAL_MISMATCH: { severity: 'error', message: 'Jumlah bobot komponen tidak sama dengan 100%.' },
	WEIGHT_CHANGED: { severity: 'warning', message: 'Bobot komponen berbeda dari konfigurasi offering yang sudah ada.' },
	UNLABELED_COLUMN_WITH_DATA: { severity: 'warning', message: 'Kolom tanpa header berisi data; kolom diabaikan kecuali dipetakan manual.' },
	ROW_EXCLUDED: { severity: 'info', message: 'Baris dikecualikan karena bukan data mahasiswa.' },
	ROW_WITHOUT_IDENTITY: { severity: 'warning', message: 'Baris memiliki nilai tetapi tidak memiliki NIM maupun nama; dikecualikan.' },
	METADATA_IGNORED: { severity: 'info', message: 'Blok metadata di sisi kanan tidak diimpor sebagai data mahasiswa.' },
	OFFERING_NOT_SELECTED: { severity: 'error', message: 'Sheet belum dipetakan ke offering mata kuliah.' },
	COMPONENT_CODE_DUPLICATE: { severity: 'error', message: 'Kode komponen penilaian dipakai lebih dari satu kolom.' },
	FILE_DUPLICATE: { severity: 'warning', message: 'File identik pernah diimpor ke offering yang sama.' }
} as const satisfies Record<string, { severity: IssueSeverity; message: string }>;

export type IssueCode = keyof typeof issueCatalog;

export type ImportIssue = {
	code: IssueCode;
	severity: IssueSeverity;
	message: string;
	sheet: string;
	row: number | null;
	column: string | null;
	field: string | null;
	detail?: string;
};

export type IssueLocation = { sheet: string; row?: number | null; column?: string | null; field?: string | null };

export function makeIssue(code: IssueCode, location: IssueLocation, detail?: string): ImportIssue {
	const entry = issueCatalog[code];
	return {
		code,
		severity: entry.severity,
		message: detail ? `${entry.message} ${detail}` : entry.message,
		sheet: location.sheet,
		row: location.row ?? null,
		column: location.column ?? null,
		field: location.field ?? null,
		detail
	};
}
