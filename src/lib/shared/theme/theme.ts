export const themePreferences = ['light', 'dark', 'system'] as const;

export type ThemePreference = (typeof themePreferences)[number];
export type ResolvedTheme = 'light' | 'dark';

export const themeStorageKey = 'obe-theme';

export const themeLabels: Record<ThemePreference, string> = {
	light: 'Terang',
	dark: 'Gelap',
	system: 'Ikuti sistem'
};

export function parseThemePreference(value: unknown): ThemePreference {
	return themePreferences.find((preference) => preference === value) ?? 'system';
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
	if (preference === 'system') return systemPrefersDark ? 'dark' : 'light';
	return preference;
}

export function nextToggleTarget(resolved: ResolvedTheme): ThemePreference {
	return resolved === 'dark' ? 'light' : 'dark';
}
