export const workbookErrorMessages: Record<string, string> = {
	EMPTY_FILE: 'Berkas kosong.',
	FILE_TOO_LARGE: 'Ukuran berkas melebihi batas 10 MB.',
	UNSUPPORTED_TYPE: 'Hanya berkas .xlsx dan .csv yang diterima.',
	CORRUPT_FILE: 'Berkas rusak atau bukan workbook yang valid.',
	ZIP_BOMB: 'Berkas ditolak karena struktur arsipnya tidak aman.',
	MACRO_NOT_SUPPORTED: 'Workbook berisi makro. Simpan sebagai .xlsx tanpa makro.',
	TOO_MANY_SHEETS: 'Jumlah sheet melebihi batas.',
	SHEET_TOO_LARGE: 'Salah satu sheet terlalu besar.',
	NO_VISIBLE_SHEETS: 'Tidak ada sheet berisi data yang dapat dibaca.'
};
