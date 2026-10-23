import type { OfferingHint } from './imports.types.ts';

export function hintOfferingFromSheetName(sheetName: string): OfferingHint {
	let text = sheetName.replace(/\s+/g, ' ').trim();
	const isPractical = /^prak(\.|tikum|tek)?\b/i.test(text) || /\(prakti/i.test(text);
	text = text.replace(/^prak(\.|tikum)?\s+/i, '').replace(/\s*\((prakti[^)]*)\)?$/i, '');
	text = text.replace(/\b(19|20)\d{2}\b/g, '').replace(/\s+/g, ' ').trim();
	const section = /\bT\s?(\d+)\s*$/i.exec(text);
	const sectionHint = section ? `T${section[1]}` : null;
	if (section) text = text.slice(0, section.index).trim();
	text = text.replace(/\s+T$/i, '').replace(/[()\s]+$/g, '').trim();
	return { courseNameHint: text, sectionHint, isPractical };
}
