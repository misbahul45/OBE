export type Rgb = { r: number; g: number; b: number };

export function hexToRgb(hex: string): Rgb {
	const value = hex.replace('#', '');
	const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
	return { r: parseInt(full.slice(0, 2), 16), g: parseInt(full.slice(2, 4), 16), b: parseInt(full.slice(4, 6), 16) };
}

function channel(value: number): number {
	const s = value / 255;
	return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
	const { r, g, b } = hexToRgb(hex);
	return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(foreground: string, background: string): number {
	const a = relativeLuminance(foreground);
	const b = relativeLuminance(background);
	const [lighter, darker] = a >= b ? [a, b] : [b, a];
	return (lighter + 0.05) / (darker + 0.05);
}

export type TokenSet = Record<string, string>;

export function parseThemeTokens(css: string): { light: TokenSet; dark: TokenSet } {
	const block = (selector: RegExp) => {
		const match = selector.exec(css);
		if (!match) return {};
		const body = css.slice(match.index + match[0].length, css.indexOf('\n}', match.index));
		const tokens: TokenSet = {};
		for (const m of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,6})\s*;/g)) tokens[m[1]] = m[2].toLowerCase();
		return tokens;
	};
	return { light: block(/:root\s*\{/), dark: block(/\.dark\s*\{/) };
}
