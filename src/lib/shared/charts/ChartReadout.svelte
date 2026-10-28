<script lang="ts">
	let { text, placeholder = 'Arahkan penunjuk atau fokuskan elemen grafik untuk melihat rincian.' }: { text: string | null; placeholder?: string } = $props();
</script>

<p class="mt-2 min-h-5 text-xs text-muted-foreground" aria-live="polite">{text ?? placeholder}</p>
