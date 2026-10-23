<script lang="ts">
	import { Monitor, Moon, Sun } from '@lucide/svelte';
	import { theme } from '#lib/shared/theme/theme.svelte.ts';
	import { themeLabels, themePreferences, type ThemePreference } from '#lib/shared/theme/theme.ts';

	const icons = { light: Sun, dark: Moon, system: Monitor } as const;
	const choose = (preference: ThemePreference) => theme.set(preference);
</script>

<fieldset class="grid gap-3 sm:grid-cols-3">
	<legend class="sr-only">Pilihan tema tampilan</legend>
	{#each themePreferences as preference (preference)}
		{@const Icon = icons[preference]}
		<label class="relative cursor-pointer">
			<input type="radio" name="theme" value={preference} checked={theme.preference === preference} onchange={() => choose(preference)} class="peer sr-only" />
			<span class="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm font-medium transition-colors peer-checked:border-primary peer-checked:bg-primary-soft peer-checked:text-primary peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 hover:bg-muted">
				<Icon class="size-4" aria-hidden="true" />
				{themeLabels[preference]}
			</span>
		</label>
	{/each}
</fieldset>
