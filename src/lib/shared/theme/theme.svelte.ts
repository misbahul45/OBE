import { nextToggleTarget, parseThemePreference, resolveTheme, themeStorageKey, type ResolvedTheme, type ThemePreference } from './theme.ts';

const darkQuery = '(prefers-color-scheme: dark)';

function readStoredPreference(): ThemePreference {
	try {
		return parseThemePreference(localStorage.getItem(themeStorageKey));
	} catch {
		return 'system';
	}
}

function storePreference(preference: ThemePreference) {
	try {
		if (preference === 'system') localStorage.removeItem(themeStorageKey);
		else localStorage.setItem(themeStorageKey, preference);
	} catch {
		return;
	}
}

class ThemeState {
	preference = $state<ThemePreference>('system');
	resolved = $state<ResolvedTheme>('light');

	init(): () => void {
		const query = window.matchMedia(darkQuery);
		this.preference = readStoredPreference();
		this.apply(query.matches);
		const onSystemChange = (event: MediaQueryListEvent) => this.apply(event.matches);
		const onStorage = (event: StorageEvent) => {
			if (event.key !== themeStorageKey) return;
			this.preference = parseThemePreference(event.newValue);
			this.apply(query.matches);
		};
		query.addEventListener('change', onSystemChange);
		window.addEventListener('storage', onStorage);
		return () => {
			query.removeEventListener('change', onSystemChange);
			window.removeEventListener('storage', onStorage);
		};
	}

	set(preference: ThemePreference) {
		this.preference = preference;
		storePreference(preference);
		this.apply(window.matchMedia(darkQuery).matches);
	}

	toggle() {
		this.set(nextToggleTarget(this.resolved));
	}

	private apply(systemPrefersDark: boolean) {
		this.resolved = resolveTheme(this.preference, systemPrefersDark);
		const root = document.documentElement;
		root.classList.toggle('dark', this.resolved === 'dark');
		root.style.colorScheme = this.resolved;
	}
}

export const theme = new ThemeState();
